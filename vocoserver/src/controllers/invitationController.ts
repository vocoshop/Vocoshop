import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError } from "../utils/AppError";
import StoreInvitation from "../models/StoreInvitation";
import Store from "../models/Store";
import User from "../models/User";
import Notification from "../models/Notification";
import { PushNotificationService } from "../services/pushNotificationService";
import { getStoreId } from "../utils/storeId";

/* =====================================================
POST /api/invitations/send
Crée une invitation propriétaire (appelé après création boutique)
===================================================== */
export const sendInvitation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("Authentification requise"));

  const { ownerPhone, ownerName } = req.body;
  if (!ownerPhone) return next(new ValidationError("Téléphone du propriétaire requis"));

  const store = await Store.findById(storeId);
  if (!store) return next(new NotFoundError("Boutique introuvable"));

  // Désactiver les invitations précédentes en attente pour ce store
  await StoreInvitation.updateMany(
    { storeId: store._id, status: "pending" },
    { $set: { status: "cancelled" } }
  );

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await StoreInvitation.create({
    storeId: store._id,
    phone: ownerPhone,
    ownerName: ownerName || "",
    token,
    status: "pending",
    invitedBy: req.user?.userId || req.user?.id || "",
    expiresAt,
  });

  // Marquer le store comme en attente
  store.ownershipStatus = "pending_invite";
  if (ownerPhone) store.ownerPhone = ownerPhone;
  if (ownerName) store.ownerName = ownerName;
  await store.save();

  res.status(201).json({
    message: "Invitation créée",
    invitation: {
      id: invitation._id,
      phone: invitation.phone,
      ownerName: invitation.ownerName,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    },
    shareLink: `vocoshop://accept-invitation?token=${token}`,
  });
});

/* =====================================================
GET /api/invitations/pending?phone=
Vérifie si un numéro a une invitation en attente
===================================================== */
export const getPendingInvitation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { phone } = req.query;
  if (!phone || typeof phone !== "string") return next(new ValidationError("Numéro requis"));

  const invitation = await StoreInvitation.findOne({
    phone,
    status: "pending",
    expiresAt: { $gt: new Date() },
  }).populate("storeId", "storeName city shopId").lean();

  if (!invitation) {
    return res.json({ hasInvitation: false });
  }

  const store = invitation.storeId as any;

  res.json({
    hasInvitation: true,
    invitation: {
      id: invitation._id,
      storeName: store?.storeName || "Boutique",
      shopId: store?.shopId || "",
      city: store?.city || "",
      ownerName: invitation.ownerName,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    },
  });
});

/* =====================================================
POST /api/invitations/accept
Accepter l'invitation avec token unique
===================================================== */
export const acceptInvitation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;
  if (!token) return next(new ValidationError("Token requis"));

  const invitation = await StoreInvitation.findOne({ token });
  if (!invitation) return next(new NotFoundError("Invitation introuvable ou invalide"));
  if (invitation.status !== "pending") return next(new ValidationError("Cette invitation n'est plus valide"));
  if (invitation.expiresAt < new Date()) {
    invitation.status = "expired";
    await invitation.save();
    return next(new ValidationError("Cette invitation a expiré"));
  }

  const store = await Store.findById(invitation.storeId);
  if (!store) return next(new NotFoundError("Boutique introuvable"));

  // Vérifier que l'utilisateur connecté correspond au numéro de l'invitation
  const userId = req.user?.userId || req.user?.id || "";
  const userPhone = req.user?.phone || "";

  // Si l'utilisateur a un userId et un store dans le token, vérifier
  if (userId && !userId.startsWith("owner:")) {
    const user = await User.findById(userId);
    if (user) {
      // Vérifier le numéro de téléphone
      if (user.phone !== invitation.phone) {
        return next(new ValidationError("Cette invitation ne correspond pas à ton compte"));
      }
    }
  }

  // Mettre à jour le store
  store.ownershipStatus = "active";
  if (!store.ownerName && invitation.ownerName) store.ownerName = invitation.ownerName;
  if (!store.ownerPhone) store.ownerPhone = invitation.phone;
  await store.save();

  // Mettre à jour l'invitation
  invitation.status = "accepted";
  invitation.acceptedAt = new Date();
  await invitation.save();

  // Si l'utilisateur a un compte User, le passer en role owner
  if (userId && !userId.startsWith("owner:")) {
    await User.findByIdAndUpdate(userId, { role: "owner" });
  }

  // Notifier l'admin de la boutique que le propriétaire a accepté
  try {
    await Notification.create({
      storeId: store._id,
      title: "Propriétaire activé",
      message: `Le propriétaire ${invitation.ownerName || "de la boutique"} a accepté l'invitation. Les droits de propriété lui ont été transférés.`,
      type: "system",
    });
    await PushNotificationService.sendToStore(
      store._id.toString(),
      "Propriétaire activé 🎉",
      `Le propriétaire ${invitation.ownerName || "de la boutique"} a accepté l'invitation. Les droits de propriété ont été transférés avec succès.`,
      { type: "ownership_transferred" }
    );
  } catch (e) {
    console.error("❌ Erreur notification acceptation:", e);
  }

  res.json({
    message: "Félicitations ! Tu es maintenant propriétaire de la boutique.",
    storeId: store._id,
    storeName: store.storeName,
  });
});

/* =====================================================
POST /api/invitations/decline
Refuser l'invitation
===================================================== */
export const declineInvitation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body;
  if (!token) return next(new ValidationError("Token requis"));

  const invitation = await StoreInvitation.findOne({ token, status: "pending" });
  if (!invitation) return next(new NotFoundError("Invitation introuvable"));

  invitation.status = "cancelled";
  await invitation.save();

  res.json({ message: "Invitation refusée" });
});

/* =====================================================
POST /api/invitations/resend
Renvoyer une invitation (nouveau token)
===================================================== */
export const resendInvitation = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("Authentification requise"));

  const store = await Store.findById(storeId);
  if (!store) return next(new NotFoundError("Boutique introuvable"));

  if (!store.ownerPhone) return next(new ValidationError("Aucun téléphone propriétaire enregistré"));

  // Désactiver les anciennes invitations
  await StoreInvitation.updateMany(
    { storeId: store._id, status: "pending" },
    { $set: { status: "cancelled" } }
  );

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await StoreInvitation.create({
    storeId: store._id,
    phone: store.ownerPhone,
    ownerName: store.ownerName || "",
    token,
    status: "pending",
    invitedBy: req.user?.userId || req.user?.id || "",
    expiresAt,
  });

  res.status(201).json({
    message: "Nouvelle invitation envoyée",
    invitation: {
      id: invitation._id,
      phone: invitation.phone,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    },
    shareLink: `vocoshop://accept-invitation?token=${token}`,
  });
});
