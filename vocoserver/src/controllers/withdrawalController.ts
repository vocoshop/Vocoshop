import { Request, Response } from "express";
import mongoose from "mongoose";
import Withdrawal from "../models/Withdrawal";
import Commission from "../models/Commission";
import { logActivity } from "./activityController";

/* =====================================================
Helpers
===================================================== */
async function getAvailableBalance(agentCode: string): Promise<number> {
  const paid = await Commission.aggregate([
    { $match: { agentCode, status: "paid" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const withdrawn = await Withdrawal.aggregate([
    { $match: { agentCode, status: { $in: ["approved", "pending"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const earned = paid[0]?.total || 0;
  const used = withdrawn[0]?.total || 0;
  return Math.max(0, earned - used);
}

async function getTodayCount(agentCode: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Withdrawal.countDocuments({ agentCode, createdAt: { $gte: start } });
}

/* =====================================================
POST /api/agent/withdrawals
- Auto-approuvé immédiatement
- Transaction atomique pour éviter les race conditions
===================================================== */
export const createWithdrawal = async (req: Request, res: Response) => {
  try {
    const agentCode = String(req.agent?.code || "").trim();
    const agentId = req.agent?.id;
    const agentName = req.agent?.name || "";

    if (!agentCode) return res.status(400).json({ error: "Code agent manquant" });

    const amount = Math.round(Number(req.body?.amount) || 0);
    const phone = String(req.body?.phone || "").trim();

    // Validation
    if (!phone) return res.status(400).json({ error: "Numéro de téléphone requis" });
    if (amount < 1000) return res.status(400).json({ error: "Montant minimum : 1 000 FCFA" });
    if (amount > 500000) return res.status(400).json({ error: "Montant maximum : 500 000 FCFA" });

    // Vérifier le téléphone de l'agent
    const agentPhone = String(req.agent?.phone || "").replace(/[^0-9]/g, "");
    const reqPhone = phone.replace(/[^0-9]/g, "");
    if (reqPhone !== agentPhone) {
      return res.status(403).json({ error: "Le numéro de retrait doit être votre numéro enregistré" });
    }

    // Rate limit: max 3/jour
    const todayCount = await getTodayCount(agentCode);
    if (todayCount >= 3) {
      return res.status(429).json({ error: "Maximum 3 demandes par jour" });
    }

    // Transaction atomique : balance + création
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const paid = await Commission.aggregate([
        { $match: { agentCode, status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).session(session);

      const withdrawn = await Withdrawal.aggregate([
        { $match: { agentCode, status: { $in: ["approved", "pending"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).session(session);

      const earned = paid[0]?.total || 0;
      const used = withdrawn[0]?.total || 0;
      const balance = Math.max(0, earned - used);

      if (amount > balance) {
        await session.abortTransaction();
        return res.status(400).json({ error: `Solde insuffisant. Disponible : ${balance.toLocaleString()} FCFA` });
      }

      const [withdrawal] = await Withdrawal.create([{
        agentCode,
        agentId: new mongoose.Types.ObjectId(agentId),
        agentName,
        amount,
        phone,
        status: "approved",
        processedAt: new Date(),
      }], { session });

      await session.commitTransaction();

      logActivity(agentCode, "withdrawal_requested", `Retrait de ${amount.toLocaleString()} FCFA demandé`);

      return res.status(201).json({
        withdrawal: {
          id: String(withdrawal._id),
          amount: withdrawal.amount,
          phone: withdrawal.phone,
          status: withdrawal.status,
          processedAt: withdrawal.processedAt,
          createdAt: withdrawal.createdAt,
        },
      });
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  } catch (e) {
    console.error("❌ createWithdrawal:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
GET /api/agent/withdrawals
===================================================== */
export const listMyWithdrawals = async (req: Request, res: Response) => {
  try {
    const agentCode = String(req.agent?.code || "").trim();
    if (!agentCode) return res.status(400).json({ error: "Code agent manquant" });

    const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query?.limit || "20"), 10) || 20));

    const total = await Withdrawal.countDocuments({ agentCode });
    const withdrawals = await Withdrawal.find({ agentCode })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      withdrawals: withdrawals.map((w) => ({
        id: String(w._id),
        amount: w.amount,
        phone: w.phone,
        status: w.status,
        adminNote: w.adminNote || "",
        processedAt: w.processedAt || null,
        createdAt: w.createdAt,
      })),
      meta: { page, limit, total, hasMore: page * limit < total },
    });
  } catch (e) {
    console.error("❌ listMyWithdrawals:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
GET /api/agent/balance
===================================================== */
export const getMyBalance = async (req: Request, res: Response) => {
  try {
    const agentCode = String(req.agent?.code || "").trim();
    if (!agentCode) return res.status(400).json({ error: "Code agent manquant" });

    const balance = await getAvailableBalance(agentCode);
    const pendingCount = await Withdrawal.countDocuments({ agentCode, status: "pending" });

    return res.json({ balance, hasPendingRequest: pendingCount > 0 });
  } catch (e) {
    console.error("❌ getMyBalance:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
