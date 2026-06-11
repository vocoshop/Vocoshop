import { Router } from "express";
import { registerStore, loginStore } from "../controllers/authController";
import { validate, storeRegistrationSchema } from "../middleware/validate";

const router = Router();

router.post("/register", validate(storeRegistrationSchema), registerStore);
router.post("/login", loginStore);

export default router;