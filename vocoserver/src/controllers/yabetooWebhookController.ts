import { Request, Response } from "express";
import crypto from "crypto";
import Store from "../models/Store";
import { createNotification } from "../services/notificationEngine";
import { generateCommissions } from "../services/commissionService";
import { logSystem } from "../utils/systemLogger";
import Invoice from "../models/Invoice";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber";
import Subscription from "../models/Subscription";

const EXPECTED_AMOUNT = 3900;

const processedEvents = new Set<string>();
const MAX_CACHE_SIZE = 10000;

setInterval(() => {
  if (processedEvents.size > MAX_CACHE_SIZE) processedEvents.clear();
}, 60 * 60 * 1000);

function verifySignature(req: Request): boolean {
  const secret = process.env.YABETOO_WEBHOOK_SECRET || "";
  if (!secret) {
    console.log("[yabetoo_webhook] YABETOO_WEBHOOK_SECRET non configuré");
    return false;
  }

  const signatureHeader = req.headers["x-yabetoo-webhook-signature"] as string | undefined;
  const timestamp = req.headers["x-yabetoo-webhook-timestamp"] as string | undefined;

  if (!signatureHeader || !timestamp) {
    console.log("[yabetoo_webhook] Headers manquants — signature:", !!signatureHeader, "timestamp:", !!timestamp);
    return false;
  }

  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    console.log("[yabetoo_webhook] Erreur comparaison signature HMAC");
    return false;
  }
}

