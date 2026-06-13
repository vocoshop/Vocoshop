// controllers/communicationController.ts
import { Request, Response } from "express";
import Store from "../models/Store";
import Agent from "../models/Agent";
import { sendSMS } from "../services/smsService";
import { sendWhatsApp, sendWhatsAppText } from "../services/whatsappService";
import { logSystem } from "../utils/systemLogger";

/* =====================================================
POST /api/admin/communication/send
Body: { channel, recipients, message, subject?, city? }
===================================================== */
export const sendCommunication = async (req: Request, res: Response) => {
  try {
    const channel = String(req.body?.channel || "sms"); // "sms" | "whatsapp"
    const recipients = String(req.body?.recipients || "all_stores");
    const message = String(req.body?.message || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const city = String(req.body?.city || "").trim();

    if (!message) return res.status(400).json({ error: "Message requis" });
    if (!["sms", "whatsapp"].includes(channel)) {
      return res.status(400).json({ error: "Canal invalide (sms ou whatsapp)" });
    }

    // Collecter les numéros de téléphone
    let phones: string[] = [];

    switch (recipients) {
      case "all_stores": {
        const stores = await Store.find({}).select("phone").lean();
        phones = stores.map((s: any) => s.phone).filter(Boolean);
        break;
      }
      case "all_agents": {
        const agents = await Agent.find({ isApproved: true }).select("phone").lean();
        phones = agents.map((a: any) => a.phone).filter(Boolean);
        break;
      }
      case "active_stores": {
        const stores = await Store.find({ subscriptionStatus: "active" }).select("phone").lean();
        phones = stores.map((s: any) => s.phone).filter(Boolean);
        break;
      }
      case "stores_by_city": {
        if (!city) return res.status(400).json({ error: "Ville requise" });
        const stores = await Store.find({ city: new RegExp(city, "i") }).select("phone").lean();
        phones = stores.map((s: any) => s.phone).filter(Boolean);
        break;
      }
      default:
        return res.status(400).json({ error: "Destinataires invalides" });
    }

    if (phones.length === 0) {
      return res.status(400).json({ error: "Aucun destinataire trouvé" });
    }

    // Dédupliquer
    phones = [...new Set(phones)];

    // Envoyer
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const subjectPrefix = subject ? `[${subject}] ` : "";

    for (const phone of phones) {
      try {
        let ok = false;
        if (channel === "whatsapp") {
          ok = await sendWhatsAppText(phone, `${subjectPrefix}${message}`);
        } else {
          ok = await sendSMS(phone, `${subjectPrefix}${message}`);
        }
        if (ok) sent++;
        else failed++;
      } catch (e: any) {
        failed++;
        errors.push(`${phone}: ${e.message}`);
      }
    }

    logSystem("info", `Communication envoyée: ${channel} → ${sent}/${phones.length} (${recipients})`, {
      source: "communication",
      path: "/api/admin/communication/send",
    });

    return res.json({
      message: `${sent} message(s) envoyé(s) sur ${phones.length}`,
      sent,
      failed,
      total: phones.length,
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
GET /api/admin/communication/stats
Retourne les compteurs de destinataires
===================================================== */
export const getCommunicationStats = async (req: Request, res: Response) => {
  try {
    const [totalStores, activeStores, totalAgents, cities] = await Promise.all([
      Store.countDocuments({}).catch(() => 0),
      Store.countDocuments({ subscriptionStatus: "active" }).catch(() => 0),
      Agent.countDocuments({ isApproved: true }).catch(() => 0),
      Store.distinct("city").catch(() => []),
    ]);

    return res.json({
      totalStores,
      activeStores,
      totalAgents,
      cities: cities.filter(Boolean),
    });
  } catch (e) {
    console.error("❌ getCommunicationStats:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
