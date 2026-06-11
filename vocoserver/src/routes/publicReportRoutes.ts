// routes/publicReportRoutes.ts
import { Router } from "express";
import { viewSharedReport, downloadSharedReportPdf, verifySharedReport } from "../controllers/reportController";

const router = Router();

// PUBLIC (no auth)
router.get("/share/:id", viewSharedReport);
router.get("/share/:id/pdf", downloadSharedReportPdf);
router.get("/verify/:id", verifySharedReport);

export default router;
