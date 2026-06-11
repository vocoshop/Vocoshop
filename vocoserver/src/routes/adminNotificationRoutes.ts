// routes/adminNotificationRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import {
  createAdminNotification,
  getAdminNotifications,
  getAdminNotificationById,
} from "../controllers/adminNotificationController";

const router = Router();

router.use(authMiddleware);
router.use(requireOwner);

router.post("/", createAdminNotification);
router.get("/", getAdminNotifications);
router.get("/:id", getAdminNotificationById);

export default router;
