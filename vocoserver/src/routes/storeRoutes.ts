// routes/storeRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";

import {
getMyStoreProfile,
getStoreKpis,
updateStoreOnboarding,
getMyAgent, // ✅ ajouté ici
} from "../controllers/storeController";

import { getStoreAnalysis } from "../controllers/storeAnalysisController";

const router = Router();

/* =====================================================
🔐 Toutes les routes STORE protégées
Base mount: /api/store
===================================================== */
router.use(authMiddleware);

/* =====================================================
👤 PROFIL BOUTIQUE
GET /api/store/me
===================================================== */
router.get("/me", getMyStoreProfile);

/* =====================================================
👤 UTILISATEUR CONNECTÉ (permissions, rôle, etc.)
GET /api/store/me/user
===================================================== */
router.get("/me/user", (req: any, res) => {
const user = req.user || null;
if (!user) return res.status(401).json({ error: "Non authentifié" });
res.json(user);
});

/* =====================================================
📊 KPIs BOUTIQUE
GET /api/store/kpis
===================================================== */
router.get("/kpis", getStoreKpis);

/* =====================================================
📈 ANALYSE BOUTIQUE
GET /api/store/analysis
===================================================== */
router.get("/analysis", getStoreAnalysis);

/* =====================================================
🧑‍💼 MON AGENT
GET /api/store/my-agent
===================================================== */
router.get("/my-agent", getMyAgent);

/* =====================================================
🧾 ONBOARDING APRÈS OTP
PATCH /api/store/onboarding
===================================================== */
router.patch("/onboarding", updateStoreOnboarding);

export default router;
