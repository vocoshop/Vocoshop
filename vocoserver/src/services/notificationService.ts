// src/services/notificationService.ts
import { sendWhatsApp, sendWhatsAppText } from "./whatsappService";
import { sendSMS } from "./smsService";

/**
 * Service unifié de notifications Vocoshop
 *
 * RÈGLE :
 * - OTP / Authentification → SMS uniquement (universel, tout le monde a un téléphone)
 * - Campagnes / Promotions / Notifications → WhatsApp (gratuit <1000/mois, plus riche)
 * - WhatsApp d'abord → SMS en fallback pour les notifications non-OTP
 */

// ─── OTP : SMS uniquement ───────────────────────────────────
export const notifyAuthCode = async (phone: string, code: string): Promise<{ whatsapp: boolean; sms: boolean }> => {
  const sms = await sendSMS(phone, `Votre code VocoShop est : ${code}. Valable 10 min. Ne partagez ce code avec personne.`);
  return { whatsapp: false, sms };
};

// ─── Welcome : SMS (car OTP-like, credentials sensibles) ───
const APP_URL = "www.vocoshop.app";
export const notifyWelcome = async (
  phone: string,
  firstName: string,
  agentCode: string,
  authCode: string
): Promise<{ whatsapp: boolean; sms: boolean }> => {
  const msg =
    `Vocoshop\n` +
    `Bonjour ${firstName}, bienvenue!\n\n` +
    `Votre compte est activé.\n` +
    `Code Agent: ${agentCode}\n` +
    `Code connexion: ${authCode}\n\n` +
    `Connectez-vous sur ${APP_URL}`;
  const sms = await sendSMS(phone, msg);
  return { whatsapp: false, sms };
};

// ─── Password reset : SMS (credentials sensibles) ──────────
export const notifyPasswordReset = async (
  phone: string,
  firstName: string,
  tempPassword: string
): Promise<{ whatsapp: boolean; sms: boolean }> => {
  const msg = `Vocoshop\nBonjour ${firstName},\nVotre mot de passe temporaire: ${tempPassword}\nChangez-le après connexion.`;
  const sms = await sendSMS(phone, msg);
  return { whatsapp: false, sms };
};

// ─── Notification générale : WhatsApp d'abord, SMS fallback ─
export const notifyText = async (phone: string, message: string): Promise<boolean> => {
  const wa = await sendWhatsAppText(phone, message);
  if (wa) return true;
  return await sendSMS(phone, message);
};

// ─── Campagne / Promotion : WhatsApp uniquement ────────────
export const notifyCampaign = async (phone: string, message: string): Promise<{ whatsapp: boolean; sms: boolean }> => {
  const wa = await sendWhatsAppText(phone, message);
  if (wa) return { whatsapp: true, sms: false };
  const sms = await sendSMS(phone, message);
  return { whatsapp: false, sms };
};
