import { Request, Response } from "express";
import crypto from "crypto";
import Store from "../models/Store";
import Subscription from "../models/Subscription";
import { createNotification } from "../services/notificationEngine";
import { generateCommissions } from "../services/commissionService";
import { logSystem } from "../utils/systemLogger";
import { isValidObjectId } from "../utils/helpers";

/* 🧾 FACTURE */
import Invoice from "../models/Invoice";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber";

/**
=====================================================
🔥 PAYMENT WEBHOOK — V16 ULTRA STABLE + FACTURES
=====================================================
✔ Anti double webhook
✔ Referral Engine blindé
✔ Notification Engine intégré
✔ Création facture automatique
✔ ZERO double notification
✔ Vérification signature Flutterwave
=====================================================
*/

const FLUTTERWAVE_SECRET_HASH = process.env.FLUTTERWAVE_SECRET_HASH;

function verifyFlutterwaveSignature(req: Request): boolean {
  if (!FLUTTERWAVE_SECRET_HASH) {
    console.warn("⚠️ FLUTTERWAVE_SECRET_HASH non configuré — webhook non vérifié");
    return false;
  }
  const signature = req.headers["ver-hash"] as string | undefined;
  if (!signature) return false;
  const rawBody = JSON.stringify(req.body);
  const expectedHash = crypto.createHmac("sha256", FLUTTERWAVE_SECRET_HASH).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHash));
}

