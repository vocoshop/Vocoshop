import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import Store from "../models/Store";
import Subscription from "../models/Subscription";
import jwt from "jsonwebtoken";
import { normalizePhone } from "../utils/phone";

export const checkPhone = async (req: Request, res: Response) => {
try {
const phone = normalizePhone(req.body?.phone);
if (!phone) return res.status(400).json({ error: "Numero requis" });

const store = await Store.findOne({ phone }).select("passwordHash phoneVerified subscriptionActive").lean();

return res.json({
exists: !!store,
hasPassword: !!store?.passwordHash,
phoneVerified: store?.phoneVerified || false,
subscriptionActive: store?.subscriptionActive || false,
});
} catch (err) {
console.error("checkPhone:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

function generateToken(storeId: string, phone?: string) {
return jwt.sign(
{ storeId, phone: phone || "" },
process.env.JWT_SECRET || "",
{ expiresIn: "30d" }
);
}

export const registerStore = async (req: Request, res: Response) => {
try {
const { phone, password, storeName, ownerName, ownerPhone, deviceId, referralCodeUsed } = req.body;

const phoneNorm = normalizePhone(phone);
if (!phoneNorm) return res.status(400).json({ error: "Numero requis" });

const exists = await Store.findOne({ phone: phoneNorm }).select("_id").lean();
if (exists) return res.status(400).json({ error: "Ce numero est deja utilise" });

const passwordHash = await bcrypt.hash(password, 10);

const referralSafe = typeof referralCodeUsed === "string" ? referralCodeUsed.trim() : "";
const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

const store = await Store.create({
phone: phoneNorm,
passwordHash,
storeName: typeof storeName === "string" ? storeName.trim() : "",
ownerName: typeof ownerName === "string" ? ownerName.trim() : undefined,
ownerPhone: typeof ownerPhone === "string" ? ownerPhone.trim() : undefined,
deviceId: deviceId || null,
referralCodeUsed: referralSafe,
loginCount: 1,
lastActiveAt: new Date(),
trialEnd,
});

await Subscription.create({
storeId: store._id,
plan: "STANDARD",
status: "trial",
trialStart: new Date(),
trialEnd,
referralCount: 0,
referralRewarded: 0,
});

const token = generateToken(store._id.toString(), store.phone);

return res.json({
message: "Compte cree",
storeId: store._id,
token,
isOnboarded: typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: !!(store.storeName && String(store.storeName).trim().length > 0),
phoneVerified: false,
subscriptionActive: false,
});
} catch (err: any) {
if (err?.code === 11000) return res.status(400).json({ error: "Ce numero est deja utilise" });
console.error("registerStore:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

export const loginStore = async (req: Request, res: Response) => {
try {
const { phone, password, deviceId } = req.body;

const phoneNorm = normalizePhone(phone);
if (!phoneNorm) return res.status(400).json({ error: "Numero requis" });

const store = await Store.findOne({ phone: phoneNorm });
if (!store) return res.status(404).json({ error: "Compte introuvable" });

if (store.passwordHash) {
if (!password) return res.status(400).json({ error: "Mot de passe requis" });

const valid = await bcrypt.compare(password, store.passwordHash);
if (!valid) return res.status(401).json({ error: "Mot de passe incorrect" });

await Store.updateOne(
{ _id: store._id },
{ $inc: { loginCount: 1 }, $set: { lastActiveAt: new Date() } }
);

const token = generateToken(store._id.toString(), store.phone);
    return res.json({
message: "Connexion reussie",
storeId: store._id,
token,
isOnboarded: typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: !!(store.storeName && String(store.storeName).trim().length > 0),
phoneVerified: store.phoneVerified || false,
subscriptionActive: store.subscriptionActive || false,
});
}

// Pas de mot de passe encore enregistre (ancien compte OTP)
// Le premier mot de passe saisi devient le mot de passe du compte
if (!password) return res.status(400).json({ error: "Mot de passe requis" });
if (password.length < 6) return res.status(400).json({ error: "Mot de passe trop court" });

const passwordHash = await bcrypt.hash(password, 10);
store.passwordHash = passwordHash;

if (!store.deviceId && deviceId) store.deviceId = deviceId;

await Store.updateOne(
{ _id: store._id },
{ $inc: { loginCount: 1 }, $set: { lastActiveAt: new Date(), passwordHash, deviceId: store.deviceId } }
);

const token = generateToken(store._id.toString(), store.phone);
return res.json({
message: "Mot de passe enregistre",
storeId: store._id,
token,
isOnboarded: typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: !!(store.storeName && String(store.storeName).trim().length > 0),
phoneVerified: store.phoneVerified || false,
subscriptionActive: store.subscriptionActive || false,
});
} catch (err) {
console.error("loginStore:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
