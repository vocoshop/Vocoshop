// src/services/africasTalkingService.ts
import dotenv from "dotenv";
dotenv.config();

const AT_API_KEY = process.env.AT_API_KEY || "";
const AT_USERNAME = process.env.AT_USERNAME || "sandbox";
const AT_SENDER_ID = process.env.AT_SENDER_ID || "VocoShop";
const AT_BASE = "https://api.africastalking.com/version1";

const AT_SMS_COUNTRIES = [
  "254", "256", "255", "250", "234", "233", "27", "243",
  "251", "265", "260", "263", "225", "237", "221", "258",
  "229", "267", "226", "257", "268", "220", "224", "266",
  "223", "264", "227", "232", "228",
];

export function isAtSupportedCountry(phone: string): boolean {
  let p = phone.replace(/[^\d]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  for (const code of AT_SMS_COUNTRIES) {
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
    const body = new URLSearchParams({
      to: formatted,
      message,
      from: AT_SENDER_ID,
    });

    const res = await fetch(`${AT_BASE}/messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey: AT_API_KEY,
        Accept: "application/json",
        username: AT_USERNAME,
      },
      body: body.toString(),
    });

    const data: any = await res.json();
    const entry = data?.SMSMessageData?.Recipients?.[0];
    if (entry?.status === "Success" || entry?.status === "Submitted") {
      console.log("✅ AT SMS envoyé à:", formatted, "| status:", entry.status);
      return true;
    }

    console.error("❌ AT SMS error:", data?.SMSMessageData || data);
    return false;
  } catch (err: any) {
    console.error("❌ AT SMS exception:", err?.message || err);
    return false;
  }
}
