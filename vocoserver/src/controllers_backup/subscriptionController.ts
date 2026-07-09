import { Request, Response } from "express";
import Store from "../models/Store";
import Invoice from "../models/Invoice";
import RevenueMonthly from "../models/RevenueMonthly";
import { processSubscriptionPayment } from "../services/paymentGateway";
import { generateInvoiceNumber } from "../utils/generateInvoiceNumber";
import { generateCommissions } from "../services/commissionService";
import { logActivity } from "./activityController";
import { emitActivity } from "../services/realtimeService";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";

/* =====================================================
🧠 CALCUL PERIODE FACTURATION
===================================================== */
function calculateBillingPeriod(store: any) {
const now = new Date();

let periodStart: Date;

if (store.paidUntil && new Date(store.paidUntil) > now) {
periodStart = new Date(store.paidUntil);
} else {
periodStart = now;
}

const periodEnd = new Date(periodStart);
periodEnd.setDate(periodEnd.getDate() + 30);

return { periodStart, periodEnd };
}

/* =====================================================
🔥 GET MY SUBSCRIPTION
===================================================== */
export const getMySubscription = async (req: Request, res: Response) => {
try {
res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
res.setHeader("Pragma", "no-cache");
res.setHeader("Expires", "0");
res.setHeader("Surrogate-Control", "no-store");

const { storeId } = req.user || {};
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const store: any = await Store.findById(storeId);
if (!store) return res.status(404).json({ error: "Store not found" });

const now = new Date();
let subscriptionStatus = store.subscriptionStatus || "trial";

if (store.paidUntil) {
const paidUntilDate = new Date(store.paidUntil);

if (paidUntilDate > now) subscriptionStatus = "active";
else if (store.graceUntil && new Date(store.graceUntil) > now)
subscriptionStatus = "grace";
else subscriptionStatus = "expired";

if (store.subscriptionStatus !== subscriptionStatus) {
store.subscriptionStatus = subscriptionStatus;
await store.save();
}
}

return res.status(200).json({
subscriptionStatus,
plan: store.plan || "Essai gratuit",
installedAt: store.installedAt || store.createdAt,
paidUntil: store.paidUntil || null,
graceUntil: store.graceUntil || null,
autoRenew: store.autoRenew ?? true,
});

} catch (e) {
console.error("❌ getMySubscription error", e);
return res.status(500).json({ error: "getMySubscription failed" });
}
};

/* =====================================================
🔹 ACTIVATE SUBSCRIPTION
===================================================== */
export const activateSubscription = async (req: Request, res: Response) => {
try {
const { storeId } = req.user || {};
const { method, phone, card, expiry, cvc } = req.body || {};

if (!storeId)
  return res.status(400).json({ error: "storeId manquant" });

if (!method)
  return res.status(400).json({ error: "Méthode de paiement manquante" });

const result = await processSubscriptionPayment({
  method, phone, card, expiry, cvc, storeId,
});

// Flutterwave configuré → attendre le webhook
if (FLW_SECRET_KEY && FLW_SECRET_KEY !== "your_flw_secret_key") {
  return res.json({
    success: true,
    status: "PENDING",
    txRef: result.txRef,
    message: "Validation en attente sur votre téléphone",
  });
}

// Mode stub (pas de Flutterwave) → activer immédiatement
await confirmSubscriptionPayment(storeId, result.txRef);

return res.json({
  success: true,
  status: "ACTIVE",
  message: "Abonnement activé",
});

} catch (e) {
console.error("❌ activateSubscription error", e);
return res.status(500).json({ error: "activateSubscription failed" });
}
};

/* =====================================================
🔥 CONFIRM SUBSCRIPTION + REVENUE TRACKING
===================================================== */
export const confirmSubscriptionPayment = async (
storeId: string,
transactionId?: string
) => {
try {
const store: any = await Store.findById(storeId);
if (!store) return;

const now = new Date();
const monthKey = now.toISOString().slice(0, 7); // ex: "2026-03"

/* =====================================================
🛑 ANTI DOUBLE PAIEMENT
===================================================== */
if (transactionId && store.lastPaymentId === transactionId) {
console.log("⛔ Paiement déjà traité:", transactionId);
return;
}

if (transactionId) {
store.lastPaymentId = transactionId;
}

/* =====================================================
📅 CALCUL PERIODE
===================================================== */
const { periodStart, periodEnd } = calculateBillingPeriod(store);

/* =====================================================
📦 UPDATE STORE
===================================================== */
const isNewSubscription = store.billingCycleCount === 0;

store.billingCycleCount += 1;
store.paidUntil = periodEnd;
store.subscriptionStatus = "active";
store.graceUntil = null;
store.plan = "Premium";

await store.save();

  // 🔔 Temps réel
  emitActivity("subscription", "Paiement abonnement reçu", `${store.storeName || "Boutique"} — Abonnement activé`, { storeId: String(store._id), amount: 3900 });

  // Commission pour l'agent
if (store.agentCode) {
  const n = new Date();
  generateCommissions(store.agentCode, n.getMonth() + 1, n.getFullYear()).catch(() => {});
  logActivity(store.agentCode, "subscription_activated", `${store.storeName} — Abonnement activé`, {
    storeId: String(store._id),
    storeName: store.storeName,
  });
}

/* =====================================================
📊 REVENUE TRACKING
===================================================== */

const amount = 3900; // adapte à ton pricing

let revenueDoc = await RevenueMonthly.findOne({ month: monthKey });

if (!revenueDoc) {
revenueDoc = await RevenueMonthly.create({
month: monthKey,
totalRevenue: amount,
subscriptionCount: 1,
newSubscriptions: isNewSubscription ? 1 : 0,
renewals: isNewSubscription ? 0 : 1,
});
} else {
revenueDoc.totalRevenue += amount;
revenueDoc.subscriptionCount += 1;

if (isNewSubscription) revenueDoc.newSubscriptions += 1;
else revenueDoc.renewals += 1;

await revenueDoc.save();
}

/* =====================================================
🧾 CREATION FACTURE
===================================================== */

await Invoice.create({
storeId: store._id,
invoiceNumber: generateInvoiceNumber(),
plan: "Premium",
amount,
currency: "XAF",
paidAt: now,
transactionId: transactionId || null,
billingPeriodStart: periodStart,
billingPeriodEnd: periodEnd,
});

console.log("✅ Subscription extended until:", periodEnd);
console.log("📊 Revenue updated for:", monthKey);

} catch (error) {
console.error("❌ confirmSubscriptionPayment error", error);
}
};

/* =====================================================
🔥 CANCEL SUBSCRIPTION
===================================================== */
export const cancelSubscription = async (req: Request, res: Response) => {
try {
const { storeId } = req.user || {};
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const store: any = await Store.findById(storeId);
if (!store)
return res.status(404).json({ error: "Store not found" });

store.autoRenew = false;
await store.save();

return res.json({
success: true,
autoRenew: false,
message:
"Renouvellement automatique désactivé. L'abonnement reste actif jusqu'à expiration.",
});

} catch (e) {
console.error("❌ cancelSubscription error", e);
return res.status(500).json({ error: "cancelSubscription failed" });
}
};
