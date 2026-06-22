// src/services/africasTalkingService.ts
import dotenv from "dotenv";
dotenv.config();

const AT_API_KEY = process.env.AT_API_KEY || "";
const AT_USERNAME = process.env.AT_USERNAME || "sandbox";
const AT_SENDER_ID = process.env.AT_SENDER_ID || "VocoShop";

// Liste des indicatifs téléphoniques africains
const AFRICAN_COUNTRY_CODES = [
  "242", // Congo (Brazzaville)
  "243", // RDC (Kinshasa)
  "237", // Cameroun
  "241", // Gabon
  "236", // Centrafrique
  "240", // Guinée Équatoriale
  "244", // Angola
  "245", // Guinée-Bissau
  "221", // Sénégal
  "225", // Côte d'Ivoire
  "226", // Burkina Faso
  "227", // Niger
  "228", // Togo
  "229", // Bénin
  "223", // Mali
  "224", // Guinée
  "232", // Sierra Leone
  "231", // Liberia
  "233", // Ghana
  "234", // Nigéria
  "254", // Kenya
  "255", // Tanzanie
  "256", // Ouganda
  "257", // Burundi
  "250", // Rwanda
  "251", // Éthiopie
  "252", // Somalie
  "253", // Djibouti
  "258", // Mozambique
  "260", // Zambie
  "263", // Zimbabwe
  "264", // Namibie
  "265", // Malawi
  "266", // Lesotho
  "267", // Botswana
  "268", // Eswatini
  "230", // Maurice
  "261", // Madagascar
  "262", // Réunion/Mayotte
  "269", // Comores
  "27",  // Afrique du Sud
  "211", // Soudan du Sud
  "212", // Maroc
  "213", // Algérie
  "216", // Tunisie
  "218", // Libye
  "249", // Soudan
  "20",  // Égypte
];

export function isAfricanNumber(phone: string): boolean {
  let p = phone.replace(/[^\d]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  for (const code of AFRICAN_COUNTRY_CODES) {
    if (p.startsWith(code)) return true;
  }
  return false;
}

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
