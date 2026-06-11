import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  scanDocument,
  validateScan,
  importScan,
  getScanHistory,
  getScanById,
  getAliases,
  analyzeQuality,
} from "../controllers/ocrController";

const router = Router();
router.use(authMiddleware);

router.post("/scan", scanDocument);
router.post("/validate/:id", validateScan);
router.post("/import/:id", importScan);
router.post("/analyze", analyzeQuality);
router.get("/history", getScanHistory);
router.get("/scan/:id", getScanById);
router.get("/aliases", getAliases);

export default router;
