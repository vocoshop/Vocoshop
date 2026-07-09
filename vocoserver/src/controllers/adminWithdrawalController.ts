import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import mongoose from "mongoose";
import Withdrawal from "../models/Withdrawal";

/* =====================================================
GET /api/admin/withdrawals
===================================================== */
export const listWithdrawals = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const statusFilter = String(req.query?.status || "").trim();
    const agentCode = String(req.query?.agentCode || "").trim();
    const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || "50"), 10) || 50));

    const filter: any = {};
    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      filter.status = statusFilter;
    }
    if (agentCode) filter.agentCode = agentCode;

    const total = await Withdrawal.countDocuments(filter);
    const withdrawals = await Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      withdrawals: withdrawals.map((w) => ({
        id: String(w._id),
        agentCode: w.agentCode,
        agentId: String(w.agentId),
        agentName: w.agentName,
        amount: w.amount,
        phone: w.phone,
        status: w.status,
        adminNote: w.adminNote || "",
        processedBy: w.processedBy ? String(w.processedBy) : null,
        processedAt: w.processedAt || null,
        createdAt: w.createdAt,
      })),
      meta: { page, limit, total, hasMore: page * limit < total },
    });
  });

/* =====================================================
PATCH /api/admin/withdrawals/:id
===================================================== */
export const processWithdrawal = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const id = String(req.params?.id || "").trim();
    const action = String(req.body?.action || req.body?.status || "").trim(); // "approved" | "rejected"
    const adminNote = String(req.body?.adminNote || "").trim();
    const adminId = req.user?.id;

    if (!id) return next(new ValidationError("ID requis"));
    if (!["approved", "rejected"].includes(action)) {
      return next(new ValidationError("action doit être 'approved' ou 'rejected'"));
    }
    if (action === "rejected" && !adminNote) {
      return next(new ValidationError("Un motif est requis pour le rejet"));
    }

    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) return next(new NotFoundError("Demande introuvable"));
    if (withdrawal.status !== "pending") {
      return res.status(400).json({ error: `Cette demande est déjà ${withdrawal.status}` });
    }

    withdrawal.status = action as "approved" | "rejected";
    withdrawal.adminNote = adminNote;
    withdrawal.processedBy = new mongoose.Types.ObjectId(adminId);
    withdrawal.processedAt = new Date();

    await withdrawal.save();

    return res.json({
      message: action === "approved" ? "Retrait approuvé" : "Retrait rejeté",
      withdrawal: {
        id: String(withdrawal._id),
        status: withdrawal.status,
        adminNote: withdrawal.adminNote,
        processedAt: withdrawal.processedAt,
      },
    });
  });

/* =====================================================
GET /api/admin/withdrawals/stats
===================================================== */
export const getWithdrawalStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const stats = await Withdrawal.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$amount" } } },
    ]);

    const result: Record<string, { count: number; total: number }> = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 },
    };

    for (const s of stats) {
      result[s._id] = { count: s.count, total: s.total };
    }

    return res.json(result);
  });
