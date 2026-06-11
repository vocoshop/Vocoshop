import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  certifyDocumentHandler,
  verifyDocumentHandler,
  listCertificationsHandler,
  certifyScoreHandler,
  getScoreHandler,
  verifyScoreHandler,
  getScoreHistoryHandler,
  getPublicProofsHandler,
} from "../controllers/blockchainController";

const router = Router();

router.get("/proofs", getPublicProofsHandler);

router.use(authMiddleware);

router.post("/documents/certify", certifyDocumentHandler);
router.post("/documents/verify/:id", verifyDocumentHandler);
router.get("/documents", listCertificationsHandler);

router.post("/score/certify", certifyScoreHandler);
router.get("/score", getScoreHandler);
router.get("/score/verify", verifyScoreHandler);
router.get("/score/history", getScoreHistoryHandler);

export default router;
