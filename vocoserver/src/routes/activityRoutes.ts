// routes/activityRoutes.ts
import { Router } from "express";
import { getActivities } from "../controllers/activityController";
import agentAuthMiddleware from "../middleware/agentAuthMiddleware";

const router = Router();

router.get("/", agentAuthMiddleware, getActivities);

export default router;
