import { Router } from "express";
import { createCheckoutSession, getConfig } from "../services/yabetooService";
import { yabetooWebhook } from "../controllers/yabetooWebhookController";
import Store from "../models/Store";
import authMiddleware from "../middleware/authMiddleware";
import { yabetooCheckoutLimiter, yabetooWebhookLimiter } from "../middleware/rateLimiter";
import { logSystem } from "../utils/systemLogger";

const router = Router();

function isValidEmail(email: string): boolean {
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const dot = email.lastIndexOf(".");
  return dot > at + 1 && dot < email.length - 1;
}

router.post("/checkout", yabetooCheckoutLimiter, authMiddleware, async (req: any, res) => {
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null;

  try {
    const storeId = req.user?.storeId;
    if (!storeId) return res.status(401).json({ error: "Non autorisé" });

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ error: "Store not found" });

    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Email invalide" });
    }

    if (store.subscriptionStatus === "active" && store.paidUntil) {
      const paidUntil = new Date(store.paidUntil);
      const now = new Date();
      const daysRemaining = Math.ceil((paidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining > 25) {
        logSystem("warning", `Yabetoo checkout REJETÉ — store ${storeId} déjà payé (${daysRemaining}j restants)`, {
          source: "yabetoo_checkout", path: "/api/yabetoo/checkout", ip: ip || "unknown",
        });
        return res.status(400).json({ error: "Votre abonnement est déjà actif" });
      }
    }

    logSystem("info", `Yabetoo checkout demandé par store ${storeId}`, {
      source: "yabetoo_checkout", path: "/api/yabetoo/checkout", ip: ip || "unknown",
    });

    const result = await createCheckoutSession(
      email,
      storeId.toString(),
      { plan: "PRO", source: "vocoshop_app" },
      store.ownerName || store.storeName || undefined,
      store.phone,
    );

    if (!result.success) {
      logSystem("warning", `Yabetoo checkout échoué: ${result.error}`, {
        source: "yabetoo_checkout", path: "/api/yabetoo/checkout", ip: ip || "unknown",
      });
      return res.status(400).json({ error: result.error });
    }

    logSystem("info", `Yabetoo checkout créé: sessionId=${result.sessionId}`, {
      source: "yabetoo_checkout", path: "/api/yabetoo/checkout", ip: ip || "unknown",
    });

    return res.json({ ok: true, checkoutUrl: result.sessionUrl, sessionId: result.sessionId });
  } catch (e) {
    const err = e as Error;
    logSystem("error", `Yabetoo checkout error: ${err.message}`, {
      source: "yabetoo_checkout", path: "/api/yabetoo/checkout", stack: err.stack, ip: ip || "unknown",
    });
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/config", (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "Not found" });
  return res.json(getConfig());
});

router.post("/webhook", yabetooWebhookLimiter, yabetooWebhook);

export default router;