export const paymentWebhook = async (req: Request, res: Response) => {
try {

if (!FLUTTERWAVE_SECRET_HASH) {
  logSystem("error", "Webhook REJETÉ — FLUTTERWAVE_SECRET_HASH non configuré", { source: "webhook", path: "/api/webhook" });
  return res.status(500).json({ error: "Webhook non configuré" });
}

if (!verifyFlutterwaveSignature(req)) {
  logSystem("warning", "Webhook REJETÉ — signature invalide", { source: "webhook", path: "/api/webhook" });
  return res.status(401).json({ error: "Signature invalide" });
}

const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || null;

// Support both legacy and Flutterwave webhook formats
let storeId: string | null = null;
let status: string | null = null;
let transactionId: string | null = null;

const body = req.body || {};
if (body.event && body.event.type === "CHARGED" && body.event.data) {
  // Flutterwave webhook
  const data = body.event.data;
  storeId = data.tx_ref ? data.tx_ref.split("_").pop() || null : null;
  // Actually tx_ref = VOCOS_storeId_random
  const parts = (data.tx_ref || "").split("_");
  storeId = parts.length >= 2 ? parts[1] : null;
  status = data.status === "successful" ? "SUCCESS" : "FAILED";
  transactionId = data.flw_ref || data.id?.toString() || null;
} else {
  // Legacy format: { storeId, status, transactionId }
  storeId = body.storeId || null;
  status = body.status || null;
  transactionId = body.transactionId || null;
}

logSystem("webhook", `Webhook: storeId=${storeId} status=${status} txId=${transactionId}`, {
  source: "webhook",
  path: "/api/webhook",
  ip,
});

if (!storeId || !isValidObjectId(storeId)) {
return res.status(400).json({ error: "storeId manquant" });
}

if (status !== "SUCCESS") {
console.log("⚠️ Paiement ignoré:", status);
return res.json({ ok: true });
}

const store: any = await Store.findById(storeId);

if (!store) {
console.log("❌ Store introuvable");
return res.status(404).json({ error: "Store not found" });
}

const now = new Date();

/* =====================================================
🛑 ANTI DOUBLE WEBHOOK
===================================================== */

if (transactionId) {
if (store.lastPaymentId === transactionId) {
console.log("⛔ Webhook déjà traité:", transactionId);
return res.json({ ok: true });
}
store.lastPaymentId = transactionId;
}

/* =====================================================
🔥 ACTIVER ABONNEMENT CLIENT
===================================================== */

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

console.log("✅ Abonnement activé jusqu'au:", newEnd);

// Commission pour l'agent affilié
if (store.agentCode) {
  const now2 = new Date();
  generateCommissions(store.agentCode, now2.getMonth() + 1, now2.getFullYear()).catch(() => {});
}

/* =====================================================
🧾 CREATION FACTURE AUTOMATIQUE (NOUVEAU)
===================================================== */

const billingStart = now;

const billingEnd = new Date(billingStart);
billingEnd.setMonth(billingEnd.getMonth() + 1);

await Invoice.create({
storeId: store._id,
plan: "PRO",
amount: 3900,
currency: "XAF",
invoiceNumber: generateInvoiceNumber(),
transactionId: transactionId || null,

billingPeriodStart: billingStart,
billingPeriodEnd: billingEnd,

paidAt: now,
});

/* =====================================================
🔔 NOTIFICATION ABONNEMENT
===================================================== */

await createNotification({
storeId: store._id,
title: "Abonnement activé",
message: "Votre abonnement PRO est maintenant actif.",
type: "subscription",
uniqueKey: `subscription_active_${store._id}_${transactionId}`,
});

/* =====================================================
🎯 REFERRAL ENGINE
===================================================== */

console.log("\n🎯 REFERRAL DEBUG START");

if (
store.referralCodeUsed &&
typeof store.referralCodeUsed === "string" &&
store.referralCodeUsed.trim().length > 0
) {

const sponsor: any = await Store.findOne({
referralCode: store.referralCodeUsed
});

if (!sponsor) {

console.log("❌ Aucun sponsor trouvé");

} else {

console.log("✅ Sponsor trouvé:", sponsor.shopId);

if (sponsor._id.toString() === store._id.toString()) {

console.log("⛔ Auto parrainage détecté — ignoré");

}
else if (store.referralRewarded) {

console.log("⚠️ Déjà récompensé — skip");

}
else {

/* =====================================================
⭐ INCREMENTATION
===================================================== */

sponsor.paidReferrals =
Number(sponsor.paidReferrals || 0) + 1;

sponsor.referredCount =
Number(sponsor.referredCount || 0) + 1;

store.referralRewarded = true;

console.log("Après → paidReferrals:", sponsor.paidReferrals);
console.log("Après → referredCount:", sponsor.referredCount);

/* =====================================================
🎁 BONUS SI 3 PAYÉS
===================================================== */

if (Number(sponsor.paidReferrals || 0) >= 3) {

let sponsorBaseDate =
sponsor.paidUntil && new Date(sponsor.paidUntil) > now
? new Date(sponsor.paidUntil)
: now;

const sponsorNewEnd = new Date(sponsorBaseDate);
sponsorNewEnd.setDate(sponsorNewEnd.getDate() + 30);

sponsor.paidUntil = sponsorNewEnd;
sponsor.subscriptionStatus = "active";

console.log("🎁 BONUS +30 jours accordé jusqu’au:", sponsorNewEnd);

/* =====================================================
⭐ SYNC SUBSCRIPTION
===================================================== */

await Subscription.updateOne(
{ storeId: sponsor._id },
{
$set: {
paidUntil: sponsorNewEnd,
trialEnd: sponsorNewEnd,
},
},
{ upsert: true }
);

/* =====================================================
🔔 NOTIFICATION BONUS
===================================================== */

await createNotification({
storeId: sponsor._id,
title: "🎁 Bonus débloqué",
message: "Vous avez gagné 1 mois gratuit grâce à vos parrainages !",
type: "referral_bonus",
uniqueKey: `referral_bonus_${sponsor._id}_${transactionId}`,
});

sponsor.paidReferrals = 0;
}

await sponsor.save();
console.log("💾 Sponsor sauvegardé");
}
}

} else {
console.log("ℹ️ Aucun referralCodeUsed — pas de parrainage");
}

console.log("🎯 REFERRAL DEBUG END");

/* =====================================================
💾 SAVE CLIENT FINAL
===================================================== */

await store.save();

console.log("💾 Store sauvegardé");
console.log("======== FIN WEBHOOK ========\n");

return res.json({ ok: true });

} catch (e) {
  const err = e as Error;
  logSystem("error", `Webhook échoué: ${err.message}`, {
    source: "webhook",
    path: "/api/webhook",
    stack: err.stack,
    details: JSON.stringify(req.body)?.slice(0, 200),
  });
  return res.status(500).json({ error: "webhook failed" });
}
};
