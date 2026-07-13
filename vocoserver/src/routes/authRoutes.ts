import { Router } from "express";
import { registerStore, loginStore, checkPhone, getOwnerStores, ownerSelectStore, autoLogin } from "../controllers/authController";
import { authLimiter } from "../middleware/rateLimiter";
import { validate, storeRegistrationSchema } from "../middleware/validate";
import authMiddleware from "../middleware/authMiddleware";

const router = Router();

router.post("/register", validate(storeRegistrationSchema), registerStore);
router.post("/login", authLimiter, loginStore);
router.post("/check-phone", checkPhone);
router.get("/owner-stores", authMiddleware, getOwnerStores);
router.post("/owner-select-store", ownerSelectStore);
router.post("/auto-login", autoLogin);

export default router;