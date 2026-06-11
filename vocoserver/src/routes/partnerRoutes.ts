import { Router } from "express";
import { partnerAuth, requirePermission } from "../middleware/partnerAuth";
import { partnerLimiter } from "../middleware/rateLimiter";
import {
  partnerVerifyDocument,
  partnerVerifyScore,
  partnerVerifyByHash,
} from "../controllers/partnerController";

const router = Router();

router.use(partnerLimiter);
router.use(partnerAuth);

router.post("/documents/verify", requirePermission("verify:document"), partnerVerifyDocument);
router.get("/score/:storeId", requirePermission("verify:score"), partnerVerifyScore);
router.post("/hash/:hash/verify", requirePermission("verify:document"), partnerVerifyByHash);

export default router;
