import { Router } from "express";
import { login, getProfile } from "../controllers/managerAuthController";
import requireManager from "../middleware/requireManager";

const router = Router();

router.post("/login", login);
router.get("/profile", requireManager, getProfile);

export default router;
