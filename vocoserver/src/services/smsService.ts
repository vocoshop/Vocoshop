// src/services/smsService.ts
import dotenv from "dotenv";
dotenv.config();

import { sendSMSAfrica, isAtSupportedCountry } from "./africasTalkingService";

// Vonage (ex-Nexmo) — fallback pour numéros non-africains
const VONAGE_API_KEY = process.env.VONAGE_API_KEY || "";
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || "";
const VONAGE_FROM = process.env.VONAGE_FROM || "VocoShop";

export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  let formatted = phone.replace(/[\s\-()]/g, "");
  if (formatted.startsWith("00")) formatted = "+" + formatted.slice(2);
  if (!formatted.startsWith("+")) formatted = "+" + formatted;

  // Route via Africa's Talking si le pays est supporté
  if (isAtSupportedCountry(formatted)) {
    return sendSMSAfrica(formatted, message);
  }

  // Fallback Vonage pour les autres numéros
  return sendSMSVonage(formatted, message);
};

async function sendSMSVonage(phone: string, message: string): Promise<boolean> {
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
    console.warn("⚠️ Vonage non configuré (VONAGE_API_KEY ou VONAGE_API_SECRET manquant)");
    return false;
  }

  let formatted = phone.replace(/[^+\d]/g, "");
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
      console.log("✅ Vonage SMS envoyé:", formatted);
      return true;
    }

    console.error("❌ Vonage SMS error:", data.messages?.[0]?.["error-text"] || data);
    return false;
  } catch (err) {
    console.error("❌ Vonage SMS exception:", err);
    return false;
  }
}