export const yabetooWebhook = async (req: Request, res: Response) => {
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null;

  console.log("\n=== YABETOO WEBHOOK REÇU ===");
  console.log("[yabetoo_webhook] Event reçu");
  console.log("[yabetoo_webhook] Headers:", JSON.stringify({
    yabetooWebhookEvent: req.headers["x-yabetoo-webhook-event"],
    yabetooWebhookSignature: req.headers["x-yabetoo-webhook-signature"] ? "✓ présent" : "✗ manquant",
    yabetooWebhookTimestamp: req.headers["x-yabetoo-webhook-timestamp"],
    contentType: req.headers["content-type"],
  }));

  try {
    if (!verifySignature(req)) {
      console.log("[yabetoo_webhook] SIGNATURE INVALIDE — rejet");
      return res.status(401).json({ error: "Signature invalide" });
    }
    console.log("[yabetoo_webhook] Signature HMAC valide ✓");

    const body = req.body || {};
    const eventType = req.headers["x-yabetoo-webhook-event"] as string || body.type || "";
    console.log("[yabetoo_webhook] Event type:", JSON.stringify(eventType));
    console.log("[yabetoo_webhook] Body keys:", Object.keys(body));
    console.log("[yabetoo_webhook] Body preview:", JSON.stringify(body).slice(0, 500));

    const completedEvents = [
      "checkout.session.completed", "intent.completed",
      "payment.completed", "checkout.completed", "transaction.completed",
      "payment.succeeded", "charge.succeeded", "subscription.created",
    ];
    if (!completedEvents.includes(eventType)) {
      console.log("[yabetoo_webhook] Event type ignoré (pas dans completedEvents):", eventType);
      return res.json({ ok: true, ignored: true });
    }
    console.log("[yabetoo_webhook] Event type reconnu ✓");

    const session = body.data?.object || body.data || body.session || {};
    const sessionId = session.id || body.id || body.session_id || "";
    const storeId = session.client_reference_id || session.metadata?.store_id || body.metadata?.store_id || body.store_id || "";
    const amount = session.amount_total ?? session.amount ?? body.amount ?? 0;

    console.log("[yabetoo_webhook] StoreId extrait:", JSON.stringify(storeId));
    console.log("[yabetoo_webhook] SessionId:", JSON.stringify(sessionId));
    console.log("[yabetoo_webhook] Montant:", amount);

    if (!storeId || typeof storeId !== "string") {
      console.log("[yabetoo_webhook] StoreId invalide — rejet");
      return res.status(400).json({ error: "storeId invalide" });
    }

    if (!sessionId) {
      console.log("[yabetoo_webhook] SessionId manquant — rejet");
      return res.status(400).json({ error: "sessionId manquant" });
    }

    const dedupKey = `${storeId}_${sessionId}`;
    if (processedEvents.has(dedupKey)) {
      console.log("[yabetoo_webhook] Événement déjà traité (dedup):", dedupKey);
      return res.json({ ok: true, deduped: true });
    }

    if (amount && Number(amount) !== EXPECTED_AMOUNT) {
      console.log(`[yabetoo_webhook] Montant invalide: ${amount} !== ${EXPECTED_AMOUNT} — rejet`);
      return res.status(400).json({ error: "Montant invalide" });
    }
    console.log("[yabetoo_webhook] Montant valide ✓");

    processedEvents.add(dedupKey);

    const store: any = await Store.findById(storeId);
    console.log("[yabetoo_webhook] Boutique trouvée:", !!store ? "OUI" : "NON");
    if (store) console.log("[yabetoo_webhook] Store plan actuel:", store.plan, "status:", store.subscriptionStatus);

    if (!store) {
      console.log("[yabetoo_webhook] Store introuvable avec ID:", storeId);
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.lastPaymentId === sessionId) {
      console.log("[yabetoo_webhook] Paiement déjà traité (lastPaymentId match):", sessionId);
      return res.json({ ok: true, alreadyProcessed: true });
    }

    store.lastPaymentId = sessionId;

    const now = new Date();
    let baseDate = store.paidUntil && new Date(store.paidUntil) > now ? new Date(store.paidUntil) : now;

    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + 1);

    console.log("[yabetoo_webhook] Date d'expiration calculée:", newEnd.toISOString());
    console.log("[yabetoo_webhook] Mise à jour store: plan=PRO, status=active");

    store.plan = "PRO";
    store.subscriptionStatus = "active";
    store.paidUntil = newEnd;
    store.graceUntil = null;

    if (store.agentCode) {
      console.log("[yabetoo_webhook] AgentCode présent, génération commissions...");
      generateCommissions(store.agentCode, now.getMonth() + 1, now.getFullYear()).catch(() => {});
    }

    const billingEnd = new Date(now);
    billingEnd.setMonth(billingEnd.getMonth() + 1);

    try {
      await Invoice.create({
        storeId: store._id, plan: "PRO", amount: EXPECTED_AMOUNT, currency: "XAF",
        invoiceNumber: generateInvoiceNumber(), transactionId: sessionId,
        billingPeriodStart: now, billingPeriodEnd: billingEnd, paidAt: now,
      });
      console.log("[yabetoo_webhook] Facture créée ✓");
    } catch (invErr) {
      console.log("[yabetoo_webhook] Erreur création facture:", invErr);
    }

    try {
      await createNotification({
        storeId: store._id, title: "Abonnement activé",
        message: "Votre abonnement PRO est maintenant actif (via Yabetoo).",
        type: "subscription", uniqueKey: `subscription_active_yabetoo_${store._id}_${sessionId}`,
      });
      console.log("[yabetoo_webhook] Notification créée ✓");
    } catch (notifErr) {
      console.log("[yabetoo_webhook] Erreur notification:", notifErr);
    }

    try {
      await store.save();
      console.log("[yabetoo_webhook] Mise à jour abonnement réussie ✓");
    } catch (saveErr) {
      console.log("[yabetoo_webhook] ERREUR save store:", saveErr);
    }

    try {
      await Subscription.updateOne(
        { storeId: store._id },
        { $set: { plan: "PRO", paidUntil: newEnd, trialEnd: newEnd, status: "active" } },
        { upsert: true }
      );
      console.log("[yabetoo_webhook] Subscription model mis à jour ✓");
    } catch (subErr) {
      console.log("[yabetoo_webhook] Erreur Subscription.updateOne:", subErr);
    }

    if (store.referralCodeUsed && typeof store.referralCodeUsed === "string" && store.referralCodeUsed.trim().length > 0) {
      try {
        const sponsor: any = await Store.findOne({ referralCode: store.referralCodeUsed });
        if (sponsor && sponsor._id.toString() !== store._id.toString() && !store.referralRewarded) {
          sponsor.paidReferrals = Number(sponsor.paidReferrals || 0) + 1;
          sponsor.referredCount = Number(sponsor.referredCount || 0) + 1;
          store.referralRewarded = true;
          if (Number(sponsor.paidReferrals || 0) >= 3) {
            let base = sponsor.paidUntil && new Date(sponsor.paidUntil) > now ? new Date(sponsor.paidUntil) : now;
            const end = new Date(base);
            end.setDate(end.getDate() + 30);
            sponsor.paidUntil = end;
            sponsor.subscriptionStatus = "active";
            await Subscription.updateOne(
              { storeId: sponsor._id },
              { $set: { paidUntil: end, trialEnd: end } },
              { upsert: true }
            );
            await createNotification({
              storeId: sponsor._id, title: "Bonus débloqué",
              message: "Vous avez gagné 1 mois gratuit grâce à vos parrainages !",
              type: "referral_bonus", uniqueKey: `referral_bonus_yabetoo_${sponsor._id}_${sessionId}`,
            });
            sponsor.paidReferrals = 0;
          }
          await sponsor.save();
        }
      } catch (sponsorErr) {
        console.log("[yabetoo_webhook] Erreur parrainage:", sponsorErr);
      }
    }

    console.log("[yabetoo_webhook] ✅ Webhook traité avec succès");
    return res.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    console.log("[yabetoo_webhook] EXCEPTION:", err.message);
    console.log("[yabetoo_webhook] Stack:", err.stack);
    return res.status(500).json({ error: "webhook failed" });
  }
};
