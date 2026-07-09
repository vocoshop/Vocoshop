// controllers/employeeController.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { isValidObjectId } from "../utils/helpers";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, ForbiddenError } from "../utils/AppError";

function safePhone(p: any) {
return String(p || "").replace(/\s+/g, "").trim();
}

function signAppJwt(userId: string) {
return jwt.sign(
{ userId },
process.env.JWT_SECRET!,
{ expiresIn: "30d" }
);
}

/**
* POST /api/employees
* (protégé : owner/admin)
* -> crée un employé INACTIF + génère un inviteToken (7 jours)
* -> le FRONT fabrique le lien deep-link lui-même (Expo)
*/
export const createEmployee = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = String(req.user?.storeId || "");
if (!storeId) return next(new ValidationError("storeId manquant"));

const phone = safePhone(req.body?.phone);
const name = String(req.body?.name || "").trim();
const role = (req.body?.role || "employee") as
| "employee"
| "inventorist"
| "admin";

const permissions =
req.body?.permissions && typeof req.body.permissions === "object"
? req.body.permissions
: {};

if (!phone) return next(new ValidationError("Téléphone requis"));

const exists = await User.findOne({ phone }).lean();
if (exists) return next(new ValidationError("Ce numéro est déjà utilisé"));

const user = await User.create({
phone,
name,
store: storeId,
role,
permissions,
isActive: false,
});

const inviteToken = jwt.sign(
{ userId: String(user._id), purpose: "employee_invite" },
process.env.JWT_SECRET!,
{ expiresIn: "7d" }
);

return res.json({
message: "Employé créé",
employee: {
_id: user._id,
phone: user.phone,
name: user.name,
role: user.role,
permissions: user.permissions,
isActive: user.isActive,
createdAt: user.createdAt,
},
inviteToken,
});
});

/**
* GET /api/employees/accept?token=...
* (PUBLIC)
* - valide le token d'invitation
* - active le compte
* - renvoie un vrai JWT APP
*/
export const acceptEmployeeInvite = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const token = String(req.query?.token || "").trim();
if (!token) return next(new ValidationError("Token manquant"));

let decoded: any;
try {
decoded = jwt.verify(token, process.env.JWT_SECRET!);
} catch {
return next(new ValidationError("Token invalide ou expiré"));
}

if (!decoded?.userId || decoded?.purpose !== "employee_invite") {
return next(new ValidationError("Token invalide"));
}

const user = await User.findById(decoded.userId);
if (!user) return next(new NotFoundError("Employé introuvable"));

if ((user as any).role === "owner") {
return next(new ForbiddenError("Invitation invalide"));
}

user.isActive = true;
(user as any).lastLoginAt = new Date();
await user.save();

const appJwt = signAppJwt(String(user._id));

return res.json({
message: "Invitation acceptée",
token: appJwt,
storeId: String(user.store),
user: {
_id: user._id,
phone: user.phone,
name: (user as any).name,
role: (user as any).role,
permissions: (user as any).permissions,
isActive: (user as any).isActive,
},
});
});

export const listEmployees = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = String(req.user?.storeId || "");
if (!storeId) return next(new ValidationError("storeId manquant"));

const list = await User.find({
store: storeId,
role: { $ne: "owner" },
deletedAt: null,
})
.select("_id phone name role permissions isActive createdAt lastLoginAt")
.sort({ createdAt: -1 })
.lean();

return res.json(list);
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = String(req.user?.storeId || "");
const employeeId = String(req.params.id || "");

const patch: any = {};
if (req.body?.name !== undefined) patch.name = String(req.body.name || "").trim();
if (req.body?.role !== undefined) patch.role = req.body.role;
if (req.body?.permissions !== undefined && typeof req.body.permissions === "object") {
patch.permissions = req.body.permissions;
}

const user = await User.findOneAndUpdate(
{ _id: employeeId, store: storeId },
{ $set: patch },
{ new: true }
)
.select("_id phone name role permissions isActive createdAt lastLoginAt")
.lean();

if (!user) return next(new NotFoundError("Employé introuvable"));

return res.json(user);
});

export const toggleEmployee = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = String(req.user?.storeId || "");
const employeeId = String(req.params.id || "");
if (!isValidObjectId(employeeId)) return next(new ValidationError("ID employé invalide"));

const user = await User.findOne({ _id: employeeId, store: storeId });
if (!user) return next(new NotFoundError("Employé introuvable"));

user.isActive = !user.isActive;
await user.save();

return res.json({
_id: user._id,
phone: user.phone,
name: (user as any).name,
role: (user as any).role,
permissions: (user as any).permissions,
isActive: (user as any).isActive,
createdAt: user.createdAt,
lastLoginAt: (user as any).lastLoginAt ?? null,
});
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = String(req.user?.storeId || "");
const employeeId = String(req.params.id || "");
if (!isValidObjectId(employeeId)) return next(new ValidationError("ID employé invalide"));

const user = await User.findOne({ _id: employeeId, store: storeId });
if (!user) return next(new NotFoundError("Employé introuvable"));

if (user.role === "owner") return next(new ForbiddenError("Action interdite"));

const oldPhone = String(user.phone);
const stamp = Date.now();
user.phoneOriginal = user.phoneOriginal || oldPhone;
user.phone = `${oldPhone}__deleted__${stamp}`;
user.isActive = false;
(user as any).deletedAt = new Date();

await user.save();

return res.json({ message: "Employé supprimé", _id: user._id });
});
