import { Request, Response } from "express";
import Store from "../models/Store";
import Subscription from "../models/Subscription";
import jwt from "jsonwebtoken";
import { normalizePhone } from "../utils/phone";

/* =====================================================
⛳ Génère le JWT
===================================================== */
function generateToken(storeId: string, phone?: string) {
return jwt.sign(
{ storeId, phone: phone || "" },
process.env.JWT_SECRET || "",
{ expiresIn: "30d" }
);
}

/* =====================================================
🔹 REGISTER (inscription boutique) — V9 REFERRAL SAFE
===================================================== */
export const registerStore = async (req: Request, res: Response) => {
try {
const { phone, storeName, ownerName, ownerPhone, deviceId, referralCodeUsed } = req.body;

const phoneNorm = normalizePhone(phone);

if (!phoneNorm) {
return res.status(400).json({ error: "Numéro requis" });
}

/* --------------------------------------------------
🔐 Vérifie si déjà existant
-------------------------------------------------- */
const exists = await Store.findOne({ phone: phoneNorm })
.select("_id")
.lean();

if (exists) {
return res.status(400).json({
error: "Ce numéro est déjà utilisé",
});
}

/* --------------------------------------------------
🔥 FIX CRITIQUE V9 — REFERRAL SAFE
-------------------------------------------------- */

const referralSafe =
typeof referralCodeUsed === "string"
? referralCodeUsed.trim()
: "";

/* --------------------------------------------------
🏪 CREATE STORE
-------------------------------------------------- */

const store = await Store.create({
phone: phoneNorm,
storeName:
typeof storeName === "string" ? storeName.trim() : "",
ownerName:
typeof ownerName === "string" ? ownerName.trim() : undefined,
ownerPhone:
typeof ownerPhone === "string" ? ownerPhone.trim() : undefined,
deviceId: deviceId || null,

// ⭐ ULTRA IMPORTANT POUR TON WEBHOOK
referralCodeUsed: referralSafe,

loginCount: 1,
lastActiveAt: new Date(),
});

/* --------------------------------------------------
🔥 CREATE SUBSCRIPTION (AUTO)
-------------------------------------------------- */
await Subscription.create({
storeId: store._id,
plan: "STANDARD",
status: "trial",
trialStart: new Date(),
trialEnd: new Date(
Date.now() + 30 * 24 * 60 * 60 * 1000
),
referralCount: 0,
referralRewarded: 0,
});

/* --------------------------------------------------
🔑 TOKEN
-------------------------------------------------- */
const token = generateToken(
store._id.toString(),
store.phone
);

return res.json({
message: "Compte créé",
storeId: store._id,
token,
isOnboarded:
typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: !!(
store.storeName &&
String(store.storeName).trim().length > 0
),
});
} catch (err: any) {
if (err?.code === 11000) {
return res.status(400).json({
error: "Ce numéro est déjà utilisé",
});
}

console.error("❌ registerStore:", err);

return res.status(500).json({
error: "Erreur serveur",
});
}
};

/* =====================================================
🔹 LOGIN — V9 STABLE
===================================================== */
export const loginStore = async (req: Request, res: Response) => {
try {
const { phone, deviceId } = req.body;

const phoneNorm = normalizePhone(phone);

if (!phoneNorm) {
return res.status(400).json({ error: "Numéro requis" });
}

if (!deviceId) {
return res.status(400).json({ error: "deviceId requis" });
}

const store = await Store.findOne({ phone: phoneNorm });

if (!store) {
return res.status(404).json({
error: "Compte introuvable",
});
}

/* --------------------------------------------------
🔐 DEVICE LOCK
-------------------------------------------------- */
if (store.deviceId && store.deviceId !== deviceId) {
return res.status(401).json({
error:
"Ce compte est déjà utilisé sur un autre appareil",
});
}

if (!store.deviceId) {
store.deviceId = deviceId;
}

/* --------------------------------------------------
🔥 TRACKING LOGIN (ABONNEMENT ENGINE)
-------------------------------------------------- */
await Store.updateOne(
{ _id: store._id },
{
$inc: { loginCount: 1 },
$set: {
lastActiveAt: new Date(),
deviceId: store.deviceId,
},
}
);

const token = generateToken(
store._id.toString(),
store.phone
);

return res.json({
message: "Connexion réussie",
storeId: store._id,
token,
isOnboarded:
typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: !!(
store.storeName &&
String(store.storeName).trim().length > 0
),
});
} catch (err) {
console.error("❌ loginStore:", err);

return res.status(500).json({
error: "Erreur serveur",
});
}
};
