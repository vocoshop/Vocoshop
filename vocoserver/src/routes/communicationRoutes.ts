import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import { sendCommunication, getCommunicationStats, getCommunicationHistory } from "../controllers/communicationController";

const router = Router();

// Toutes les routes communication nécessitent admin + owner
router.use(authMiddleware, requireOwner);

// GET /api/admin/communication/stats
router.get("/stats", getCommunicationStats);

// POST /api/admin/communication/send
router.post("/send", sendCommunication);

// GET /api/admin/communication/history
router.get("/history", getCommunicationHistory);

export default router;
