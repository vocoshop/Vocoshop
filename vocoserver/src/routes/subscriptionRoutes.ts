import express from "express";
import authMiddleware from "../middleware/authMiddleware";

import { evaluateSubscription } from "../services/subscriptionEngine";

import {
activateSubscription,
cancelSubscription,
} from "../controllers/subscriptionController";

const router = express.Router();

/**
* =====================================================
* 🔥 GET /api/subscription/me
* Route officielle utilisée par le SubscriptionContext
* =====================================================
*/
router.get("/me", authMiddleware, async (req: any, res) => {
try {
const storeId = req.user?.storeId;

if (!storeId) {
return res.status(400).json({
error: "storeId manquant",
});
}

// 🔥 moteur principal abonnement
const sub = await evaluateSubscription(storeId);

if (!sub) {
return res.json({
status: "trial",
});
}

return res.json(sub);
} catch (e) {
console.log("❌ subscription route error", e);

return res.status(500).json({
error: "subscription error",
});
}
});

/**
* =====================================================
* 🔥 ACTIVER ABONNEMENT
* Lance seulement le paiement (le webhook activera)
* =====================================================
*/
router.post("/activate", authMiddleware, activateSubscription);

/**
* =====================================================
* 🔥 ANNULER ABONNEMENT
* Désactive seulement autoRenew
* =====================================================
*/
router.post("/cancel", authMiddleware, cancelSubscription);

export default router;
