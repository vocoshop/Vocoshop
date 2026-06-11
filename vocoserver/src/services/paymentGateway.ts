import { detectOperator } from "../utils/operatorDetector";
import { createChariowCheckout, isChariowConfigured } from "./chariowService";

/* =====================================================
TYPES
===================================================== */
type PaymentPayload = {
  method: "mobile_money" | "card" | "chariow";
  phone?: string;
  card?: string;
  expiry?: string;
  cvc?: string;
  storeId: string;
  email?: string;
  countryCode?: string;
};

type PaymentResult = {
  success: boolean;
  operator?: string;
  txRef?: string;
  flwRef?: string;
};

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_PUBLIC_KEY = process.env.FLW_PUBLIC_KEY || "";
const FLW_BASE = "https://api.flutterwave.com/v3";
const AMOUNT = Number(process.env.FLW_AMOUNT) || 3900; // XAF
const CURRENCY = "XAF";

/* =====================================================
Generate unique transaction reference
===================================================== */
function generateTxRef(storeId: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `VOCOS_${storeId.slice(-6)}_${ts}${rand}`;
}

/* =====================================================
Mobile Money charge via Flutterwave
===================================================== */
async function chargeMobileMoney(
  phone: string,
  storeId: string,
  operator: string
): Promise<PaymentResult> {
  const txRef = generateTxRef(storeId);

  // Map operator to Flutterwave country / network
  const networkMap: Record<string, { country: string; network: string }> = {
    MTN: { country: "CM", network: "MTN" },
    ORANGE: { country: "CM", network: "ORANGE" },
    AIRTEL: { country: "CG", network: "AIRTEL" },
    MOOV: { country: "CI", network: "MOOV" },
  };
  const info = networkMap[operator] || { country: "CM", network: operator };

  const payload = {
    tx_ref: txRef,
    amount: AMOUNT,
    currency: CURRENCY,
    network: info.network,
    country: info.country,
    email: `store_${storeId}@vocoshop.com`,
    phone_number: phone,
    fullname: `Boutique ${storeId}`,
  };

  try {
    const res = await fetch(`${FLW_BASE}/charges?type=mobile_money`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.status === "success" || data.status === "pending") {
      return {
        success: true,
        operator,
        txRef,
        flwRef: data.data?.flw_ref || data.data?.id?.toString(),
      };
    }

    throw new Error(data.message || "Échec du paiement mobile money");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur réseau Flutterwave";
    throw new Error(msg);
  }
}

/* =====================================================
Card charge via Flutterwave
===================================================== */
async function chargeCard(
  card: string,
  expiry: string,
  cvc: string,
  storeId: string
): Promise<PaymentResult> {
  const txRef = generateTxRef(storeId);
  const [expMonth, expYear] = expiry.split("/").map((s) => s.trim());

  const payload = {
    tx_ref: txRef,
    amount: AMOUNT,
    currency: CURRENCY,
    card_number: card.replace(/\s/g, ""),
    cvv: cvc,
    expiry_month: expMonth || "12",
    expiry_year: expYear || "30",
    email: `store_${storeId}@vocoshop.com`,
    fullname: `Boutique ${storeId}`,
  };

  try {
    const res = await fetch(`${FLW_BASE}/charges?type=card`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.status === "success" || data.status === "pending") {
      return {
        success: true,
        txRef,
        flwRef: data.data?.flw_ref || data.data?.id?.toString(),
      };
    }

    throw new Error(data.message || "Échec du paiement par carte");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur réseau Flutterwave";
    throw new Error(msg);
  }
}

/* =====================================================
MAIN — processSubscriptionPayment (Flutterwave v3)
===================================================== */
export async function processSubscriptionPayment(
  payload: PaymentPayload
): Promise<PaymentResult> {
  // Fallback: if Flutterwave not configured, use stub
  if (!FLW_SECRET_KEY || FLW_SECRET_KEY === "your_flw_secret_key") {
    console.log("⚠️ Flutterwave non configuré — mode simulation");
    if (payload.method === "mobile_money") {
      const operator = detectOperator(payload.phone || "");
      return { success: true, operator, txRef: `sim_${Date.now()}` };
    }
    return { success: true, txRef: `sim_${Date.now()}` };
  }

  if (payload.method === "mobile_money") {
    if (!payload.phone) throw new Error("Numéro requis");
    const operator = detectOperator(payload.phone);
    if (operator === "UNKNOWN") throw new Error("Opérateur non reconnu");
    return chargeMobileMoney(payload.phone, payload.storeId, operator);
  }

  if (payload.method === "card") {
    if (!payload.card || !payload.expiry || !payload.cvc) {
      throw new Error("Carte invalide");
    }
    return chargeCard(payload.card, payload.expiry, payload.cvc, payload.storeId);
  }

  /* =====================================================
     CHARIOW — Checkout URL (alternative sans société)
     ===================================================== */
  if (payload.method === "chariow") {
    if (!payload.email || !payload.phone) {
      throw new Error("email et phone requis pour Chariow");
    }
    const result = await createChariowCheckout({
      email: payload.email,
      firstName: "Client",
      lastName: "Vocoshop",
      phone: payload.phone,
      countryCode: payload.countryCode || "CG",
      metadata: {
        store_id: payload.storeId,
        plan: "PRO",
        source: "vocoshop_app",
      },
    });
    if (!result.success) {
      throw new Error(result.error || "Échec Chariow");
    }
    return {
      success: true,
      txRef: result.transactionId,
      flwRef: result.saleId,
    };
  }

  throw new Error("Méthode inconnue");
}

/* =====================================================
Verify transaction (used by webhook)
===================================================== */
export async function verifyTransaction(txRef: string): Promise<boolean> {
  if (!FLW_SECRET_KEY || FLW_SECRET_KEY === "your_flw_secret_key") {
    return true; // stub mode
  }
  try {
    const res = await fetch(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${txRef}`, {
      headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` },
    });
    const data = await res.json();
    return data.status === "success" && data.data?.status === "successful";
  } catch {
    return false;
  }
}
