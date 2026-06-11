// middleware/permissionMiddleware.ts
import { Request, Response, NextFunction } from "express";
import User from "../models/User";

type PermKey = "inventory" | "sales" | "reports" | "orders" | "employees";

export default function requirePermission(permission: PermKey) {
return async (req: Request, res: Response, next: NextFunction) => {
try {
// ✅ 1) Si authMiddleware a déjà donné full access
const role = String(req.user?.role || "");
const perms = req.user?.permissions || {};

if (role === "owner" || role === "admin" || perms["*"] === true) {
return next();
}

// ✅ 2) Employé uniquement : userId doit être un vrai ObjectId string
const userId = String(req.user?.userId || "");
if (!userId) return res.status(401).json({ error: "Non authentifié" });

// ✅ 3) Bloquer le cas “owner:xxx” (virtuel) si jamais ça arrive ici
if (userId.startsWith("owner:")) {
return next();
}

// ✅ 4) Charger user (sécurité : permissions/active à jour)
const user = await User.findById(userId).select("role isActive permissions").lean();
if (!user) return res.status(401).json({ error: "Utilisateur introuvable" });

if ((user as any).role === "owner" || (user as any).role === "admin") {
return next();
}

if ((user as any).isActive === false) {
return res.status(403).json({ error: "Compte désactivé" });
}

// ✅ 5) Permission objet { inventory:true, sales:true, ... }
const allowed = !!(user as any)?.permissions?.[permission];
if (!allowed) return res.status(403).json({ error: "Accès refusé" });

return next();
} catch (e) {
console.error("❌ requirePermission:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};
}
