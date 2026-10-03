import API from "../api";

type PaymentPayload = {
  method: "mobile_money" | "card";
  phone?: string;
  email?: string;
};

export async function handleSubscriptionPayment(payload: PaymentPayload): Promise<{ checkoutUrl: string }> {
  try {
    if (payload.method !== "mobile_money" && payload.method !== "card") {
      throw new Error("Méthode inconnue");
    }

    if (payload.method === "mobile_money" && !payload.phone?.trim()) {
      throw new Error("Numéro manquant");
    }

    const email = payload.email?.trim() || `client_${Date.now()}@vocoshop.com`;
    const res: any = await API.post("/yabetoo/checkout", { email });

    if (!res.data?.checkoutUrl) {
      throw new Error(res.data?.error || "Échec du paiement");
    }

    return { checkoutUrl: res.data.checkoutUrl };
  } catch (e) {
    console.log("❌ PaymentHandler error:", e);
    throw e;
  }
}
