import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import bcrypt from "bcryptjs";
import Store from "../models/Store";
import Subscription from "../models/Subscription";
import jwt from "jsonwebtoken";
import { normalizePhone } from "../utils/phone";

export const checkPhone = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const phone = normalizePhone(req.body?.phone);
if (!phone) return next(new ValidationError("Numero requis"));

// 1) Find direct store match (login phone)
const directStore = await Store.findOne({ phone })
  .select("passwordHash phoneVerified subscriptionActive ownerPhone storeName city")
  .lean();

// 2) Find stores by ownerPhone (the phone number alone might be the owner's personal phone)
const ownedStores = await Store.find({ ownerPhone: phone })
  .select("phone passwordHash phoneVerified subscriptionActive storeName city")
  .lean();

// 3) Merge — deduplicate by _id
const storeMap = new Map<string, any>();
if (directStore) storeMap.set(String(directStore._id), { ...directStore, matchType: "phone" });
for (const s of ownedStores) {
  if (!storeMap.has(String(s._id))) {
    storeMap.set(String(s._id), { ...s, matchType: "ownerPhone" });
  }
}
const allStores = Array.from(storeMap.values());

if (allStores.length === 0) {
  return res.json({ exists: false });
}

if (allStores.length === 1) {
  const s = allStores[0];
  return res.json({
    exists: true,
    hasPassword: !!s.passwordHash,
    phoneVerified: s.phoneVerified || false,
    subscriptionActive: s.subscriptionActive || false,
    multipleStores: false,
  });
}

// Multiple stores → return them for picker
return res.json({
  exists: true,
  multipleStores: true,
  stores: allStores.map((s) => ({
    _id: s._id,
    storeName: s.storeName,
    phone: s.phone,
    city: s.city,
    hasPassword: !!s.passwordHash,
  })),
});
});

function generateToken(storeId: string, phone?: string) {
return jwt.sign(
{ storeId, phone: phone || "" },
process.env.JWT_SECRET || "",
{ expiresIn: "30d" }
);
}

export const registerStore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { phone, password, storeName, ownerName, ownerPhone, deviceId, referralCodeUsed } = req.body;

const phoneNorm = normalizePhone(phone);
if (!phoneNorm) return next(new ValidationError("Numero requis"));

const exists = await Store.findOne({ phone: phoneNorm }).select("_id").lean();
if (exists) return next(new ValidationError("Ce numero est deja utilise"));

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
});

export const loginStore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { phone, password, deviceId } = req.body;

const phoneNorm = normalizePhone(phone);
if (!phoneNorm) return next(new ValidationError("Numero requis"));

const store = await Store.findOne({ phone: phoneNorm });
if (!store) return next(new NotFoundError("Compte introuvable"));

if (store.passwordHash) {
if (!password) return next(new ValidationError("Mot de passe requis"));

const valid = await bcrypt.compare(password, store.passwordHash);
if (!valid) return next(new UnauthorizedError("Mot de passe incorrect"));

  const updateFields: Record<string, any> = { lastActiveAt: new Date() };
  if (deviceId) updateFields.deviceId = deviceId;

  await Store.updateOne(
      { _id: store._id },
      { $inc: { loginCount: 1 }, $set: updateFields }
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
if (!password) return next(new ValidationError("Mot de passe requis"));
if (password.length < 6) return next(new ValidationError("Mot de passe trop court"));

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
});

export const getOwnerStores = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = req.user?.storeId;
if (!storeId) return next(new ValidationError("Authentification requise"));

const store = await Store.findById(storeId).select("ownerPhone phone").lean();
if (!store) return next(new NotFoundError("Boutique introuvable"));

const ownerPhone = store.ownerPhone || store.phone;

const stores = await Store.find({ ownerPhone })
  .select("_id storeName phone city")
  .lean();

return res.json({
  multipleStores: stores.length > 1,
  stores: stores.map((s) => ({
    _id: s._id,
    storeName: s.storeName,
    phone: s.phone,
    city: s.city,
  })),
});
});

export const autoLogin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { deviceId } = req.body;
  if (!deviceId) return next(new ValidationError("deviceId requis"));

  const store = await Store.findOne({ deviceId })
    .select("phone storeName isOnboarded phoneVerified subscriptionActive ownerPhone")
    .lean();

  if (!store) return next(new NotFoundError("Appareil non reconnu"));

  const token = generateToken(store._id.toString(), store.phone);

  return res.json({
    storeId: store._id,
    token,
    isOnboarded: !!(store.storeName && String(store.storeName).trim().length > 0),
    phoneVerified: store.phoneVerified || false,
    subscriptionActive: store.subscriptionActive || false,
  });
});

export const ownerSelectStore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const { phone, storeId } = req.body;
const phoneNorm = normalizePhone(phone);
if (!phoneNorm || !storeId) return next(new ValidationError("Numéro et boutique requis"));

const store = await Store.findById(storeId).lean();
if (!store) return next(new NotFoundError("Boutique introuvable"));

if (store.ownerPhone !== phoneNorm) {
return next(new UnauthorizedError("Vous n'êtes pas le propriétaire de cette boutique"));
}

const token = generateToken(store._id.toString(), store.phone);

return res.json({
storeId: store._id,
token,
isOnboarded: !!(store.storeName && String(store.storeName).trim().length > 0),
phoneVerified: store.phoneVerified || false,
subscriptionActive: store.subscriptionActive || false,
});
});
