import dotenv from "dotenv";
import { logSystem } from "../utils/systemLogger";
dotenv.config();

const CHARIOW_API_KEY = process.env.CHARIOW_API_KEY || "";
const CHARIOW_BASE = "https://api.chariow.com/v1";
const CHARIOW_PRODUCT_ID = process.env.CHARIOW_PRODUCT_ID || "";
const CHARIOW_REDIRECT_URL = process.env.CHARIOW_REDIRECT_URL || "";

/* =====================================================
   Types
===================================================== */
type ChariowCheckoutPayload = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  countryCode: string;
  metadata?: Record<string, string>;
};

type ChariowCheckoutResult = {
  success: boolean;
  checkoutUrl?: string;
  transactionId?: string;
  saleId?: string;
  step?: string;
  error?: string;
};

/* =====================================================
   Vérifier si Chariow est configuré
===================================================== */
export function isChariowConfigured(): boolean {
  return Boolean(
    CHARIOW_API_KEY &&
    CHARIOW_API_KEY !== "your_chariow_api_key" &&
    CHARIOW_PRODUCT_ID &&
    CHARIOW_PRODUCT_ID !== "your_product_id"
  );
}

/* =====================================================
   Créer une session de checkout Chariow
   =====================================================
   ✔ Validation de la configuration avant appel
   ✔ Timeout sur l'appel réseau (10s)
   ✔ Logging de toutes les opérations
   ✔ Pas de simulation — fail si non configuré
===================================================== */
export async function createChariowCheckout(
  payload: ChariowCheckoutPayload
): Promise<ChariowCheckoutResult> {
  // Vérifier la configuration
  if (!isChariowConfigured()) {
    logSystem("error", "Chariow non configuré — checkout impossible", {
      source: "chariow_service",
    });
    return {
      success: false,
      error: "Paiement non configuré. Contactez le support.",
    };
  }

  if (!CHARIOW_PRODUCT_ID) {
    return { success: false, error: "CHARIOW_PRODUCT_ID non configuré" };
  }

  try {
    const body: Record<string, any> = {
      product_id: CHARIOW_PRODUCT_ID,
      email: payload.email,
      first_name: payload.firstName.slice(0, 50), // Limite Chariow
      last_name: payload.lastName.slice(0, 50),
      phone: {
        number: payload.phone.replace(/\D/g, ""),
        country_code: payload.countryCode.slice(0, 10),
      },
    };

    if (CHARIOW_REDIRECT_URL) {
      body.redirect_url = CHARIOW_REDIRECT_URL.slice(0, 2048);
    }

    if (payload.metadata) {
      // Limiter à 10 clés, 255 chars par valeur
      const meta: Record<string, string> = {};
      const keys = Object.keys(payload.metadata).slice(0, 10);
      for (const k of keys) {
        meta[k] = String(payload.metadata[k]).slice(0, 255);
      }
      body.custom_metadata = meta;
    }

    // Timeout 10 secondes
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${CHARIOW_BASE}/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CHARIOW_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await res.json();

    if (!res.ok) {
      const msg = data.message || `Erreur Chariow ${res.status}`;
      logSystem("error", `Chariow API error ${res.status}: ${msg}`, {
        source: "chariow_service",
        details: JSON.stringify({ status: res.status, body: data }).slice(0, 300),
      });
      return { success: false, error: msg };
    }

    const step = data.data?.step;
    const checkoutUrl = data.data?.payment?.checkout_url;
    const transactionId = data.data?.payment?.transaction_id;
    const saleId = data.data?.purchase?.id;

    logSystem("info", `Chariow checkout créé: saleId=${saleId} step=${step}`, {
      source: "chariow_service",
    });

    return {
      success: true,
      checkoutUrl,
      transactionId,
      saleId,
      step,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur réseau Chariow";
    logSystem("error", `Chariow network error: ${msg}`, {
      source: "chariow_service",
    });
    return { success: false, error: "Erreur de connexion au système de paiement" };
  }
}

/* =====================================================
   Récupérer la config (pour debug — dev only)
===================================================== */
export function getChariowConfig() {
  return {
    configured: isChariowConfigured(),
    productId: CHARIOW_PRODUCT_ID ? "✓ configuré" : "✗ manquant",
    redirectUrl: CHARIOW_REDIRECT_URL ? "✓ configuré" : "✗ manquant",
    // Ne JAMAIS exposer la clé API
  };
}
