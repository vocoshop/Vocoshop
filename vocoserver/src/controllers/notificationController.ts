import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import Notification from "../models/Notification";

/**
=====================================================
🔥 GET MY NOTIFICATIONS — V1 ULTRA PRO
👉 Liste des notifications pour la boutique
=====================================================
*/
export const getMyNotifications = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { storeId } = req.user || {};

if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const notifications = await Notification.find({ storeId })
.sort({ createdAt: -1 })
.limit(50)
.lean();

return res.json({
notifications,
});

});

/**
=====================================================
🔥 MARK AS READ — V1
=====================================================
*/
export const markNotificationRead = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { storeId } = req.user || {};
const { notificationId } = req.params;

if (!storeId || !notificationId) {
return next(new ValidationError("params manquants"));
}

await Notification.updateOne(
{ _id: notificationId, storeId },
{ $set: { isRead: true } }
);

return res.json({ success: true });

});

/**
=====================================================
🔥 GET UNREAD COUNT — POUR LA CLOCHE
=====================================================
*/
export const getUnreadCount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { storeId } = req.user || {};

if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const count = await Notification.countDocuments({
storeId,
isRead: false,
});

return res.json({
unread: count,
});

});
