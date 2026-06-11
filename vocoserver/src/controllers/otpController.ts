// controllers/otpController.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import User from "../models/User";
import Store from "../models/Store";
import OTP from "../models/Otp";
import { sendSMS } from "../services/smsService";
import { normalizePhone } from "../utils/phone";
import { safeTrim, safeBool, shouldReauth } from "../utils/helpers";

/* =====================================================
CONFIG
===================================================== */
const REAUTH_DAYS = Math.min(Math.max(Number(process.env.REAUTH_DAYS || 14), 1), 180);
const REAUTH_MS = REAUTH_DAYS * 24 * 60 * 60 * 1000;

/* =====================================================
HELPERS
===================================================== */
function generateCode() {
return Math.floor(100000 + Math.random() * 900000).toString();
}

function computeIsOnboarded(store: any): boolean {
// Source de vérité simple : storeName non vide
return !!(store?.storeName && String(store.storeName).trim().length > 0);
}

function signToken(payload: any) {
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET manquant");
return jwt.sign(payload, secret, { expiresIn: "30d" });
}

/* =====================================================
✅ (NOUVEAU) Device login SANS OTP si même téléphone + actif
POST /api/otp/device-login
Body: { phone, deviceId }
- si OK => token direct
- sinon => REAUTH_REQUIRED / DEVICE_LOCKED / STORE_NOT_FOUND
===================================================== */
export const deviceLogin = async (req: Request, res: Response) => {
try {
const phone = normalizePhone(req.body?.phone);
const deviceId = safeTrim(req.body?.deviceId);

if (!phone) return res.status(400).json({ error: "Téléphone manquant" });
if (!deviceId) return res.status(400).json({ error: "deviceId manquant" });

const store = await Store.findOne({ phone });
if (!store) {
return res.status(404).json({ code: "STORE_NOT_FOUND", error: "Compte introuvable" });
}

// 🔐 device lock
if (store.deviceId && store.deviceId !== deviceId) {
return res.status(401).json({
code: "DEVICE_LOCKED",
error: "Ce compte est déjà utilisé sur un autre appareil",
});
}

// si jamais deviceId était vide (ancien compte), on le lie ici
if (!store.deviceId) {
store.deviceId = deviceId;
}

// ⏳ reauth après inactivité
if (shouldReauth((store as any).lastActiveAt)) {
return res.status(401).json({
code: "REAUTH_REQUIRED",
error: `Inactivité détectée (${REAUTH_DAYS} jours). Veuillez confirmer par OTP.`,
});
}

// ✅ store ok => user ok
const storeIdToUse = store._id.toString();

let user = await User.findOne({ phone });
if (!user) {
user = await User.create({
phone,
store: storeIdToUse as any,
role: "owner",
permissions: ["inventory", "sales", "reports", "stock", "orders", "employees"],
});
} else {
const currentStore = (user as any).store;
const isValidObjectIdString =
typeof currentStore === "string" && mongoose.Types.ObjectId.isValid(currentStore);

if (!isValidObjectIdString || currentStore !== storeIdToUse) {
(user as any).store = storeIdToUse;
}
// 🔧 Réparer permissions des anciens utilisateurs
if (!Array.isArray((user as any).permissions) || (user as any).permissions.length === 0) {
(user as any).permissions = ["inventory", "sales", "reports", "stock", "orders", "employees"];
}
await user.save();
}

// ✅ activity tracking
(store as any).lastActiveAt = new Date();
if (!(store as any).installedAt) (store as any).installedAt = store.createdAt || new Date();
if (typeof (store as any).isOnboarded !== "boolean") {
(store as any).isOnboarded = computeIsOnboarded(store);
}
await store.save();

const token = signToken({ userId: user._id.toString(), storeId: storeIdToUse, phone });

const isOnboarded =
typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: computeIsOnboarded(store);

return res.json({
message: "Connexion réussie",
token,
storeId: storeIdToUse,
user,
isOnboarded,
otpSkipped: true,
});
} catch (err: any) {
console.error("❌ deviceLogin error:", err?.message || err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
🔵 Demande OTP
POST /api/otp/request (ou /otp/send selon tes routes)
Body: { phone }
===================================================== */
export const requestOTP = async (req: Request, res: Response) => {
try {
const phone = normalizePhone(req.body?.phone);
if (!phone) return res.status(400).json({ error: "Téléphone manquant" });

const code = generateCode();

// Sauvegarde OTP temporaire (sur phone NORMALISÉ)
await OTP.findOneAndUpdate({ phone }, { phone, code }, { upsert: true, new: true });

await sendSMS(phone, `Votre code de connexion Vocoshop est : ${code}`);

return res.json({ message: "OTP envoyé" });
} catch (err) {
console.error("❌ requestOTP error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
🟣 Vérifie OTP
POST /api/otp/verify
✅ Lie Store + User + génère JWT
✅ Device lock STRICT V2 : relink seulement si forceRelink=true
Body: { phone, code, deviceId, forceRelink?, storeName? }
===================================================== */
export const verifyOTP = async (req: Request, res: Response) => {
try {
const phone = normalizePhone(req.body?.phone);
const code = safeTrim(req.body?.code);
const storeName = safeTrim(req.body?.storeName);
const deviceId = safeTrim(req.body?.deviceId);
const forceRelink = safeBool(req.body?.forceRelink);

if (!phone || !code) {
return res.status(400).json({ error: "Données manquantes" });
}
if (!deviceId) {
return res.status(400).json({ error: "deviceId manquant" });
}

const otp = await OTP.findOne({ phone, code });
if (!otp) return res.status(400).json({ error: "Code incorrect" });

// Nettoyer l’OTP après succès
await OTP.deleteOne({ _id: otp._id }).catch(() => {});

/* =========================
1) Trouver / créer STORE (sur phone normalisé)
========================= */
let store = await Store.findOne({ phone });

// ✅ tracking relink
let relinked = false;

if (!store) {
store = await Store.create({
phone,
storeName: storeName || "",
deviceId: deviceId || null,
// isOnboarded default false (schema)
});

// tracking install + activity
(store as any).installedAt = store.createdAt || new Date();
(store as any).lastActiveAt = new Date();
(store as any).isOnboarded = computeIsOnboarded(store);

await store.save();
} else {
// 🔐 Device lock STRICT
if (store.deviceId && store.deviceId !== deviceId) {
// si pas de forceRelink -> on bloque
if (!forceRelink) {
return res.status(401).json({
code: "DEVICE_LOCKED",
error: "Ce compte est déjà utilisé sur un autre appareil",
});
}

// ✅ forceRelink=true -> on autorise le relink + audit
store.deviceId = deviceId;

// ✅ AUDIT (si champs existent ou non, ça reste safe côté Mongo)
(store as any).deviceLastChangedAt = new Date();
(store as any).deviceChangeCount = Number((store as any).deviceChangeCount || 0) + 1;

relinked = true;
}

// Compléter storeName si manquant
if (storeName && !store.storeName) {
store.storeName = storeName;
}

// tracking install + activity
if (!(store as any).installedAt) (store as any).installedAt = store.createdAt || new Date();
(store as any).lastActiveAt = new Date();

// Cohérence isOnboarded (calcul)
const computedOnboarded = computeIsOnboarded(store);
if (
typeof (store as any).isOnboarded !== "boolean" ||
(store as any).isOnboarded !== computedOnboarded
) {
(store as any).isOnboarded = computedOnboarded;
}

await store.save();
}

const storeIdToUse = store._id.toString();

/* =========================
2) Trouver / créer USER (sur phone normalisé)
========================= */
let user = await User.findOne({ phone });

if (!user) {
user = await User.create({
phone,
store: storeIdToUse as any,
role: "owner",
permissions: ["inventory", "sales", "reports", "stock", "orders", "employees"],
});
} else {
// Réparer anciens users (store invalid)
const currentStore = (user as any).store;

const isValidObjectIdString =
typeof currentStore === "string" && mongoose.Types.ObjectId.isValid(currentStore);

if (!isValidObjectIdString || currentStore !== storeIdToUse) {
(user as any).store = storeIdToUse;
}
// 🔧 Réparer permissions des anciens utilisateurs
if (!Array.isArray((user as any).permissions) || (user as any).permissions.length === 0) {
(user as any).permissions = ["inventory", "sales", "reports", "stock", "orders", "employees"];
}
await user.save();
}

/* =========================
3) JWT (secret obligatoire)
========================= */
const token = signToken({ userId: user._id.toString(), storeId: storeIdToUse, phone });

const isOnboarded =
typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: computeIsOnboarded(store);

return res.json({
message: "Connexion réussie",
token,
storeId: storeIdToUse,
user,
isOnboarded,
relinked,
});
} catch (err) {
console.error("❌ verifyOTP error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
