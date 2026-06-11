import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import {
  listWithdrawals,
  processWithdrawal,
  getWithdrawalStats,
} from "../controllers/adminWithdrawalController";

const router = Router();

router.use(authMiddleware);
router.use(requireOwner);

router.get("/", listWithdrawals);
router.patch("/:id", processWithdrawal);
router.get("/stats", getWithdrawalStats);

export default router;
