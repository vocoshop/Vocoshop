import express from "express";
import { paymentWebhook } from "../controllers/paymentWebhookController";

const router = express.Router();

/**
* 🔥 ROUTE PUBLIQUE (PAS D'AUTH)
* Les providers doivent pouvoir appeler cette route
*/
router.post("/subscription", paymentWebhook);

export default router;
