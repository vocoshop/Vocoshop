// routes/adminStoreRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import Store from "../models/Store";
import Invoice from "../models/Invoice";
import RevenueMonthly from "../models/RevenueMonthly";

const router = Router();

router.use(authMiddleware);
router.use(requireOwner);

/* =====================================================
Compte le statut abonnement réel depuis les dates
===================================================== */
const computeSubscriptionStatus = (s: any): string => {
  const now = new Date();
  if (s.paidUntil && new Date(s.paidUntil) > now) return "active";
  if (s.graceUntil && new Date(s.graceUntil) > now) return "grace";
  if (s.paidUntil) return "expired";
  if (s.trialEnd && new Date(s.trialEnd) > now) return "trial";
  if (s.trialEnd) return "expired";
  return s.subscriptionStatus || "trial";
};

/* =====================================================
GET /api/admin/stores
- Liste toutes les boutiques de tous les agents
- Filtres: q, status, sub, agentCode, city, page, limit
===================================================== */
router.get("/stores", async (req: any, res: any) => {
  try {
    const q = String(req.query?.q || "").trim();
    const agentCode = String(req.query?.agentCode || "").trim();
    const status = String(req.query?.status || "").trim();
    const sub = String(req.query?.sub || "").trim();
    const city = String(req.query?.city || "").trim();

    const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || "20"), 10) || 20));

    const filter: any = {};
    
    if (agentCode) filter.agentCode = agentCode;
    if (city) filter.city = { $regex: city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    
    if (q) {
      const eq = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { storeName: { $regex: eq, $options: "i" } },
        { shopId: { $regex: eq, $options: "i" } },
        { phone: { $regex: eq, $options: "i" } },
      ];
    }

    const [stores, total] = await Promise.all([
      Store.find(filter)
        .select("storeName phone city shopId plan agentCode installedAt lastActiveAt isOnboarded createdAt subscriptionStatus paidUntil graceUntil trialEnd autoRenew billingCycleCount")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Store.countDocuments(filter),
    ]);

    const computeActivityStatus = (lastActiveAt?: string) => {
      if (!lastActiveAt) return "inactive";
      const days = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 7) return "active";
      if (days <= 30) return "inactive";
      return "inactive";
    };

    const mapped = (stores as any[]).map((s) => ({
      storeId: String(s._id),
      shopId: s.shopId || "",
      storeName: s.storeName || "",
      phone: s.phone || "",
      city: s.city || "",
      agentCode: s.agentCode || "",
      installedAt: s.installedAt || s.createdAt,
      lastActiveAt: s.lastActiveAt,
      isOnboarded: !!s.isOnboarded,
      activityStatus: computeActivityStatus(s.lastActiveAt),
      subscriptionStatus: computeSubscriptionStatus(s),
      plan: s.plan || "",
      paidUntil: s.paidUntil || null,
      graceUntil: s.graceUntil || null,
      trialEnd: s.trialEnd || null,
      autoRenew: !!s.autoRenew,
      billingCycleCount: s.billingCycleCount || 0,
    }));

    // Apply status filter
    let filtered = mapped;
    if (status) {
      filtered = filtered.filter((s: any) => s.activityStatus === status);
    }
    if (sub) {
      filtered = filtered.filter((s: any) => s.subscriptionStatus === sub);
    }

    res.json({
      stores: filtered,
      meta: { page, limit, total },
    });
  } catch (e) {
    console.error("❌ adminStores:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin/stats
- Statistiques globales
===================================================== */
router.get("/stats", async (req: any, res: any) => {
  try {
    const [
      totalAgents,
      activeAgents,
      totalStores,
      allStores,
      storesByCity,
    ] = await Promise.all([
      require("mongoose").connection.collection("agents").countDocuments({ isApproved: true }),
      require("mongoose").connection.collection("agents").countDocuments({ isApproved: true, isActive: true }),
      require("mongoose").connection.collection("stores").countDocuments(),
      Store.find().select("subscriptionStatus paidUntil graceUntil trialEnd").lean(),
      require("mongoose").connection.collection("stores").aggregate([
        { $group: { _id: "$city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).toArray(),
    ]);

    const subStats: Record<string, number> = { active: 0, trial: 0, grace: 0, expired: 0, unused: 0 };
    (allStores as any[]).forEach((s) => {
      const computed = computeSubscriptionStatus(s);
      subStats[computed] = (subStats[computed] || 0) + 1;
    });

    res.json({
      agents: { total: totalAgents, active: activeAgents },
      stores: { total: totalStores },
      subscription: subStats,
      topCities: storesByCity,
    });
  } catch (e) {
    console.error("❌ adminStats:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin/parrainages
- Statistiques parrainage (store→store)
===================================================== */
router.get("/parrainages", async (req: any, res: any) => {
  try {
    const [
      totalFilleuls,
      topReferrers,
      totalReferralCount,
      totalPaidReferrals,
      totalBonusRewarded,
    ] = await Promise.all([
      // Count stores with a referralCodeUsed (filleuls)
      Store.countDocuments({ referralCodeUsed: { $exists: true, $ne: "" } }),
      // Top referrers (stores with referredCount > 0)
      Store.find({ referredCount: { $gt: 0 } })
        .select("storeName shopId referredCount paidReferrals referralCode")
        .sort({ referredCount: -1 })
        .limit(20)
        .lean(),
      // Total referredCount sum across all stores
      Store.aggregate([
        { $group: { _id: null, total: { $sum: "$referredCount" } } },
      ]).exec(),
      // Total paidReferrals sum
      Store.aggregate([
        { $group: { _id: null, total: { $sum: "$paidReferrals" } } },
      ]).exec(),
      // Count stores that have been rewarded (referralRewarded = true)
      Store.countDocuments({ referralRewarded: true }),
    ]);

    const parsedTop = (topReferrers as any[]).map(s => {
      const paid = s.paidReferrals || 0;
      return {
        storeId: String(s._id),
        storeName: s.storeName || "Boutique",
        shopId: s.shopId || "",
        referralCode: s.referralCode || "",
        referredCount: s.referredCount || 0,
        paidReferrals: paid,
        freeMonths: Math.floor(paid / 3), // 3 paid filleuls = 1 mois gratuit
        nextFreeProgress: paid % 3,       // progression vers le prochain mois gratuit
      };
    });

    res.json({
      stats: {
        totalFilleuls,
        totalReferrals: (totalReferralCount[0] as any)?.total || 0,
        totalPaidReferrals: (totalPaidReferrals[0] as any)?.total || 0,
        totalBonusRewarded,
      },
      topReferrers: parsedTop,
    });
  } catch (e) {
    console.error("❌ adminParrainages:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin/payments
- Liste des paiements (factures) + stats revenus
===================================================== */
router.get("/payments", async (req: any, res: any) => {
  try {
    const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || "50"), 10) || 50));
    const storeId = String(req.query?.storeId || "").trim();

    const filter: any = {};
    if (storeId) filter.storeId = storeId;

    const [invoices, total, allInvoices, revenueMonthly] = await Promise.all([
      Invoice.find(filter)
        .sort({ paidAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
      Invoice.find().select("amount paidAt createdAt").lean(),
      RevenueMonthly.find().sort({ month: -1 }).limit(12).lean(),
    ]);

    // Build monthly revenue from all invoices (fallback if RevenueMonthly empty)
    const monthlyMap: Record<string, number> = {};
    allInvoices.forEach((inv: any) => {
      const date = inv.paidAt || inv.createdAt;
      if (!date) return;
      const m = new Date(date).toISOString().slice(0, 7);
      if (m === "Invalid date" || isNaN(new Date(date).getTime())) return;
      monthlyMap[m] = (monthlyMap[m] || 0) + (inv.amount || 3900);
    });
    const monthlyRevenue = Object.entries(monthlyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([month, totalRevenue]) => ({ month, totalRevenue }));

    // Use RevenueMonthly if available, otherwise computed from invoices
    const revenueData = revenueMonthly.length > 0 ? revenueMonthly : monthlyRevenue;

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentMonthRevenue = monthlyMap[currentMonth] || 0;
    const totalRevenue = Object.values(monthlyMap).reduce((s, v) => s + v, 0);

    // Enrich with store names
    const storeIds = [...new Set(invoices.map((i: any) => String(i.storeId)))];
    const stores = await Store.find({ _id: { $in: storeIds } })
      .select("storeName shopId phone city agentCode subscriptionStatus")
      .lean();
    const storeMap = Object.fromEntries(stores.map((s: any) => [String(s._id), s]));

    const enriched = invoices.map((inv: any) => {
      const store = storeMap[String(inv.storeId)] || {};
      return {
        id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount || 3900,
        currency: inv.currency || "XAF",
        paidAt: inv.paidAt,
        transactionId: inv.transactionId,
        billingPeriodStart: inv.billingPeriodStart,
        billingPeriodEnd: inv.billingPeriodEnd,
        storeName: (store as any).storeName || "Inconnue",
        shopId: (store as any).shopId || "",
        phone: (store as any).phone || "",
        city: (store as any).city || "",
        agentCode: (store as any).agentCode || "",
      };
    });

    res.json({
      payments: enriched,
      meta: { page, limit, total },
      revenueMonthly: revenueData,
      stats: { totalRevenue, totalInvoices: total, currentMonthRevenue },
    });
  } catch (e) {
    console.error("❌ adminPayments:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin/logs
- Logs système depuis MongoDB (systemlogs + activitylogs fusionnés)
- Filtres: type, niveau, search, page, limit
===================================================== */
router.get("/logs", async (req: any, res: any) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const filterLevel = String(req.query.level || "").trim();
    const search = String(req.query.search || "").trim().toLowerCase();

    // System logs query
    const systemMatch: any = {};
    if (filterLevel) systemMatch.level = filterLevel;
    if (search) systemMatch.message = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const [systemLogs, totalSystem, levelBreakdown] = await Promise.all([
      require("mongoose").connection.collection("systemlogs")
        .find(systemMatch)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      require("mongoose").connection.collection("systemlogs").countDocuments(systemMatch),
      require("mongoose").connection.collection("systemlogs").aggregate([
        { $group: { _id: "$level", count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    const parsedLogs = (systemLogs as any[]).map((l: any) => ({
      id: String(l._id),
      date: l.createdAt?.toISOString() || new Date().toISOString(),
      type: l.level,
      niveau: l.level === "error" ? "Erreur"
        : l.level === "warning" ? "Warning"
        : l.level === "security" ? "Critique"
        : l.level === "webhook" ? "Info"
        : l.level === "performance" ? "Info"
        : "Info",
      message: l.message,
      source: l.source || "server",
      details: l.details || null,
      method: l.method || null,
      path: l.path || null,
      statusCode: l.statusCode || null,
      durationMs: l.durationMs || null,
      ip: l.ip || null,
    }));

    const breakdownMap: Record<string, number> = {};
    levelBreakdown.forEach((b: any) => { breakdownMap[b._id] = b.count; });

    res.json({
      logs: parsedLogs,
      meta: { page, limit, total: totalSystem },
      breakdown: breakdownMap,
    });
  } catch (e) {
    console.error("❌ adminLogs:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin/activity-stats
- Stats activité quotidienne (30 derniers jours)
===================================================== */
router.get("/activity-stats", async (req: any, res: any) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days || "30"), 10) || 30, 7), 90);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const activityData = await require("mongoose").connection.collection("activitylogs").aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const storeCreatedData = await require("mongoose").connection.collection("stores").aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const mapByDay = (arr: any[]) => {
      const m: Record<string, number> = {};
      arr.forEach((a: any) => { m[a._id] = a.count; });
      return m;
    };

    const activityMap = mapByDay(activityData);
    const storesMap = mapByDay(storeCreatedData);

    const result = [];
    const cur = new Date(start);
    while (cur <= now) {
      const day = cur.toISOString().split("T")[0];
      result.push({
        day,
        label: cur.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
        activity: activityMap[day] || 0,
        stores: storesMap[day] || 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    res.json({ days: result, period: days });
  } catch (e) {
    console.error("❌ activityStats:", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;