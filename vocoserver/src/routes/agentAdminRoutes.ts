// routes/agentAdminRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";

import {
createAgent,
listAgents,
setAgentStatus,
resetAgentPassword,
approveAgent,
rejectAgent,
} from "../controllers/agentAdminController";

const router = Router();

// Base mount: /api/admin/agents
router.use(authMiddleware);
router.use(requireOwner);

router.post("/", createAgent);
router.get("/", listAgents);
router.patch("/:id/status", setAgentStatus);
router.patch("/:id/password", resetAgentPassword);
router.post("/:id/approve", approveAgent);
router.post("/:id/reject", rejectAgent);

export default router;
