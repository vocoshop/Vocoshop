import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { sendCommunication, getCommunicationStats, getCommunicationHistory } from "../controllers/communicationController";

const router = Router();

// GET /api/admin/communication/stats — nombre de destinataires par catégorie
router.get("/stats", authMiddleware, getCommunicationStats);

// POST /api/admin/communication/send — envoyer SMS ou WhatsApp
router.post("/send", authMiddleware, sendCommunication);

// GET /api/admin/communication/history — historique paginé
router.get("/history", authMiddleware, getCommunicationHistory);

export default router;
