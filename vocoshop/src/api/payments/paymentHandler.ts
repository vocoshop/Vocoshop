import API from "../api";

type PaymentPayload = {
method: "mobile_money" | "card" | "chariow" | "yabetoo";
phone?: string;
card?: string;
expiry?: string;
cvc?: string;
email?: string;
countryCode?: string;
};

/**
 * 🔥 PAYMENT HANDLER GLOBAL
 * - Yabetoo (Mobile Money — recommandé)
 * - Chariow (fallback)
 */
export async function handleSubscriptionPayment(payload: PaymentPayload): Promise<true | { checkoutUrl: string }> {
try {

/* =====================================================
📱 YABETOO (Mobile Money Congo)
===================================================== */
if (payload.method === "yabetoo") {

if (!payload.email) {
throw new Error("Email requis");
}

const res: any = await API.post("/yabetoo/checkout", {
email: payload.email,
});

if (res.data?.checkoutUrl) {
return { checkoutUrl: res.data.checkoutUrl };
}

throw new Error(res.data?.error || "Échec Yabetoo");
}

/* =====================================================
📱 MOBILE MONEY
===================================================== */
if (payload.method === "mobile_money") {

if (!payload.phone) {
throw new Error("Numéro manquant");
}

await API.post("/subscription/activate", {
method: "mobile_money",
phone: payload.phone,
});

return true;
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

/* =====================================================
🔶 CHARIOW (fallback)
===================================================== */
if (payload.method === "chariow") {

if (!payload.email || !payload.phone) {
throw new Error("Email et numéro requis");
}

const res: any = await API.post("/chariow/checkout", {
email: payload.email,
phone: payload.phone,
countryCode: payload.countryCode || "CG",
});

if (res.data?.checkoutUrl) {
return { checkoutUrl: res.data.checkoutUrl };
}

throw new Error(res.data?.error || "Échec Chariow");
}

throw new Error("Méthode inconnue");

} catch (e) {
console.log("❌ PaymentHandler error:", e);
throw e;
}
}
