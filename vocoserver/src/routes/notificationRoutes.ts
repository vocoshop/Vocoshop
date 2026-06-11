import { Router } from "express";
import {
getMyNotifications,
markNotificationRead,
getUnreadCount,
} from "../controllers/notificationController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

/* =====================================================
🔔 GET LISTE NOTIFICATIONS
GET /api/notifications
===================================================== */
router.get("/", authMiddleware, getMyNotifications);

/* =====================================================
🔔 BADGE CLOCHE (COUNT)
GET /api/notifications/unread
===================================================== */
router.get("/unread", authMiddleware, getUnreadCount);

/* =====================================================
🔔 MARK AS READ
PATCH /api/notifications/:notificationId/read
===================================================== */
router.patch("/:notificationId/read", authMiddleware, markNotificationRead);

export default router;
