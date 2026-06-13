// src/services/whatsappService.ts
import dotenv from "dotenv";
dotenv.config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

/**
 * Envoie un message WhatsApp via Meta Cloud API
 * Template : authentification (OTP) — 6 paramètres max
 * 
 * Env vars requises :
 * - WHATSAPP_TOKEN : Token d'accès Meta (permanent ou système)
 * - WHATSAPP_PHONE_NUMBER_ID : ID du numéro WhatsApp Business
 */

function formatPhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  return p;
}

export const sendWhatsApp = async (
  phone: string,
  templateName: string,
  params: string[]
): Promise<boolean> => {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("⚠️ WhatsApp non configuré (WHATSAPP_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquant)");
    return false;
  }

  const formatted = formatPhone(phone);

  try {
    const body = {
      messaging_product: "whatsapp",
      to: formatted,
      type: "template",
      template: {
        name: templateName,
        language: { code: "fr" },
        components: [
          {
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: p })),
          },
        ],
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ WhatsApp API error:", res.status, data);
      return false;
    }

    console.log("✅ WhatsApp envoyé:", data.messages?.[0]?.id || "ok");
    return true;
  } catch (err) {
    console.error("❌ WhatsApp send error:", err);
    return false;
  }
};

/**
 * Envoie un message texte gratuit (dans la fenêtre service 24h)
 * Utilisable quand le client nous a contacté en premier
 */
export const sendWhatsAppText = async (
  phone: string,
  message: string
): Promise<boolean> => {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return false;
  }

  const formatted = formatPhone(phone);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formatted,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ WhatsApp text error:", res.status, data);
      return false;
    }
    return true;
  } catch (err) {
    console.error("❌ WhatsApp text error:", err);
    return false;
  }
};
