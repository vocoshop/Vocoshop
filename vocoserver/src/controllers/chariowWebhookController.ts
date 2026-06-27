import { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import Store from "../models/Store";
import Subscription from "../models/Subscription";
import { createNotification } from "../services/notificationEngine";
import { generateCommissions } from "../services/commissionService";
import { logSystem } from "../utils/systemLogger";
import Invoice from "../models/Invoice";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber";

/**
 * =====================================================
 * CHARIOW WEBHOOK — SÉCURISÉ
 * =====================================================
 * ✔ HMAC signature OBLIGATOIRE (pas de bypass dev)
 * ✔ Validation storeId (ObjectId valide)
 * ✔ Anti double webhook (idempotency)
 * ✔ Validation du montant
 * ✔ Logging de toutes les tentatives rejetées
 * ✔ Timing-safe comparison toujours
 * =====================================================
 */

const CHARIOW_WEBHOOK_SECRET = process.env.CHARIOW_WEBHOOK_SECRET || "";
const EXPECTED_AMOUNT = 2000; // FCFA

// Cache en mémoire pour les transaction IDs déjà traités (anti double webhook)
const processedTransactions = new Set<string>();
const MAX_CACHE_SIZE = 10000;

// Nettoyageperiodique du cache (toutes les heures)
setInterval(() => {
  if (processedTransactions.size > MAX_CACHE_SIZE) {
    processedTransactions.clear();
  }
}, 60 * 60 * 1000);

/* =====================================================
   VÉRIFICATION HMAC — OBLIGATOIRE
   ===================================================== */
function verifyChariowSignature(req: Request): boolean {
  if (!CHARIOW_WEBHOOK_SECRET) {
    // PAS DE BYPASS — on rejette si pas configuré
    console.error("❌ CHARIOW_WEBHOOK_SECRET non configuré — webhook REJETÉ");
    return false;
  }

  const signature = req.headers["x-chariow-signature"] as string | undefined;
  if (!signature) {
    console.error("❌ Header X-Chariow-Signature manquant");
    return false;
  }

  // Utiliser le raw body si disponible, sinon recréer le JSON
  const rawBody = (req as any).rawBody || JSON.stringify(req.body);

  const expected = crypto
    .createHmac("sha256", CHARIOW_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // Comparaison timing-safe toujours
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    // Si les longueurs sont différentes, timingSafeEqual throw
    return false;
  }
}

/* =====================================================
   VALIDATION STORE ID
   ===================================================== */
function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

/* =====================================================
   HANDLER WEBHOOK
   ===================================================== */
export const chariowWebhook = async (req: Request, res: Response) => {
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null;

  try {
    // 1. Vérification HMAC — OBLIGATOIRE
    if (!verifyChariowSignature(req)) {
      logSystem("warning", "Chariow webhook REJETÉ — signature invalide", {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
        ip: ip || "unknown",
        details: JSON.stringify({ headers: Object.keys(req.headers) }).slice(0, 200),
      });
      return res.status(401).json({ error: "Signature invalide" });
    }

    const body = req.body || {};
    const event = body.event;

    // 2. Vérifier l'événement
    if (event !== "successful.sale") {
      logSystem("info", `Chariow webhook: événement ignoré "${event}"`, {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
      });
      return res.json({ ok: true });
    }

    const sale = body.data || {};
    const storeId = sale.custom_metadata?.store_id;
    const transactionId = sale.id || sale.transaction_id;
    const amount = sale.amount?.value || sale.amount;

    // 3. Validation storeId — obligatoire et format valide
    if (!storeId || typeof storeId !== "string" || !isValidObjectId(storeId)) {
      logSystem("warning", `Chariow webhook REJETÉ — storeId invalide: "${storeId}"`, {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
        ip: ip || "unknown",
      });
      return res.status(400).json({ error: "storeId invalide" });
    }

    // 4. Validation transaction ID
    if (!transactionId || typeof transactionId !== "string") {
      logSystem("warning", "Chariow webhook REJETÉ — transactionId manquant", {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
        ip: ip || "unknown",
      });
      return res.status(400).json({ error: "transactionId manquant" });
    }

    // 5. Anti double webhook — cache en mémoire
    if (processedTransactions.has(transactionId)) {
      logSystem("info", `Chariow webhook: déjà traité "${transactionId}"`, {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
      });
      return res.json({ ok: true });
    }

    // 6. Validation du montant (optionnel mais recommandé)
    if (amount && Number(amount) !== EXPECTED_AMOUNT) {
      logSystem("warning", `Chariow webhook REJETÉ — montant ${amount} ≠ ${EXPECTED_AMOUNT}`, {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
        ip: ip || "unknown",
      });
      return res.status(400).json({ error: "Montant invalide" });
    }

    // 7. Chercher le store
    const store: any = await Store.findById(storeId);
    if (!store) {
      logSystem("warning", `Chariow webhook REJETÉ — store introuvable: ${storeId}`, {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
        ip: ip || "unknown",
      });
      return res.status(404).json({ error: "Store not found" });
    }

    // 8. Vérifier que le store n'est pas déjà payé avec cette transaction
    if (store.lastPaymentId === transactionId) {
      logSystem("info", `Chariow webhook: store déjà payé avec ${transactionId}`, {
        source: "chariow_webhook",
        path: "/api/chariow/webhook",
      });
      processedTransactions.add(transactionId);
      return res.json({ ok: true });
    }

    // 9. Marquer comme traité AVANT le traitement
    processedTransactions.add(transactionId);
    store.lastPaymentId = transactionId;

    const now = new Date();

    // 10. Activer abonnement
    let baseDate =
      store.paidUntil && new Date(store.paidUntil) > now
        ? new Date(store.paidUntil)
        : now;

    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + 1);

    store.plan = "PRO";
    store.subscriptionStatus = "active";
    store.paidUntil = newEnd;
    store.graceUntil = null;

    logSystem("info", `Chariow webhook: store=${storeId} activé jusqu'au ${newEnd}`, {
      source: "chariow_webhook",
      path: "/api/chariow/webhook",
      ip: ip || "unknown",
    });

    // 11. Commission agent
    if (store.agentCode) {
      generateCommissions(store.agentCode, now.getMonth() + 1, now.getFullYear()).catch(() => {});
    }

    // 12. Facture
    const billingEnd = new Date(now);
    billingEnd.setMonth(billingEnd.getMonth() + 1);

    await Invoice.create({
      storeId: store._id,
      plan: "PRO",
      amount: EXPECTED_AMOUNT,
      currency: "XAF",
      invoiceNumber: generateInvoiceNumber(),
      transactionId,
      billingPeriodStart: now,
      billingPeriodEnd: billingEnd,
      paidAt: now,
    });

    // 13. Notification
    await createNotification({
      storeId: store._id,
      title: "Abonnement activé",
      message: "Votre abonnement PRO est maintenant actif (via Chariow).",
      type: "subscription",
      uniqueKey: `subscription_active_chariow_${store._id}_${transactionId}`,
    });

    // 14. Referral engine
    if (
      store.referralCodeUsed &&
      typeof store.referralCodeUsed === "string" &&
      store.referralCodeUsed.trim().length > 0
    ) {
      const sponsor: any = await Store.findOne({ $or: [{ referralCode: store.referralCodeUsed }, { agentCode: store.referralCodeUsed }] });

      if (
        sponsor &&
        sponsor._id.toString() !== store._id.toString() &&
        !store.referralRewarded
      ) {
        sponsor.paidReferrals = Number(sponsor.paidReferrals || 0) + 1;
        sponsor.referredCount = Number(sponsor.referredCount || 0) + 1;
        store.referralRewarded = true;

        if (Number(sponsor.paidReferrals || 0) >= 3) {
          let sponsorBaseDate =
            sponsor.paidUntil && new Date(sponsor.paidUntil) > now
              ? new Date(sponsor.paidUntil)
              : now;
          const sponsorNewEnd = new Date(sponsorBaseDate);
          sponsorNewEnd.setDate(sponsorNewEnd.getDate() + 30);
          sponsor.paidUntil = sponsorNewEnd;
          sponsor.subscriptionStatus = "active";

          await Subscription.updateOne(
            { storeId: sponsor._id },
            { $set: { paidUntil: sponsorNewEnd, trialEnd: sponsorNewEnd } },
            { upsert: true }
          );

          await createNotification({
            storeId: sponsor._id,
            title: "🎁 Bonus débloqué",
            message: "Vous avez gagné 1 mois gratuit grâce à vos parrainages !",
            type: "referral_bonus",
            uniqueKey: `referral_bonus_chariow_${sponsor._id}_${transactionId}`,
          });

          sponsor.paidReferrals = 0;
        }

        await sponsor.save();
      }
    }

    await store.save();

    return res.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    logSystem("error", `Chariow webhook échoué: ${err.message}`, {
      source: "chariow_webhook",
      path: "/api/chariow/webhook",
      stack: err.stack,
      ip: ip || "unknown",
      details: JSON.stringify(req.body)?.slice(0, 200),
    });
    return res.status(500).json({ error: "webhook failed" });
  }
};
