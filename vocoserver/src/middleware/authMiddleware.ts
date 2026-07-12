// middleware/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Store from "../models/Store";

import { evaluateSubscription } from "../services/subscriptionEngine";
import { safeTrim, shouldReauth } from "../utils/helpers";

const REAUTH_DAYS = Math.min(Math.max(Number(process.env.REAUTH_DAYS || 14), 1), 180);

const ACTIVITY_THROTTLE_MIN = Math.min(
Math.max(Number(process.env.ACTIVITY_THROTTLE_MIN || 10), 1),
120
);

function isSubscriptionAllowedRoute(req: Request) {
const url = String(req.originalUrl || "");

return (
url.includes("/otp") ||
url.includes("/auth") ||
url.includes("/store/me") ||
url.includes("/subscription")
);
}

/**
* 🔥 IMPORTANT FIX
* Certaines routes doivent rester accessibles même si REAUTH_REQUIRED
*/
function isReauthAllowedRoute(req: Request) {
const url = String(req.originalUrl || "");

return (
url.includes("/subscription") ||
url.includes("/store/me") ||
url.includes("/products")
);
}

/**
* update lastActiveAt throttled
*/
async function touchLastActiveThrottled(storeId: string) {
try {
const now = new Date();
const cutoff = new Date(
now.getTime() - ACTIVITY_THROTTLE_MIN * 60 * 1000
);

await Store.updateOne(
{
_id: storeId,
$or: [
{ lastActiveAt: { $exists: false } },
{ lastActiveAt: null },
{ lastActiveAt: { $lt: cutoff } },
],
},
{ $set: { lastActiveAt: now } }
).catch(() => {});
} catch {}
}

export default async function authMiddleware(
req: Request,
res: Response,
next: NextFunction
) {
try {
const auth = String(req.headers.authorization || "");
const token = auth.startsWith("Bearer ")
? auth.split(" ")[1]
: "";

if (!token)
return res.status(401).json({ error: "Token manquant" });

const secret = process.env.JWT_SECRET;
if (!secret)
return res.status(500).json({ error: "JWT_SECRET manquant" });

const decoded: any = jwt.verify(token, secret);

/* =====================================================
✅ CAS A — ancien token owner
===================================================== */
if (decoded?.storeId && !decoded?.userId) {
const storeId = String(decoded.storeId);

const store = await Store.findById(storeId)
.select("_id agentCode storeName lastActiveAt ownershipStatus")
.lean();

if (!store)
return res.status(401).json({ error: "Boutique invalide" });

// 🔥 FIX REAUTH SAFE
if (
shouldReauth((store as any).lastActiveAt) &&
!isReauthAllowedRoute(req)
) {
return res.status(401).json({
code: "REAUTH_REQUIRED",
error: `Inactivité détectée (${REAUTH_DAYS} jours). Veuillez confirmer par OTP.`,
});
}

touchLastActiveThrottled(storeId);

/* =====================================================
🔥 CHECK ABONNEMENT (ULTRA SAFE)
===================================================== */
try {
const sub = await evaluateSubscription(storeId);

req.subscription = sub ?? undefined;

if (!sub?.access && !isSubscriptionAllowedRoute(req)) {
return res.status(402).json({
code: "SUBSCRIPTION_REQUIRED",
message: sub?.message || "Abonnement requis",
});
}
} catch (e) {
console.log("subscription engine error", e);
}

const ownershipStatus = (store as any)?.ownershipStatus || "active";
const isActualOwner = ownershipStatus === "active";

req.user = {
id: `owner:${storeId}`,
userId: `owner:${storeId}`,
storeId,
role: isActualOwner ? "owner" : "admin",
ownershipStatus,
permissions: ["inventory", "sales", "reports", "stock", "orders", "employees"],
agentCode: safeTrim((store as any).agentCode),
storeName: safeTrim((store as any).storeName),
};

return next();
}

/* =====================================================
✅ CAS B — nouveau token user
===================================================== */
if (decoded?.userId) {
const userId = String(decoded.userId);

const user = await User.findById(userId)
.select("_id store role isActive permissions")
.lean();

if (!user)
return res.status(401).json({ error: "Utilisateur invalide" });

if (!user.store) {
// ✅ CAS B1: Admin sans store (owner sans boutique)
if ((user as any).role === "owner") {
req.user = {
id: String(user._id),
userId: String(user._id),
storeId: null,
role: "owner",
permissions: { "*": true },
};
return next();
}
// On laisse passer pour les autres, req.user = null pour que le contrôleur gère le cas
req.user = undefined;
return next();
}

if ((user as any).isActive === false)
return res.status(403).json({
error: "Compte désactivé",
});

const storeId = String(user.store);

const store = await Store.findById(storeId)
.select("_id agentCode storeName lastActiveAt ownershipStatus")
.lean();

if (!store)
return res.status(401).json({ error: "Boutique invalide" });

// 🔥 FIX REAUTH SAFE
if (
shouldReauth((store as any).lastActiveAt) &&
!isReauthAllowedRoute(req)
) {
return res.status(401).json({
code: "REAUTH_REQUIRED",
error: `Inactivité détectée (${REAUTH_DAYS} jours). Veuillez confirmer par OTP.`,
});
}

touchLastActiveThrottled(storeId);

/* =====================================================
🔥 CHECK ABONNEMENT (ULTRA SAFE)
===================================================== */
try {
const sub = await evaluateSubscription(storeId);

req.subscription = sub ?? undefined;

if (!sub?.access && !isSubscriptionAllowedRoute(req)) {
return res.status(402).json({
code: "SUBSCRIPTION_REQUIRED",
message: sub?.message || "Abonnement requis",
});
}
} catch (e) {
console.log("subscription engine error", e);
}

req.user = {
id: String(user._id),
userId: String(user._id),
storeId,
role: safeTrim((user as any).role) || "employee",
ownershipStatus: (store as any)?.ownershipStatus || "active",
name: safeTrim((user as any)?.name) || undefined,
permissions:
  (user as any).permissions &&
  typeof (user as any).permissions === "object"
  ? (user as any).permissions
  : {},
agentCode: safeTrim((store as any)?.agentCode),
storeName: safeTrim((store as any)?.storeName),
};

return next();
}

/* =====================================================
✅ CAS C — admin owner token (email + password)
===================================================== */
if (decoded?.role === "owner") {
  req.user = {
    id: "admin",
    userId: "admin",
    storeId: null,
    role: "owner",
    permissions: { "*": true },
    name: decoded.name || "Super Admin",
  };
  return next();
}

return res.status(401).json({ error: "Token invalide" });
} catch (error) {
console.error("❌ Auth middleware:", error);
return res.status(401).json({
error: "Token invalide ou expiré",
});
}
}
