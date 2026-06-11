// routes/salesRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requirePermission from "../middleware/permissionMiddleware";
import { validate, addSaleSchema } from "../middleware/validate";

import {
  addSale,
  addCartSales,
  getTodaySales,
  closeDaySales,
  getDailyReports,
  getTodayReport,
  getReportById,
  revertSale, // ✅ NOUVEAU
} from "../controllers/salesController";

const router = Router();

/* =====================================================
🔐 ROUTES PROTÉGÉES
- Auth obligatoire
- Permission "sales" obligatoire
===================================================== */
router.use(authMiddleware);
router.use(requirePermission("sales"));

/* =====================================================
➕ AJOUT VENTES
===================================================== */
router.post("/add", validate(addSaleSchema), addSale);
router.post("/cart", addCartSales);

/* =====================================================
🔁 ANNULATION VENTE (VOICE UNDO)
===================================================== */
router.post("/revert", revertSale);

/* =====================================================
📅 VENTES DU JOUR (AVANT CLÔTURE)
===================================================== */
router.get("/today", getTodaySales);

/* =====================================================
🏁 CLÔTURE DE LA JOURNÉE
===================================================== */
router.post("/close-day", closeDaySales);

/* =====================================================
📊 RAPPORT DU JOUR (APRÈS CLÔTURE)
⚠️ DOIT ÊTRE AVANT /reports
===================================================== */
router.get("/reports/today", getTodayReport);

/* =====================================================
📄 DÉTAIL D’UN BILAN (PAR ID)
===================================================== */
router.get("/reports/:id", getReportById);

/* =====================================================
🧾 HISTORIQUE DES BILANS
===================================================== */
router.get("/reports", getDailyReports);

export default router;
