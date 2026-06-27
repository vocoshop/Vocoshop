import { Router } from "express";
import { registerStore, loginStore, checkPhone } from "../controllers/authController";
import { validate, storeRegistrationSchema } from "../middleware/validate";

const router = Router();

router.post("/register", validate(storeRegistrationSchema), registerStore);
router.post("/login", loginStore);
router.post("/check-phone", checkPhone);

export default router;