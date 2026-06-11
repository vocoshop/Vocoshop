import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import { getConfig, updateConfig, seedConfig } from "../controllers/adminConfigController";

const router = Router();

router.use(authMiddleware);
router.use(requireOwner);

router.get("/", getConfig);
router.patch("/", updateConfig);
router.post("/seed", seedConfig);

export default router;