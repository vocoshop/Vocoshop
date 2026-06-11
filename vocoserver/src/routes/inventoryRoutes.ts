// routes/inventoryRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requirePermission from "../middleware/permissionMiddleware";

import {
addStock,
removeStock,
getStockDiagnostic,
getRecommendations,
} from "../controllers/inventoryController";

import {
startInventorySession,
addInventoryLine,
validateInventorySession,
getInventorySession,
listInventorySessions,
analyzeInventorySession,
listEmployeeInventorySessions,
applyInventorySession,
getInventoryAppliedHistory,
listAppliedInventorySessions,
discardInventorySession, // ✅ AJOUT
} from "../controllers/inventorySessionController";

const router = Router();

router.use(authMiddleware);
router.use(requirePermission("inventory"));

/* =====================================================
🌿 INVENTAIRE — EMPLOYÉS (SAISIE)
===================================================== */
router.post("/session/start", startInventorySession);
router.post("/session/:sessionId/add-line", addInventoryLine);
router.post("/session/:sessionId/validate", validateInventorySession);
router.post("/session/:sessionId/discard", discardInventorySession); // ✅ AJOUT
router.get("/session/:sessionId", getInventorySession);
router.get("/my-sessions", listEmployeeInventorySessions);

/* =====================================================
📊 INVENTAIRE — PATRON (ANALYSE / APPLICATION)
===================================================== */
router.get("/sessions", listInventorySessions);
router.get("/session/:sessionId/analyze", analyzeInventorySession);
router.post("/session/:sessionId/apply", applyInventorySession);
router.get("/session/:sessionId/history", getInventoryAppliedHistory);
router.get("/applied-sessions", listAppliedInventorySessions);

/* =====================================================
📦 MOUVEMENTS DE STOCK (SIMPLE)
===================================================== */
router.post("/add", addStock);
router.post("/remove", removeStock);

/* =====================================================
🧠 DIAGNOSTIC & RECOMMANDATIONS
===================================================== */
router.get("/diagnostic", getStockDiagnostic);
router.get("/recommendations", getRecommendations);

export default router;
