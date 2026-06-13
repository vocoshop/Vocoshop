// src/services/notificationService.ts
import { sendWhatsApp, sendWhatsAppText } from "./whatsappService";
import { sendSMS } from "./smsService";

/**
 * Service unifié d'envoi de messages
 * WhatsApp en priorité → SMS en fallback
 * 
 * Templates WhatsApp requis (à créer dans Meta Business Suite) :
 * - "voco_auth" : Authentification/OTP → {{1}} = code
 * - "voco_welcome" : Bienvenue agent → {{1}} = prénom, {{2}} = code agent, {{3}} = code connexion
 * - "voco_password" : Mot de passe temporaire → {{1}} = prénom, {{2}} = mot de passe
 */

export const notifyAuthCode = async (phone: string, code: string): Promise<{ whatsapp: boolean; sms: boolean }> => {
  const wa = await sendWhatsApp(phone, "voco_auth", [code]);
  if (wa) return { whatsapp: true, sms: false };

  const sms = await sendSMS(phone, `Votre code de connexion Vocoshop est : ${code}`);
  return { whatsapp: false, sms };
};

export const notifyWelcome = async (
  phone: string,
  firstName: string,
  agentCode: string,
  authCode: string
): Promise<{ whatsapp: boolean; sms: boolean }> => {
  const wa = await sendWhatsApp(phone, "voco_welcome", [firstName, agentCode, authCode]);
  if (wa) return { whatsapp: true, sms: false };

  const msg =
    `Vocoshop 🎉\n` +
    `Bonjour ${firstName},\n` +
    `Bienvenue dans l'équipe!\n\n` +
    `Votre compte a été validé.\n` +
    `🔑 Code Agent: ${agentCode}\n` +
    `🔐 Code de connexion: ${authCode}\n\n` +
    `Connectez-vous sur:\n` +
    `https://voco.shop/login`;
  const sms = await sendSMS(phone, msg);
  return { whatsapp: false, sms };
};

export const notifyPasswordReset = async (
  phone: string,
  firstName: string,
  tempPassword: string
): Promise<{ whatsapp: boolean; sms: boolean }> => {
  const wa = await sendWhatsApp(phone, "voco_password", [firstName, tempPassword]);
  if (wa) return { whatsapp: true, sms: false };

  const msg = `Vocoshop\nBonjour ${firstName},\nVotre nouveau mot de passe est : ${tempPassword}\nChangez-le après connexion.`;
  const sms = await sendSMS(phone, msg);
  return { whatsapp: false, sms };
};

export const notifyText = async (phone: string, message: string): Promise<boolean> => {
  const wa = await sendWhatsAppText(phone, message);
  if (wa) return true;
  return await sendSMS(phone, message);
};
