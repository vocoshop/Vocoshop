import { Request, Response, NextFunction } from "express";
import Store from "../models/Store";

/**
 * Middleware: vérifie que l'utilisateur est bien le propriétaire réel de la boutique.
 *
 * - Si `req.user.role === "owner"` ET la boutique a `ownershipStatus === "active"` → OK
 * - Si la boutique a `ownershipStatus === "pending_invite"` → bloqué (propriétaire pas encore accepté)
 * - Sinon → bloqué
 */
export default async function requireStoreOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise" });
  }

  const storeId = req.user.storeId;
  if (!storeId) {
    return res.status(403).json({ error: "Accès réservé au propriétaire de la boutique" });
  }

  // Si le rôle n'est pas "owner", bloquer directement
  if (req.user.role !== "owner") {
    return res.status(403).json({
      error: "Réservé au propriétaire",
      message: "Cette fonctionnalité est réservée au propriétaire de la boutique. Le propriétaire doit accepter son invitation pour effectuer cette action.",
      code: "OWNER_ONLY",
    });
  }

  // Vérifier le statut de propriété dans la base
  try {
    const store = await Store.findById(storeId).select("ownershipStatus").lean();
    if (!store) {
      return res.status(404).json({ error: "Boutique introuvable" });
    }

    if (store.ownershipStatus === "pending_invite") {
      return res.status(403).json({
        error: "Propriétaire en attente",
        message: "Cette fonctionnalité est réservée au propriétaire de la boutique. Le propriétaire doit accepter son invitation pour effectuer cette action.",
        code: "OWNER_PENDING",
      });
    }
  } catch {
    return res.status(500).json({ error: "Erreur de vérification" });
  }

  next();
}
