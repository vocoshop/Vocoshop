// controllers/activityController.ts
import { Request, Response, NextFunction } from "express";
import ActivityLog, { IActivityLog } from "../models/ActivityLog";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError } from "../utils/AppError";

type LogType = IActivityLog["type"];

const ICONS: Record<LogType, string> = {
  store_created: "🏪",
  store_onboarded: "✅",
  subscription_activated: "✅",
  subscription_expired: "⚠️",
  commission_earned: "💰",
  withdrawal_requested: "💳",
  withdrawal_approved: "✅",
  auto_renewal: "🔄",
};

export const logActivity = async (
  agentCode: string,
  type: LogType,
  message: string,
  opts?: { storeId?: string; storeName?: string }
) => {
  try {
    await ActivityLog.create({
      agentCode,
      type,
      message,
      icon: ICONS[type],
      storeId: opts?.storeId || null,
      storeName: opts?.storeName || "",
    });
  } catch (e) {
    console.error("❌ logActivity:", e);
  }
};

export const getActivities = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const agentCode = String(req.agent?.code || "").trim();
  if (!agentCode) return next(new ValidationError("Agent code manquant"));

  const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || "50"), 10) || 50));

  const total = await ActivityLog.countDocuments({ agentCode });
  const logs = await ActivityLog.find({ agentCode })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return res.json({
    activities: logs.map((l: any) => ({
      id: String(l._id),
      type: l.type,
      message: l.message,
      icon: l.icon,
      storeId: l.storeId || "",
      storeName: l.storeName || "",
      time: l.createdAt,
    })),
    meta: { page, limit, total, hasMore: page * limit < total },
  });
});
