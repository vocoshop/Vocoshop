import { logSystem } from "../utils/systemLogger";

const YABETOO_API_KEY = process.env.YABETOO_API_KEY || "";
const YABETOO_BASE = "https://api.yabetoo.com/v1";
const YABETOO_SUCCESS_URL = process.env.YABETOO_SUCCESS_URL || "";
const YABETOO_CANCEL_URL = process.env.YABETOO_CANCEL_URL || "";

const EXPECTED_AMOUNT = 3900;

type YabetooSessionResult = {
  success: boolean;
  sessionUrl?: string;
  sessionId?: string;
  error?: string;
};

export function isConfigured(): boolean {
  return Boolean(YABETOO_API_KEY && YABETOO_API_KEY !== "your_yabetoo_api_key");
}

export async function createCheckoutSession(
  customerEmail: string,
  storeId: string,
  metadata?: Record<string, string>
): Promise<YabetooSessionResult> {
  if (!isConfigured()) {
    logSystem("error", "Yabetoo non configuré — checkout impossible", { source: "yabetoo_service" });
    return { success: false, error: "Paiement non configuré. Contactez le support." };
  }

  try {
    const body: Record<string, any> = {
      success_url: YABETOO_SUCCESS_URL ? `${YABETOO_SUCCESS_URL}?store_id=${storeId}` : "",
      cancel_url: YABETOO_CANCEL_URL || "",
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "XAF",
            unit_amount: EXPECTED_AMOUNT,
            product_data: { name: "Abonnement Vocoshop PRO - 1 mois" },
          },
          quantity: 1,
        },
      ],
      client_reference_id: storeId,
      metadata: { store_id: storeId, ...metadata },
    };

    if (customerEmail) body.customer_email = customerEmail;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${YABETOO_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${YABETOO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data: any = await res.json();

    if (!res.ok) {
      const msg = data.message || `Erreur Yabetoo ${res.status}`;
      logSystem("error", `Yabetoo API error ${res.status}: ${msg}`, {
        source: "yabetoo_service",
        details: JSON.stringify({ status: res.status }).slice(0, 300),
      });
      return { success: false, error: msg };
    }

    logSystem("info", `Yabetoo session créée: id=${data.id}`, { source: "yabetoo_service" });

    return {
      success: true,
      sessionUrl: data.url,
      sessionId: data.id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur réseau Yabetoo";
    logSystem("error", `Yabetoo network error: ${msg}`, { source: "yabetoo_service" });
    return { success: false, error: "Erreur de connexion au système de paiement" };
  }
}

export function getConfig() {
  return {
    configured: isConfigured(),
    successUrl: YABETOO_SUCCESS_URL ? "✓ configuré" : "✗ manquant",
    cancelUrl: YABETOO_CANCEL_URL ? "✓ configuré" : "✗ manquant",
  };
}
