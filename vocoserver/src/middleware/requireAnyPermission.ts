import { Request, Response, NextFunction } from "express";
import User from "../models/User";

type PermKey = "inventory" | "sales" | "reports" | "orders" | "employees";

export default function requireAnyPermission(...permissions: PermKey[]) {
return async (req: Request, res: Response, next: NextFunction) => {
try {
  const userId = String(req.user?.id || "");
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      // ✅ owner / admin : accès total (sans lookup User)
      const role = String(req.user?.role || "");
      if (role === "owner" || role === "admin" || userId.startsWith("owner:")) {
        return next();
      }

      const user = await User.findById(userId)
        .select("role isActive permissions")
        .lean();

if (!user) {
return res.status(401).json({ error: "Utilisateur introuvable" });
}

// ✅ owner / admin : accès total
if (user.role === "owner" || user.role === "admin") {
return next();
}

if (!user.isActive) {
return res.status(403).json({ error: "Compte désactivé" });
}

// ✅ au moins UNE permission suffit
const allowed = permissions.some(
(p) => (user.permissions as any)?.[p] === true
);

if (!allowed) {
return res.status(403).json({ error: "Accès refusé" });
}

next();
} catch (err) {
console.error("❌ requireAnyPermission:", err);
res.status(500).json({ error: "Erreur serveur" });
}
};
}
