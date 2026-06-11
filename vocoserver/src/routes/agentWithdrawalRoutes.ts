import { Router } from "express";
import agentAuthMiddleware from "../middleware/agentAuthMiddleware";
import {
  createWithdrawal,
  listMyWithdrawals,
  getMyBalance,
} from "../controllers/withdrawalController";

const router = Router();

router.use(agentAuthMiddleware);

router.post("/", createWithdrawal);
router.get("/", listMyWithdrawals);
router.get("/balance", getMyBalance);

export default router;
