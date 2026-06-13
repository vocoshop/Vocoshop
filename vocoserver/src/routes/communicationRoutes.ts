import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { sendCommunication, getCommunicationStats } from "../controllers/communicationController";

const router = Router();

// GET /api/admin/communication/stats — nombre de destinataires par catégorie
router.get("/stats", authMiddleware, getCommunicationStats);

// POST /api/admin/communication/send — envoyer SMS ou WhatsApp
router.post("/send", authMiddleware, sendCommunication);

// GET /api/admin/communication/history — historique (pour l'instant retourne une liste vide, à implémenter plus tard)
router.get("/history", authMiddleware, async (_req, res) => {
  return res.json({ messages: [], total: 0 });
});

export default router;
