// routes/adminAuthRoutes.ts
import { Router } from "express";
import { loginAdmin, changeCredentials } from "../controllers/adminAuthController";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";

const router = Router();

router.post("/login", loginAdmin);
router.put("/credentials", authMiddleware, requireOwner, changeCredentials);

export default router;
