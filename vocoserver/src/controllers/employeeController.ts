// controllers/employeeController.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { isValidObjectId } from "../utils/helpers";

function safePhone(p: any) {
return String(p || "").replace(/\s+/g, "").trim();
}

function signAppJwt(userId: string) {
return jwt.sign(
{ userId },
process.env.JWT_SECRET,
{ expiresIn: "30d" }
);
}

/**
* POST /api/employees
* (protégé : owner/admin)
* -> crée un employé INACTIF + génère un inviteToken (7 jours)
* -> le FRONT fabrique le lien deep-link lui-même (Expo)
*/
export const createEmployee = async (req: Request, res: Response) => {
try {
const storeId = String(req.user?.storeId || "");
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const phone = safePhone(req.body?.phone);
const name = String(req.body?.name || "").trim();
const role = (req.body?.role || "employee") as
| "employee"
| "inventorist"
| "admin";

// permissions = objet {inventory:true,...} (comme ton front)
const permissions =
req.body?.permissions && typeof req.body.permissions === "object"
? req.body.permissions
: {};

if (!phone) return res.status(400).json({ error: "Téléphone requis" });

const exists = await User.findOne({ phone }).lean();
if (exists) return res.status(400).json({ error: "Ce numéro est déjà utilisé" });

// ✅ créé désactivé tant qu'il n'a pas accepté
const user = await User.create({
phone,
name,
store: storeId,
role,
permissions,
isActive: false,
});

// ✅ token d’invitation (pas JWT final)
const inviteToken = jwt.sign(
{ userId: String(user._id), purpose: "employee_invite" },
process.env.JWT_SECRET,
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
inviteToken, // ✅ le front va générer le deep link
});
} catch (err) {
console.error("❌ createEmployee:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/**
* GET /api/employees/accept?token=...
* (PUBLIC)
* - valide le token d’invitation
* - active le compte
* - renvoie un vrai JWT APP
*/
export const acceptEmployeeInvite = async (req: Request, res: Response) => {
try {
const token = String(req.query?.token || "").trim();
if (!token) return res.status(400).json({ error: "Token manquant" });

let decoded: any;
try {
decoded = jwt.verify(token, process.env.JWT_SECRET);
} catch {
return res.status(400).json({ error: "Token invalide ou expiré" });
}

if (!decoded?.userId || decoded?.purpose !== "employee_invite") {
return res.status(400).json({ error: "Token invalide" });
}

const user = await User.findById(decoded.userId);
if (!user) return res.status(404).json({ error: "Employé introuvable" });

if ((user as any).role === "owner") {
return res.status(403).json({ error: "Invitation invalide" });
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
// storeType si tu le gères côté backend : ajoute-le ici si tu veux
// storeType: ...
});
} catch (err) {
console.error("❌ acceptEmployeeInvite:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

export const listEmployees = async (req: Request, res: Response) => {
try {
const storeId = String(req.user?.storeId || "");
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const list = await User.find({
store: storeId,
role: { $ne: "owner" },
deletedAt: null, // ✅ ICI : on cache les employés supprimés
})
.select("_id phone name role permissions isActive createdAt lastLoginAt")
.sort({ createdAt: -1 })
.lean();

return res.json(list);
} catch (err) {
console.error("❌ listEmployees:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

export const updateEmployee = async (req: Request, res: Response) => {
try {
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

if (!user) return res.status(404).json({ error: "Employé introuvable" });

return res.json(user);
} catch (err) {
console.error("❌ updateEmployee:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

// ✅ TOGGLE réel (ON/OFF)
export const toggleEmployee = async (req: Request, res: Response) => {
try {
const storeId = String(req.user?.storeId || "");
const employeeId = String(req.params.id || "");
if (!isValidObjectId(employeeId)) return res.status(400).json({ error: "ID employé invalide" });

const user = await User.findOne({ _id: employeeId, store: storeId });
if (!user) return res.status(404).json({ error: "Employé introuvable" });

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
} catch (err) {
console.error("❌ toggleEmployee:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

// ✅ DELETE (pour corriger ton 404)
export const deleteEmployee = async (req: Request, res: Response) => {
try {
const storeId = String(req.user?.storeId || "");
const employeeId = String(req.params.id || "");
if (!isValidObjectId(employeeId)) return res.status(400).json({ error: "ID employé invalide" });

const user = await User.findOne({ _id: employeeId, store: storeId });
if (!user) return res.status(404).json({ error: "Employé introuvable" });

if (user.role === "owner") return res.status(403).json({ error: "Action interdite" });

// ✅ soft delete + libérer l'unicité phone
const oldPhone = String(user.phone);
const stamp = Date.now();
user.phoneOriginal = user.phoneOriginal || oldPhone;
user.phone = `${oldPhone}__deleted__${stamp}`;
user.isActive = false;
(user as any).deletedAt = new Date();

await user.save();

return res.json({ message: "Employé supprimé", _id: user._id });
} catch (err) {
console.error("❌ deleteEmployee:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};