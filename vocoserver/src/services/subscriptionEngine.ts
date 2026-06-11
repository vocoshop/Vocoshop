import Store from "../models/Store";

/**
* =====================================================
* 🔥 ENGINE ABONNEMENT VOCOSHOP — VERSION V8.1 LOCKED STATE
*
* ✔ Status verrouillé par Webhook (source unique)
* ✔ Zéro recalcul dangereux
* ✔ UI stable même avec anciennes boutiques
* ✔ paidUntil renvoyé UNIQUEMENT si actif
* ✔ SaaS Production Grade
* =====================================================
*/

export const evaluateSubscription = async (storeId: string) => {
try {

const store: any = await Store.findById(storeId).lean();
if (!store) return null;

const now = new Date();

/* =====================================================
SAFE DATES
===================================================== */

const installedAt = store.installedAt
? new Date(store.installedAt)
: store.createdAt
? new Date(store.createdAt)
: now;

const paidUntil = store.paidUntil
? new Date(store.paidUntil)
: null;

const graceUntil = store.graceUntil
? new Date(store.graceUntil)
: null;

/* =====================================================
🔥 STATUS LOCKED — SOURCE DE VÉRITÉ
===================================================== */

const lockedStatus = store.subscriptionStatus || "trial";

/* =====================================================
🔵 ABONNEMENT ACTIF (SEUL CAS AVEC DATE)
===================================================== */

if (
lockedStatus === "active" &&
paidUntil &&
paidUntil > now
) {

const diff =
(paidUntil.getTime() - now.getTime()) /
(1000 * 60 * 60 * 24);

return {
status: "active",
subscriptionStatus: "active",
plan: store.plan || "PRO",
access: true,
daysLeft: Math.ceil(diff),
installedAt: installedAt.toISOString(),
paidUntil: paidUntil.toISOString(), // ✅ renvoyé UNIQUEMENT ici
message: "Abonnement actif",
};
}

/* =====================================================
🟠 GRACE PERIOD LOCKED
===================================================== */

if (
lockedStatus === "grace" &&
graceUntil &&
graceUntil > now
) {
return {
status: "grace",
subscriptionStatus: "grace",
plan: store.plan || "PRO",
access: true,
installedAt: installedAt.toISOString(),
graceUntil: graceUntil.toISOString(),
message: "Pensez à activer votre abonnement",
};
}

/* =====================================================
🟢 ESSAI GRATUIT LOCKED
===================================================== */

if (lockedStatus === "trial") {
return {
status: "trial",
subscriptionStatus: "trial",
plan: "Essai gratuit",
access: true,
installedAt: installedAt.toISOString(),
message: "Essai gratuit actif",
};
}

/* =====================================================
🔴 BLOQUÉ LOCKED
===================================================== */

if (lockedStatus === "blocked") {
return {
status: "blocked",
subscriptionStatus: "blocked",
plan: "PRO",
access: false,
installedAt: installedAt.toISOString(),
message: "Abonnement requis",
};
}

/* =====================================================
🔥 FALLBACK SAFE (NE JAMAIS CASSER L'APP)
===================================================== */

return {
status: "trial",
subscriptionStatus: "trial",
plan: "Essai gratuit",
access: true,
installedAt: installedAt.toISOString(),
message: "Fallback safe",
};

} catch (e) {

console.error("❌ evaluateSubscription V8.1 error:", e);

return {
  status: "error",
  subscriptionStatus: "blocked",
  plan: "PRO",
  access: false,
  message: "Erreur moteur abonnement",
};

}
};
