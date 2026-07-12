import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import {
  sendInvitation,
  getPendingInvitation,
  acceptInvitation,
  declineInvitation,
  resendInvitation,
} from "../controllers/invitationController";

const router = Router();

router.get("/pending", getPendingInvitation);
router.post("/accept", acceptInvitation);
router.post("/decline", declineInvitation);
router.post("/send", authMiddleware, sendInvitation);
router.post("/resend", authMiddleware, resendInvitation);

export default router;
