import { Router, raw } from "express";
import crypto from "crypto";
import { createChariowCheckout, getChariowConfig } from "../services/chariowService";
import { chariowWebhook } from "../controllers/chariowWebhookController";
import Store from "../models/Store";
import authMiddleware from "../middleware/authMiddleware";
import { chariowCheckoutLimiter, chariowWebhookLimiter } from "../middleware/rateLimiter";
import { logSystem } from "../utils/systemLogger";

const router = Router();

/* =====================================================
   Validation email simple
   ===================================================== */
function isValidEmail(email: string): boolean {
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const dot = email.lastIndexOf(".");
  return dot > at + 1 && dot < email.length - 1;
}

/* =====================================================
   Validation phone (numériques, 6-15 chiffres)
   ===================================================== */
function isValidPhone(phone: string): boolean {
  const clean = phone.replace(/[\s\-()]/g, "");
  return /^\d{6,15}$/.test(clean);
}

/* =====================================================
   POST /api/chariow/checkout — Créer session paiement
   ===================================================== */
router.post("/checkout", chariowCheckoutLimiter, authMiddleware, async (req: any, res) => {
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null;

  try {
    const storeId = req.storeId || req.user?.id;
    if (!storeId) {
      return res.status(401).json({ error: "Non autorisé" });
    }

    const store = await Store.findById(storeId);
    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const { email, phone, countryCode } = req.body;

    // Validation des champs
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Email invalide" });
    }

    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ error: "Numéro de téléphone invalide (6-15 chiffres)" });
    }

    if (countryCode && (typeof countryCode !== "string" || countryCode.length > 5)) {
      return res.status(400).json({ error: "Code pays invalide" });
    }

    // Vérifier que le store n'a pas déjà un paiement récent en cours
    if (store.subscriptionStatus === "active" && store.paidUntil) {
      const paidUntil = new Date(store.paidUntil);
      const now = new Date();
      const daysRemaining = Math.ceil((paidUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining > 25) {
        logSystem("warning", `Chariow checkout REJETÉ — store ${storeId} déjà payé (${daysRemaining}j restants)`, {
          source: "chariow_checkout",
          path: "/api/chariow/checkout",
          ip: ip || "unknown",
        });
        return res.status(400).json({ error: "Votre abonnement est déjà actif" });
      }
    }

    logSystem("info", `Chariow checkout demandé par store ${storeId}`, {
      source: "chariow_checkout",
      path: "/api/chariow/checkout",
      ip: ip || "unknown",
    });

    const result = await createChariowCheckout({
      email,
      firstName: store.shopId || "Client",
      lastName: "Vocoshop",
      phone: phone.replace(/[\s\-()]/g, ""),
      countryCode: countryCode || "CG",
      metadata: {
        store_id: storeId.toString(),
        plan: "PRO",
        source: "vocoshop_app",
      },
    });

    if (!result.success) {
      logSystem("warning", `Chariow checkout échoué: ${result.error}`, {
        source: "chariow_checkout",
        path: "/api/chariow/checkout",
        ip: ip || "unknown",
      });
      return res.status(400).json({ error: result.error });
    }

    logSystem("info", `Chariow checkout créé: saleId=${result.saleId}`, {
      source: "chariow_checkout",
      path: "/api/chariow/checkout",
      ip: ip || "unknown",
    });

    return res.json({
      ok: true,
      checkoutUrl: result.checkoutUrl,
      transactionId: result.transactionId,
      saleId: result.saleId,
      step: result.step,
    });
  } catch (e) {
    const err = e as Error;
    logSystem("error", `Chariow checkout error: ${err.message}`, {
      source: "chariow_checkout",
      path: "/api/chariow/checkout",
      stack: err.stack,
      ip: ip || "unknown",
    });
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
   GET /api/chariow/config — Debug (dev only)
   ===================================================== */
router.get("/config", (req, res) => {
  // En prod, on ne expose pas la config
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  return res.json(getChariowConfig());
});

/* =====================================================
   POST /api/chariow/webhook — Pulse Chariow
   ✔ Raw body pour vérification HMAC
   ✔ Rate limiting
   ===================================================== */
router.post(
  "/webhook",
  chariowWebhookLimiter,
  // Raw body nécessaire pour HMAC — on utilise express.raw pour ce endpoint
  (req, res, next) => {
    // Express.raw n'est pas dispo directement, on parse manuellement
    if (!req.body || typeof req.body === "string") {
      let data = "";
      req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      req.on("end", () => {
        try {
          (req as any).rawBody = data;
          req.body = JSON.parse(data);
          next();
        } catch {
          return res.status(400).json({ error: "JSON invalide" });
        }
      });
    } else {
      // Déjà parsé par express.json() — reconstruire le raw body
      (req as any).rawBody = JSON.stringify(req.body);
      next();
    }
  },
  chariowWebhook
);

export default router;
