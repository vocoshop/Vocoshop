import { logSystem } from "../utils/systemLogger";

const EXPECTED_AMOUNT = 3900;

// DEBUG: module load time
const debugLoadKey = process.env.YABETOO_API_KEY;
const debugAllYabetoo = Object.keys(process.env).filter(k => k.includes("YABETOO") || k.includes("yabetoo"));
console.log(`⚡ [yabetooService] LOAD TIME: YABETOO_API_KEY exists=${!!debugLoadKey}, length=${debugLoadKey?.length ?? "N/A"}, keys_with_yabetoo=${JSON.stringify(debugAllYabetoo)}`);

function apiKey(): string {
  const val = process.env.YABETOO_API_KEY;
  const exists = val !== undefined && val !== null && val !== "";
  console.log(`🔍 [yabetooService] apiKey() called: exists=${!!val}, type=${typeof val}, length=${val?.length ?? 0}, val_8="${val?.slice(0, 8) ?? "N/A"}"`);
  return val || "";
}

function apiBase(): string {
  const key = apiKey();
  if (key.startsWith("sk_test_")) return "https://buy.api.yabetoopay.com";
  return "https://api.yabetoo.com";
}

function successUrl(): string {
  return process.env.YABETOO_SUCCESS_URL || "";
}

function cancelUrl(): string {
  return process.env.YABETOO_CANCEL_URL || "";
}

type YabetooSessionResult = {
  success: boolean;
  sessionUrl?: string;
  sessionId?: string;
  error?: string;
};

export function isConfigured(): boolean {
  const key = apiKey();
  const configured = Boolean(key && key !== "your_yabetoo_api_key");
  if (!configured) {
    logSystem("warning", `Yabetoo isConfigured=false (key length=${key.length}, prefix="${key.slice(0, 8)}")`, {
      source: "yabetoo_service",
    });
  }
  return configured;
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
      success_url: successUrl() ? `${successUrl()}?store_id=${storeId}` : "",
      cancel_url: cancelUrl() || "",
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

    const base = apiBase();
    const key = apiKey();

    logSystem("info", `Yabetoo: appel API ${base}/checkout/sessions (key prefix: ${key.slice(0, 8)}...)`, {
      source: "yabetoo_service",
    });

    const res = await fetch(`${base}/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
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
        details: JSON.stringify({ status: res.status, body: data }).slice(0, 500),
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
    keyPrefix: apiKey().slice(0, 8) + "...",
    baseUrl: apiBase(),
    successUrl: successUrl() ? "✓ configuré" : "✗ manquant",
    cancelUrl: cancelUrl() ? "✓ configuré" : "✗ manquant",
  };
}
