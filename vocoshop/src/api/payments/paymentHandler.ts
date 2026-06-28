import API from "../api";

type PaymentPayload = {
method: "mobile_money" | "card";
phone?: string;
card?: string;
expiry?: string;
cvc?: string;
email?: string;
countryCode?: string;
};

/**
 * 🔥 PAYMENT HANDLER GLOBAL
 * - Mobile Money → Yabetoo (intégré)
 */
export async function handleSubscriptionPayment(payload: PaymentPayload): Promise<true | { checkoutUrl: string }> {
try {

/* =====================================================
📱 MOBILE MONEY → YABETOO
===================================================== */
if (payload.method === "mobile_money") {

if (!payload.phone) {
throw new Error("Numéro manquant");
}

const email = payload.email || `client_${Date.now()}@vocoshop.com`;

const res: any = await API.post("/yabetoo/checkout", { email });

if (res.data?.checkoutUrl) {
return { checkoutUrl: res.data.checkoutUrl };
}

throw new Error(res.data?.error || "Échec du paiement");
}

/* =====================================================
💳 CARTE BANCAIRE
===================================================== */
if (payload.method === "card") {

if (!payload.card || !payload.expiry || !payload.cvc) {
throw new Error("Informations carte incomplètes");
}

await API.post("/subscription/activate", {
method: "card",
card: payload.card,
expiry: payload.expiry,
cvc: payload.cvc,
});

return true;
}

throw new Error("Méthode inconnue");

} catch (e) {
console.log("❌ PaymentHandler error:", e);
throw e;
}
}
