// routes/publicAgentRoutes.ts
import { Router } from "express";
import multer from "multer";
import { registerAgent } from "../controllers/agentPublicController";
import { registerLimiter } from "../middleware/rateLimiter";

const router = Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/agents");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const ext = allowedTypes.test(file.originalname.toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images JPEG, PNG, WebP sont autorisées"));
    }
  },
});

router.post(
  "/register",
  registerLimiter,
  upload.fields([
    { name: "idPhoto", maxCount: 1 },
    { name: "selfiePhoto", maxCount: 1 },
  ]),
  registerAgent
);

export default router;