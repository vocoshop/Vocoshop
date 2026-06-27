import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import { initiateCall, answerWebhook, eventWebhook } from "../controllers/callProxyController";

const router = Router();

router.post("/initiate", authMiddleware, initiateCall);

router.post("/webhook/answer/:proxyId", answerWebhook);
router.post("/webhook/event/:proxyId", eventWebhook);

export default router;
