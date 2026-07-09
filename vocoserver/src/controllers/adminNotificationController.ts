import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import AdminNotification from "../models/AdminNotification";
import Store from "../models/Store";
import { isValidObjectId } from "../utils/helpers";

/* =====================================================
POST /api/admin/notifications
Créer et envoyer une notification
Body: { title, message, type, targetType, targetId?, targetCity?, scheduledAt? }
===================================================== */
export const createAdminNotification = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { title, message, type, targetType, targetId, targetCity, scheduledAt } = req.body;

    if (!title || !message) {
      return next(new ValidationError("Titre et message requis"));
    }

    if (!["all_agents", "all_stores", "specific_agent", "specific_store", "by_city"].includes(targetType)) {
      return next(new ValidationError("Type de cible invalide"));
    }

    // Compute total recipients
    let total = 0;
    if (targetType === "all_agents") {
      const Agent = require("mongoose").connection.collection("agents");
      total = await Agent.countDocuments({ isApproved: true });
    } else if (targetType === "all_stores") {
      total = await Store.countDocuments();
    } else if (targetType === "specific_agent" || targetType === "specific_store") {
      total = targetId ? 1 : 0;
    } else if (targetType === "by_city") {
      total = await Store.countDocuments({ city: { $regex: (targetCity || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } });
    }

    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    const notification = await AdminNotification.create({
      title,
      message,
      type: type || "push",
      targetType,
      targetId: targetId || null,
      targetCity: targetCity || null,
      status: isScheduled ? "scheduled" : "sent",
      scheduledAt: isScheduled ? new Date(scheduledAt) : null,
      sentAt: isScheduled ? null : new Date(),
      stats: { total, read: 0, failed: 0 },
    });

    // If immediate push, also create per-store notifications
    if (!isScheduled && (type === "push" || !type)) {
      let storeIds: string[] = [];
      if (targetType === "all_stores") {
        const stores = await Store.find().select("_id").lean();
        storeIds = stores.map((s: any) => String(s._id));
      } else if (targetType === "by_city") {
        const stores = await Store.find({ city: { $regex: (targetCity || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }).select("_id").lean();
        storeIds = stores.map((s: any) => String(s._id));
      } else if (targetType === "specific_store" && targetId) {
        storeIds = [targetId];
      }

      if (storeIds.length > 0) {
        const Notification = require("../models/Notification").default;
        const entries = storeIds.map((storeId) => ({
          storeId,
          title,
          message,
          type: "system",
          isRead: false,
        }));
        await Notification.insertMany(entries).catch(() => {});
      }
    }

    res.status(201).json({ notification });
  });

/* =====================================================
GET /api/admin/notifications
Lister les notifications envoyées (paginated)
Query: page, limit, status
===================================================== */
export const getAdminNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10) || 20));
    const status = String(req.query.status || "").trim();

    const filter: any = {};
    if (status) filter.status = status;

    const [notifications, total] = await Promise.all([
      AdminNotification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminNotification.countDocuments(filter),
    ]);

    res.json({ notifications, meta: { page, limit, total } });
  });

/* =====================================================
GET /api/admin/notifications/:id
Détail d'une notification
===================================================== */
export const getAdminNotificationById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return next(new ValidationError("ID invalide"));
    const notification = await AdminNotification.findById(id).lean();
    if (!notification) {
      return next(new NotFoundError("Notification introuvable"));
    }
    res.json({ notification });
  });
