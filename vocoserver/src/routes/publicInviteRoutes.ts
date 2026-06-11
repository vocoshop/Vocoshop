import { Router } from "express";
import { redirectInvite } from "../controllers/inviteController";

const router = Router();
router.get("/invite/:token", redirectInvite);

export default router;