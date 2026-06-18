import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import { SecurityMonitor } from "../services/securityMonitor";
import SystemLog from "../models/SystemLog";

const router = Router();
router.use(authMiddleware);
router.use(requireOwner);

router.get("/health", async (_req: any, res: any) => {
  try {
    const report = await SecurityMonitor.getHealthReport();
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: "Erreur monitoring sécurité" });
  }
});

router.get("/logs", async (req: any, res: any) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const level = req.query.level || "";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const search = req.query.search || "";

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filter: any = { createdAt: { $gte: since } };
    if (typeof level === "string") filter.level = level;
    if (typeof search === "string" && search) filter.message = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const [logs, total] = await Promise.all([
      SystemLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SystemLog.countDocuments(filter),
    ]);

    const breakdown = await SystemLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$level", count: { $sum: 1 } } },
    ]);

    res.json({
      logs: logs.map(l => ({
        id: l._id, date: l.createdAt, type: l.level,
        message: l.message, source: l.source, ip: l.ip,
        details: l.details, method: l.method, path: l.path,
        statusCode: l.statusCode, durationMs: l.durationMs,
      })),
      meta: { page, limit, total },
      breakdown: Object.fromEntries(breakdown.map(b => [b._id, b.count])),
    });
  } catch (e) {
    res.status(500).json({ error: "Erreur lecture logs" });
  }
});

router.get("/recent", async (_req: any, res: any) => {
  try {
    const feed = await SecurityMonitor.getActivityFeed(1);
    res.json({ events: feed.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ error: "Erreur événements récents" });
  }
});

export default router;
