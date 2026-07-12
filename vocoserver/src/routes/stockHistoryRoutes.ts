// routes/stockHistoryRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requirePermission from "../middleware/permissionMiddleware";

import {
listStockHistory,
historyBySession,
historyByProduct,
listAppliedInventorySessions,
getAppliedInventoryDetail,
listAllStockOperations,
} from "../controllers/stockHistoryController";

const router = Router();

/**
* 🔐 Toutes les routes sont protégées
* - Auth obligatoire
* - Permission "inventory" obligatoire
*/
router.use(authMiddleware);
router.use(requirePermission("inventory"));

router.get("/", listStockHistory);
router.get("/by-session/:sessionId", historyBySession);
router.get("/product/:productId", historyByProduct);
router.get("/all", listAllStockOperations);
router.get("/sessions", listAppliedInventorySessions);
router.get("/session/:sessionId", getAppliedInventoryDetail);

export default router;
