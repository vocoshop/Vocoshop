// src/services/smsService.ts
import dotenv from "dotenv";
dotenv.config();

// Vonage (ex-Nexmo) — SMS OTP
// Docs: https://developer.vonage.com/en/api/sms
const VONAGE_API_KEY = process.env.VONAGE_API_KEY || "";
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || "";
const VONAGE_FROM = process.env.VONAGE_FROM || "VocoShop";

export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
    console.warn("⚠️ Vonage non configuré (VONAGE_API_KEY ou VONAGE_API_SECRET manquant)");
    return false;
  }

  // Formater le numéro : retirer espaces, tirets, parenthèses
  let formatted = phone.replace(/[\s\-()]/g, "");
  if (formatted.startsWith("+")) formatted = formatted.slice(1);

  try {
    const params = new URLSearchParams({
      api_key: VONAGE_API_KEY,
      api_secret: VONAGE_API_SECRET,
      to: formatted,
      from: VONAGE_FROM,
      text: message,
    });

    const res = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data: any = await res.json();

    if (data.messages && data.messages[0]?.status === "0") {
      console.log("✅ SMS Vonage envoyé:", formatted);
      return true;
    }

    console.error("❌ Vonage SMS error:", data.messages?.[0]?.["error-text"] || data);
    return false;
  } catch (err) {
    console.error("❌ Vonage SMS exception:", err);
    return false;
  }
};
