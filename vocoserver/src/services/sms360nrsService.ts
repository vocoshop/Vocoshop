import dotenv from "dotenv";
dotenv.config();

const NRS_API_TOKEN = process.env.NRS_API_TOKEN || "";
const NRS_FROM = process.env.NRS_FROM || "VocoShop";

export async function sendSMS360nrs(phone: string, message: string): Promise<boolean> {
  if (!NRS_API_TOKEN) {
    console.warn("⚠️ 360NRS non configuré (NRS_API_TOKEN manquant)");
    return false;
  }

  // 360NRS attend le numéro SANS le +
  const formatted = phone.replace(/^\+/, "");

  try {
    const res = await fetch("https://dashboard.360nrs.com/api/rest/sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${NRS_API_TOKEN}`,
      },
      body: JSON.stringify({
        to: [formatted],
        from: NRS_FROM,
        message,
      }),
    });

    const data: any = await res.json();

    if (res.status === 202 && data?.result?.[0]?.accepted === true) {
      console.log("✅ 360NRS SMS envoyé à:", formatted);
      return true;
    }

    console.error("❌ 360NRS SMS error:", data?.error || data?.result || data);
    return false;
  } catch (err) {
    console.error("❌ 360NRS SMS exception:", err);
    return false;
  }
}
