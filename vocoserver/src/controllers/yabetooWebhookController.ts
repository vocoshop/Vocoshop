import { Request, Response } from "express";
import crypto from "crypto";
import Store from "../models/Store";
import { createNotification } from "../services/notificationEngine";
import { generateCommissions } from "../services/commissionService";
import { logSystem } from "../utils/systemLogger";
import Invoice from "../models/Invoice";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber";
import Subscription from "../models/Subscription";

const YABETOO_WEBHOOK_SECRET = process.env.YABETOO_WEBHOOK_SECRET || "";
const EXPECTED_AMOUNT = 3900;

const processedEvents = new Set<string>();
const MAX_CACHE_SIZE = 10000;

setInterval(() => {
  if (processedEvents.size > MAX_CACHE_SIZE) processedEvents.clear();
}, 60 * 60 * 1000);

function verifySignature(req: Request): boolean {
  if (!YABETOO_WEBHOOK_SECRET) {
    logSystem("error", "YABETOO_WEBHOOK_SECRET non configuré — webhook REJETÉ", { source: "yabetoo_webhook" });
    return false;
  }

  const signatureHeader = req.headers["x-yabetoo-webhook-signature"] as string | undefined;
  const timestamp = req.headers["x-yabetoo-webhook-timestamp"] as string | undefined;

  if (!signatureHeader || !timestamp) {
    logSystem("warning", "Headers webhook Yabetoo manquants", { source: "yabetoo_webhook" });
    return false;
  }

  const rawBody = (req as any).rawBody || JSON.stringify(req.body);
  const signedPayload = `${timestamp}.${rawBody}`;

  const expected = crypto.createHmac("sha256", YABETOO_WEBHOOK_SECRET).update(signedPayload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const yabetooWebhook = async (req: Request, res: Response) => {
  const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null;

  try {
    if (!verifySignature(req)) {
      logSystem("warning", "Yabetoo webhook REJETÉ — signature invalide", {
        source: "yabetoo_webhook", path: "/api/yabetoo/webhook", ip: ip || "unknown",
      });
      return res.status(401).json({ error: "Signature invalide" });
    }

    const body = req.body || {};
    const eventType = req.headers["x-yabetoo-webhook-event"] as string || body.type;

    if (eventType !== "checkout.session.completed" && eventType !== "intent.completed") {
      logSystem("info", `Yabetoo webhook: événement ignoré "${eventType}"`, { source: "yabetoo_webhook" });
      return res.json({ ok: true });
    }

    const session = body.data?.object || body.data || {};
    const sessionId = session.id || body.id;
    const storeId = session.client_reference_id || session.metadata?.store_id || body.metadata?.store_id;
    const amount = session.amount_total || session.amount;

    if (!storeId || typeof storeId !== "string") {
      logSystem("warning", `Yabetoo webhook REJETÉ — storeId invalide: "${storeId}"`, {
        source: "yabetoo_webhook", ip: ip || "unknown",
      });
      return res.status(400).json({ error: "storeId invalide" });
    }

    if (!sessionId) {
      logSystem("warning", "Yabetoo webhook REJETÉ — sessionId manquant", {
        source: "yabetoo_webhook", ip: ip || "unknown",
      });
      return res.status(400).json({ error: "sessionId manquant" });
    }

    const dedupKey = `${storeId}_${sessionId}`;
    if (processedEvents.has(dedupKey)) {
      logSystem("info", `Yabetoo webhook: déjà traité "${sessionId}"`, { source: "yabetoo_webhook" });
      return res.json({ ok: true });
    }

    if (amount && Number(amount) !== EXPECTED_AMOUNT) {
      logSystem("warning", `Yabetoo webhook REJETÉ — montant ${amount} ≠ ${EXPECTED_AMOUNT}`, {
        source: "yabetoo_webhook", ip: ip || "unknown",
      });
      return res.status(400).json({ error: "Montant invalide" });
    }

    const store: any = await Store.findById(storeId);
    if (!store) {
      logSystem("warning", `Yabetoo webhook REJETÉ — store introuvable: ${storeId}`, {
        source: "yabetoo_webhook", ip: ip || "unknown",
      });
      return res.status(404).json({ error: "Store not found" });
    }

    if (store.lastPaymentId === sessionId) {
      logSystem("info", `Yabetoo webhook: store déjà payé avec ${sessionId}`, { source: "yabetoo_webhook" });
      processedEvents.add(dedupKey);
      return res.json({ ok: true });
    }

    processedEvents.add(dedupKey);
    store.lastPaymentId = sessionId;

    const now = new Date();
    let baseDate = store.paidUntil && new Date(store.paidUntil) > now ? new Date(store.paidUntil) : now;

    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + 1);

    store.plan = "PRO";
    store.subscriptionStatus = "active";
    store.paidUntil = newEnd;
    store.graceUntil = null;

    logSystem("info", `Yabetoo webhook: store=${storeId} activé jusqu'au ${newEnd}`, {
      source: "yabetoo_webhook", path: "/api/yabetoo/webhook", ip: ip || "unknown",
    });

    if (store.agentCode) {
      generateCommissions(store.agentCode, now.getMonth() + 1, now.getFullYear()).catch(() => {});
    }

    const billingEnd = new Date(now);
    billingEnd.setMonth(billingEnd.getMonth() + 1);

    await Invoice.create({
      storeId: store._id, plan: "PRO", amount: EXPECTED_AMOUNT, currency: "XAF",
      invoiceNumber: generateInvoiceNumber(), transactionId: sessionId,
      billingPeriodStart: now, billingPeriodEnd: billingEnd, paidAt: now,
    });

    await createNotification({
      storeId: store._id, title: "Abonnement activé",
      message: "Votre abonnement PRO est maintenant actif (via Yabetoo).",
      type: "subscription", uniqueKey: `subscription_active_yabetoo_${store._id}_${sessionId}`,
    });

    if (store.referralCodeUsed && typeof store.referralCodeUsed === "string" && store.referralCodeUsed.trim().length > 0) {
      const sponsor: any = await Store.findOne({ referralCode: store.referralCodeUsed });
      if (sponsor && sponsor._id.toString() !== store._id.toString() && !store.referralRewarded) {
        sponsor.paidReferrals = Number(sponsor.paidReferrals || 0) + 1;
        sponsor.referredCount = Number(sponsor.referredCount || 0) + 1;
        store.referralRewarded = true;

        if (Number(sponsor.paidReferrals || 0) >= 3) {
          let sponsorBaseDate = sponsor.paidUntil && new Date(sponsor.paidUntil) > now ? new Date(sponsor.paidUntil) : now;
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
            storeId: sponsor._id, title: "Bonus débloqué",
            message: "Vous avez gagné 1 mois gratuit grâce à vos parrainages !",
            type: "referral_bonus", uniqueKey: `referral_bonus_yabetoo_${sponsor._id}_${sessionId}`,
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
    logSystem("error", `Yabetoo webhook échoué: ${err.message}`, {
      source: "yabetoo_webhook", path: "/api/yabetoo/webhook", stack: err.stack, ip: ip || "unknown",
    });
    return res.status(500).json({ error: "webhook failed" });
  }
};
