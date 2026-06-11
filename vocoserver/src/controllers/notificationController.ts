import { Request, Response } from "express";
import Notification from "../models/Notification";

/**
=====================================================
🔥 GET MY NOTIFICATIONS — V1 ULTRA PRO
👉 Liste des notifications pour la boutique
=====================================================
*/
export const getMyNotifications = async (req: Request, res: Response) => {
try {
const { storeId } = req.user || {};

if (!storeId) {
return res.status(400).json({ error: "storeId manquant" });
}

const notifications = await Notification.find({ storeId })
.sort({ createdAt: -1 })
.limit(50)
.lean();

return res.json({
notifications,
});

} catch (e) {
console.error("❌ getMyNotifications error", e);
return res.status(500).json({ error: "failed" });
}
};


/**
=====================================================
🔥 MARK AS READ — V1
=====================================================
*/
export const markNotificationRead = async (req: Request, res: Response) => {
try {
const { storeId } = req.user || {};
const { notificationId } = req.params;

if (!storeId || !notificationId) {
return res.status(400).json({ error: "params manquants" });
}

await Notification.updateOne(
{ _id: notificationId, storeId },
{ $set: { isRead: true } }
);

return res.json({ success: true });

} catch (e) {
console.error("❌ markNotificationRead error", e);
return res.status(500).json({ error: "failed" });
}
};


/**
=====================================================
🔥 GET UNREAD COUNT — POUR LA CLOCHE
=====================================================
*/
export const getUnreadCount = async (req: Request, res: Response) => {
try {
const { storeId } = req.user || {};

if (!storeId) {
return res.status(400).json({ error: "storeId manquant" });
}

const count = await Notification.countDocuments({
storeId,
isRead: false,
});

return res.json({
unread: count,
});

} catch (e) {
console.error("❌ getUnreadCount error", e);
return res.status(500).json({ error: "failed" });
}
};
