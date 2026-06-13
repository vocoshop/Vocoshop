import { Router } from "express";
import { login, getProfile } from "../controllers/managerAuthController";
import requireManager from "../middleware/requireManager";
import { authLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/login", authLimiter, login);
router.get("/profile", requireManager, getProfile);

export default router;
