// routes/storeAnalysisRoutes.ts
import { Router } from "express";
import storeAuth from "../middleware/storeAuth";
import { getStoreAnalysis } from "../controllers/storeAnalysisController";

const router = Router();

router.use(storeAuth);

/**
* GET /api/store/analysis?from=YYYY-MM-DD&to=YYYY-MM-DD
* - sans params => aujourd’hui
*/
router.get("/", getStoreAnalysis);

export default router;
