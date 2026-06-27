import dotenv from "dotenv";
dotenv.config();

const AF_API_TOKEN = process.env.AF_API_TOKEN || "";
const AF_SENDER_ID = process.env.AF_SENDER_ID || "VocoShop";

export async function sendSMSAfricala(phone: string, message: string): Promise<boolean> {
  if (!AF_API_TOKEN) {
    console.warn("⚠️ Africala non configuré (AF_API_TOKEN manquant)");
    return false;
  }

  // Africala attend le numéro SANS le +
  const formatted = phone.replace(/^\+/, "");

  try {
    const res = await fetch("https://api2.smsala.com/SendSmsV2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          apiToken: AF_API_TOKEN,
          messageType: "1",
          messageEncoding: "1",
          destinationAddress: formatted,
          sourceAddress: AF_SENDER_ID,
          messageText: message,
          userReferenceId: "",
        },
      ]),
    });

    const data: any = await res.json();

    const result = Array.isArray(data) ? data[0] : data;
    const statusOk =
      result?.Status === "Success" ||
      result?.status === "S" ||
      result?.OperationCode === 0;

    if (statusOk) {
      console.log("✅ Africala SMS envoyé à:", formatted);
      return true;
    }

    console.error("❌ Africala SMS error:", result?.Remarks || result?.remarks || result);
    return false;
  } catch (err) {
    console.error("❌ Africala SMS exception:", err);
    return false;
  }
}
