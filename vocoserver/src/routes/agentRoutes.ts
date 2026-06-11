// routes/agentRoutes.ts
import { Router } from "express";
import agentAuthMiddleware from "../middleware/agentAuthMiddleware";

import {
loginAgent,
completeFirstLogin,
getAgentMe,
listAgentStores,
getAgentKpis,
getAgentAnalysis,
sendAgentOTP,
verifyAgentOTP,
forgotPassword,
getCommissions,
} from "../controllers/agentController";

const router = Router();

// PUBLIC
router.post("/auth/login", loginAgent);
router.post("/auth/otp/send", sendAgentOTP);
router.post("/auth/otp/verify", verifyAgentOTP);
router.post("/auth/forgot-password", forgotPassword);

// PROTECTED
router.use(agentAuthMiddleware);

router.post("/auth/complete-first-login", completeFirstLogin);
router.get("/me", getAgentMe);
router.get("/stores", listAgentStores);
router.get("/kpis", getAgentKpis);
router.get("/analysis", getAgentAnalysis);
router.get("/commissions", getCommissions);

export default router;
