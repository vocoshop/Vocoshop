// controllers/communicationController.ts
import { Request, Response } from "express";
import Store from "../models/Store";
import Agent from "../models/Agent";
import CommunicationLog from "../models/CommunicationLog";
import { sendSMS } from "../services/smsService";
import { sendWhatsAppText } from "../services/whatsappService";
import { logSystem } from "../utils/systemLogger";

/**
 * Communication Controller
 *
 * RÈGLE :
 * - Campagnes/Promotions → WhatsApp en priorité, SMS en fallback
 * - OTP/Auth → SMS uniquement (géré par agentController/otpController)
 */

/* =====================================================
POST /api/admin/communication/send
Body: { channel, recipients, message, subject?, city? }
===================================================== */
export const sendCommunication = async (req: Request, res: Response) => {
  try {
    const channel = String(req.body?.channel || "whatsapp"); // "sms" | "whatsapp"
    const recipients = String(req.body?.recipients || "all_stores");
    const message = String(req.body?.message || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const city = String(req.body?.city || "").trim();

    if (!message) return res.status(400).json({ error: "Message requis" });
    if (!["sms", "whatsapp"].includes(channel)) {
      return res.status(400).json({ error: "Canal invalide (sms ou whatsapp)" });
    }

    let phones: { phone: string; name?: string }[] = [];

    switch (recipients) {
      case "all_stores": {
        const stores = await Store.find({}).select("phone storeName ownerName").lean();
        phones = stores.map((s: any) => ({ phone: s.phone, name: s.ownerName || s.storeName })).filter(s => s.phone);
        break;
      }
      case "all_agents": {
        const agents = await Agent.find({ isApproved: true }).select("phone name").lean();
        phones = agents.map((a: any) => ({ phone: a.phone, name: a.name })).filter(a => a.phone);
        break;
      }
      case "active_stores": {
        const stores = await Store.find({ subscriptionStatus: "active" }).select("phone storeName ownerName").lean();
        phones = stores.map((s: any) => ({ phone: s.phone, name: s.ownerName || s.storeName })).filter(s => s.phone);
        break;
      }
      case "stores_by_city": {
        if (!city) return res.status(400).json({ error: "Ville requise" });
        const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stores = await Store.find({ city: new RegExp(escapedCity, "i") }).select("phone storeName ownerName").lean();
        phones = stores.map((s: any) => ({ phone: s.phone, name: s.ownerName || s.storeName })).filter(s => s.phone);
        break;
      }
      default:
        return res.status(400).json({ error: "Destinataires invalides" });
    }

    if (phones.length === 0) {
      return res.status(400).json({ error: "Aucun destinataire trouvé" });
    }

    // Dédupliquer
    const uniquePhones = [...new Set(phones.map(p => p.phone))];
    const phoneMap = new Map(phones.map(p => [p.phone, p.name]));

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const subjectPrefix = subject ? `[${subject}] ` : "";

    for (const phone of uniquePhones) {
      try {
        let ok = false;
        if (channel === "whatsapp") {
          // WhatsApp en priorité pour les campagnes
          ok = await sendWhatsAppText(phone, `${subjectPrefix}${message}`);
          // Si WhatsApp échoue, fallback SMS
          if (!ok) {
            ok = await sendSMS(phone, `${subjectPrefix}${message}`);
          }
        } else {
          // SMS direct
          ok = await sendSMS(phone, `${subjectPrefix}${message}`);
        }
        if (ok) sent++;
        else failed++;
      } catch (e: any) {
        failed++;
        errors.push(`${phone}: ${e.message}`);
      }
    }

    const status = sent === 0 ? "failed" : failed > 0 ? "partial" : "sent";

    await CommunicationLog.create({
      channel,
      recipients,
      recipientCount: uniquePhones.length,
      subject: subject || undefined,
      message,
      sent,
      failed,
      errorDetails: errors.slice(0, 20),
      status,
      city: city || undefined,
      sentBy: (req as any).user?.id || "admin",
    });

    logSystem("info", `Communication: ${channel} → ${sent}/${uniquePhones.length} (${recipients})`, {
      source: "communication",
      path: "/api/admin/communication/send",
    });

    return res.json({
      message: `${sent} message(s) envoyé(s) sur ${uniquePhones.length}`,
      sent,
      failed,
      total: uniquePhones.length,
      channel,
      recipients,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (e) {
    console.error("❌ sendCommunication:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
GET /api/admin/communication/history?page=1&limit=10
===================================================== */
export const getCommunicationHistory = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      CommunicationLog.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommunicationLog.countDocuments({}),
    ]);

    return res.json({ messages, total, page, limit });
  } catch (e) {
    console.error("❌ getCommunicationHistory:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
GET /api/admin/communication/stats
===================================================== */
export const getCommunicationStats = async (_req: Request, res: Response) => {
  try {
    const [totalStores, activeStores, totalAgents, cities, totalMessages] = await Promise.all([
      Store.countDocuments({}).catch(() => 0),
      Store.countDocuments({ subscriptionStatus: "active" }).catch(() => 0),
      Agent.countDocuments({ isApproved: true }).catch(() => 0),
      Store.distinct("city").catch(() => []),
      CommunicationLog.countDocuments({}).catch(() => 0),
    ]);

    return res.json({
      totalStores,
      activeStores,
      totalAgents,
      cities: cities.filter(Boolean),
      totalMessages,
    });
  } catch (e) {
    console.error("❌ getCommunicationStats:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
