import { Router } from "express";
import {
  requestOTP,
  verifyOTP,
  deviceLogin, // ✅ nouveau
} from "../controllers/otpController";
import { validate, otpRequestSchema, otpVerifySchema } from "../middleware/validate";

const router = Router();

/**
* 🔵 Demande OTP (toujours dispo)
* POST /api/otp/send
* Body: { phone }
*/
router.post("/send", validate(otpRequestSchema), requestOTP);

/**
* 🟣 Vérification OTP (1ère connexion / reauth / relink)
* POST /api/otp/verify
* Body: { phone, code, deviceId, forceRelink? }
*/
router.post("/verify", validate(otpVerifySchema), verifyOTP);

/**
* 🟢 Connexion SANS OTP si :
* - même téléphone
* - activité récente
* POST /api/otp/device-login
* Body: { phone, deviceId }
*/
router.post("/device-login", deviceLogin);

export default router;
