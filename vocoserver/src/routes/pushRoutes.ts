// routes/pushRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import PushToken from "../models/PushToken";

const router = Router();

router.use(authMiddleware);

/* =====================================================
POST /api/push/register
Body: { token, platform }
===================================================== */
router.post("/register", async (req: any, res: any) => {
  try {
    const { token, platform } = req.body;
    const storeId = req.user?.storeId;

    if (!token || typeof token !== "string") return res.status(400).json({ error: "Token requis" });

    await PushToken.findOneAndUpdate(
      { token: String(token) },
      { $set: { storeId: String(storeId), token: String(token), platform: String(platform || "android"), isActive: true } },
      { upsert: true }
    );

    res.json({ message: "Token enregistré" });
  } catch (e) {
    console.error("❌ push/register:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
POST /api/push/unregister
Body: { token }
===================================================== */
router.post("/unregister", async (req: any, res: any) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") return res.status(400).json({ error: "Token requis" });

    await PushToken.updateOne({ token: String(token) }, { isActive: false });
    res.json({ message: "Token désactivé" });
  } catch (e) {
    console.error("❌ push/unregister:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;