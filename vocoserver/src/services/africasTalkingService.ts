// src/services/africasTalkingService.ts
import dotenv from "dotenv";
dotenv.config();

const AT_API_KEY = process.env.AT_API_KEY || "";
const AT_USERNAME = process.env.AT_USERNAME || "sandbox";
const AT_SENDER_ID = process.env.AT_SENDER_ID || "VocoShop";

// Pays supportés par Africa's Talking pour l'envoi de SMS
// Source: https://africastalking.com/sms/bulksms — International Markets
const AT_SMS_COUNTRIES = [
  "254", // Kenya
  "256", // Ouganda
  "255", // Tanzanie
  "250", // Rwanda
  "234", // Nigéria
  "233", // Ghana
  "27",  // Afrique du Sud
  "243", // RDC (Kinshasa)
  "251", // Éthiopie
  "265", // Malawi
  "260", // Zambie
  "263", // Zimbabwe
  "225", // Côte d'Ivoire
  "237", // Cameroun
  "221", // Sénégal
  "258", // Mozambique
  "229", // Bénin
  "267", // Botswana
  "226", // Burkina Faso
  "257", // Burundi
  "268", // Eswatini
  "220", // Gambie
  "224", // Guinée
  "266", // Lesotho
  "223", // Mali
  "264", // Namibie
  "227", // Niger
  "232", // Sierra Leone
  "228", // Togo
];

export function isAtSupportedCountry(phone: string): boolean {
  let p = phone.replace(/[^\d]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  for (const code of AT_SMS_COUNTRIES) {
    if (p.startsWith(code)) return true;
  }
  return false;
}

// Note: Pour les pays africains non supportés par AT (ex: +242 Congo-Brazzaville),
// le fallback Vonage est utilisé.

export async function sendSMSAfrica(
  phone: string,
  message: string
): Promise<boolean> {
  if (!AT_API_KEY) {
    console.warn("⚠️ Africa's Talking non configuré (AT_API_KEY manquant)");
    return false;
  }

  let formatted = phone.replace(/[\s\-()]/g, "");
  if (formatted.startsWith("00")) formatted = "+" + formatted.slice(2);
  if (!formatted.startsWith("+")) formatted = "+" + formatted;

  try {
    const africastalking = require("africastalking");
    const sdk = africastalking({
      apiKey: AT_API_KEY,
      username: AT_USERNAME,
    });

    const result = await sdk.SMS.send({
      to: [formatted],
      message,
      from: AT_SENDER_ID,
    });

    const entry = result?.SMSMessageData?.Recipients?.[0];
    if (entry?.status === "Success" || entry?.status === "Submitted") {
      console.log("✅ AT SMS envoyé à:", formatted, "| status:", entry.status);
      return true;
    }

    console.error("❌ AT SMS error:", result?.SMSMessageData || result);
    return false;
  } catch (err: any) {
    console.error("❌ AT SMS exception:", err?.message || err);
    return false;
  }
}
