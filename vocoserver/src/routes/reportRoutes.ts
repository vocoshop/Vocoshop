// routes/reportRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requirePermission from "../middleware/permissionMiddleware";

import {
getReportKpis,
getInventoryDiffs,
getTodayReport,
closeDayReport,
getReportHistory,
createMonthlyShareLink,
revokeShareLink,
} from "../controllers/reportController";

const router = Router();

/**
* ✅ ROUTES PRIVÉES
* - Auth obligatoire
* - Permission "reports" obligatoire
* Base mount: /api/report
*/
router.use(authMiddleware);
router.use(requirePermission("reports"));

/* =========================
KPI / STOCK / HISTORY
========================= */
router.get("/kpis", getReportKpis);
router.get("/inventory-diffs", getInventoryDiffs);
router.get("/today", getTodayReport);
router.get("/history", getReportHistory);

/* =========================
CLOSE DAY
========================= */
router.post("/close-day", closeDayReport);

/* =========================
SHARE LINKS (PRIVÉ)
POST /api/report/share/month
POST /api/report/share/:id/revoke
========================= */
router.post("/share/month", createMonthlyShareLink);
router.post("/share/:id/revoke", revokeShareLink);

export default router;
