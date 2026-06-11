// src/services/smsService.ts
import africastalking from "africastalking";
import dotenv from "dotenv";
dotenv.config();

const at = africastalking({
apiKey: process.env.AT_API_KEY as string,
username: process.env.AT_USERNAME as string,
});

const sms = at.SMS;

export const sendSMS = async (phone: string, message: string) => {
try {
const res = await sms.send({
to: [phone],
message,
from: process.env.AT_SENDER_ID || undefined,
});

console.log("📨 SMS envoyé :", res);
return true;
} catch (err) {
console.error("❌ Erreur envoi SMS:", err);
return false;
}
};
