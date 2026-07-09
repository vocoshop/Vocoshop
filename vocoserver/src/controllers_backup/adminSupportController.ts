import { Request, Response } from "express";
import SupportTicket from "../models/SupportTicket";
import { isValidObjectId } from "../utils/helpers";

/* =====================================================
GET /api/admin/support
Liste des tickets (paginated, filtrés)
Query: page, limit, status, priority
===================================================== */
export const getTickets = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const status = String(req.query.status || "").trim();
    const priority = String(req.query.priority || "").trim();

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const [tickets, total, stats] = await Promise.all([
      SupportTicket.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(filter),
      SupportTicket.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]).exec(),
    ]);

    const statusBreakdown: Record<string, number> = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    stats.forEach((s: any) => { statusBreakdown[s._id] = s.count; });

    res.json({ tickets, meta: { page, limit, total }, statusBreakdown });
  } catch (err: any) {
    console.error("❌ getTickets:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
PATCH /api/admin/support/:id
Met à jour le statut ou la priorité d'un ticket
Body: { status?, priority? }
===================================================== */
export const updateTicket = async (req: Request, res: Response) => {
  try {
    const { status, priority } = req.body;
    const update: any = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Rien à mettre à jour" });
    }

    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return res.status(400).json({ error: "ID invalide" });
    const ticket = await SupportTicket.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });

    res.json({ ticket });
  } catch (err: any) {
    console.error("❌ updateTicket:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
POST /api/admin/support/:id/reply
Ajoute une réponse admin à un ticket
Body: { message }
===================================================== */
export const replyTicket = async (req: Request, res: Response) => {
  try {
    const { message, author } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message requis" });
    }

    const reply = {
      author: author || "Super Admin",
      message: message.trim(),
      isAdmin: true,
      createdAt: new Date(),
    };

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        $push: { replies: reply },
        $set: { status: "in_progress" },
      },
      { new: true }
    ).lean();

    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });

    res.json({ ticket });
  } catch (err: any) {
    console.error("❌ replyTicket:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
POST /api/admin/support/seed
Crée des tickets de démo si la collection est vide
===================================================== */
export const seedTickets = async (_req: Request, res: Response) => {
  try {
    const count = await SupportTicket.countDocuments();
    if (count > 0) return res.json({ message: `${count} tickets déjà existants` });

    const demos = [
      { subject: "Problème de connexion", message: "Je n'arrive pas à me connecter à mon compte depuis 2 jours. L'écran reste bloqué sur le chargement.", storeName: "Boutique A", priority: "high", status: "open" },
      { subject: "Demande de remboursement", message: "J'ai effectué un paiement de 3 900 XAF mais l'abonnement n'a pas été activé. Merci de vérifier.", storeName: "Shop B", priority: "medium", status: "in_progress" },
      { subject: "Question abonnement", message: "Comment puis-je passer de l'offre Essai à l'offre Premium ? Y a-t-il des frais supplémentaires ?", storeName: "Store C", priority: "low", status: "closed" },
      { subject: "Erreur paiement", message: "Lors du paiement, j'ai reçu un message d'erreur 'Transaction échouée' mais l'argent a été débité de mon compte.", storeName: "Market D", priority: "high", status: "open" },
      { subject: "Problème d'application mobile", message: "L'application crash à chaque fois que j'essaie de voir mes rapports de vente.", storeName: "Boutique E", priority: "medium", status: "open" },
    ];

    const tickets = demos.map(d => ({
      ...d,
      replies: [{ author: "Support Auto", message: "Nous avons bien reçu votre demande. Une équipe va l'étudier.", isAdmin: true, createdAt: new Date(Date.now() - 3600000) }],
    }));

    await SupportTicket.insertMany(tickets);
    res.json({ message: `${tickets.length} tickets de démo créés` });
  } catch (err: any) {
    console.error("❌ seedTickets:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
