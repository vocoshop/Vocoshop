// routes/callProxyRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { initiateCall } from "../controllers/callProxyController";

const router = Router();

router.use(authMiddleware);

router.post("/initiate", initiateCall);

export default router;
