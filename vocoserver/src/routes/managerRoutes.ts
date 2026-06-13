import { Router } from "express";
import requireManager from "../middleware/requireManager";
import Agent from "../models/Agent";
import Store from "../models/Store";
import AdminManager from "../models/AdminManager";
import ActivityLog from "../models/ActivityLog";
import Commission from "../models/Commission";
import bcrypt from "bcryptjs";
import { generateAuthCode } from "../services/counterService";
import { sendSMS } from "../services/smsService";
import { createNotification } from "../services/notificationEngine";
import Notification from "../models/Notification";
import { PushNotificationService } from "../services/pushNotificationService";

const router = Router();
router.use(requireManager);

/* =====================================================
Construit le filtre d'accès selon les zones de l'admin
===================================================== */
const buildAccessFilter = (manager: any) => {
  const filter: any = {};
  const orConditions: any[] = [];

  if (manager?.assignedRegions?.length > 0) {
    orConditions.push({ region: { $in: manager.assignedRegions } });
  }
  if (manager?.assignedCities?.length > 0) {
    orConditions.push({ city: { $in: manager.assignedCities } });
  }

  if (manager?.assignedAgents?.length > 0) {
    orConditions.push({ _id: { $in: manager.assignedAgents } });
  }

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  return filter;
};

/* =====================================================
Score qualité agent (calcul côté serveur)
===================================================== */
const computeAgentScore = async (agent: any, stores: any[]) => {
  const agentStores = stores.filter((s: any) => (s.agentCode || "").toLowerCase() === (agent.code || "").toLowerCase());
  const total = agentStores.length;
  const active = agentStores.filter((s: any) => s.subscriptionStatus === "active").length;
  const inactive = total - active;
  const lastActive = agent.lastLoginAt ? new Date(agent.lastLoginAt).getTime() : 0;
  const daysSinceActive = (Date.now() - lastActive) / 86400000;

  let score = 100;
  if (total === 0) score -= 30;
  if (active < total * 0.5) score -= 20;
  if (inactive > total * 0.3) score -= 15;
  if (daysSinceActive > 7) score -= 10;
  if (daysSinceActive > 14) score -= 10;
  if (daysSinceActive > 30) score -= 10;
  if (!agent.isActive) score -= 20;
  score = Math.max(0, Math.min(100, score));

  const label = score >= 80 ? "Excellent" : score >= 60 ? "Correct" : score >= 40 ? "À surveiller" : "Problématique";
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  return { score, label, color, total, active, inactive };
};

/* =====================================================
GET /api/admin-manager/stats
===================================================== */
router.get("/stats", async (req: any, res: any) => {
  try {
    const accessFilter = buildAccessFilter(req.manager);
    const allAgents = await Agent.find({ ...accessFilter, isApproved: true }).lean();
    const agentCodes = allAgents.map((a: any) => a.code?.toLowerCase()).filter(Boolean);
    const allStores = await Store.find({ agentCode: { $in: agentCodes } }).lean();

    const activeAgents = allAgents.filter((a: any) => a.isActive);
    const totalStores = allStores.length;
    const activeSubs = allStores.filter((s: any) => s.subscriptionStatus === "active").length;
    const expiredStores = allStores.filter((s: any) => s.subscriptionStatus === "expired").length;
    const inactiveStores = allStores.filter((s: any) => {
      if (!s.lastActiveAt) return true;
      return (Date.now() - new Date(s.lastActiveAt).getTime()) > 7 * 86400000;
    }).length;

    const alertCount = expiredStores + inactiveStores + allAgents.filter((a: any) => !a.isActive).length;

    res.json({
      agents: { total: allAgents.length, active: activeAgents.length },
      stores: { total: totalStores, active: activeSubs },
      subscriptions: { active: activeSubs, expired: expiredStores },
      alerts: alertCount,
      inactiveStores,
    });
  } catch (e) {
    console.error("❌ managerStats error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/agents
===================================================== */
router.get("/agents", async (req: any, res: any) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10)));

    const accessFilter = buildAccessFilter(req.manager);
    if (q) {
      const eq = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      accessFilter.$or = [
        { name: { $regex: eq, $options: "i" } },
        { code: { $regex: eq, $options: "i" } },
        { phone: { $regex: eq, $options: "i" } },
        { city: { $regex: eq, $options: "i" } },
      ];
    }

    const [agents, total] = await Promise.all([
      Agent.find({ ...accessFilter, isApproved: true })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Agent.countDocuments({ ...accessFilter, isApproved: true }),
    ]);

    const allStores = await Store.find().lean();

    const enriched = await Promise.all(
      agents.map(async (a: any) => {
        const scoreData = await computeAgentScore(a, allStores);
        return { ...a, ...scoreData };
      })
    );

    res.json({ agents: enriched, meta: { page, limit, total } });
  } catch (e) {
    console.error("❌ managerAgents error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/agents/:id
===================================================== */
router.get("/agents/:id", async (req: any, res: any) => {
  try {
    const agent: any = await Agent.findById(req.params.id).lean();
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });

    const agentCode = (agent.code || "").toLowerCase();
    const stores = await Store.find({ agentCode }).lean();

    const scoreData = await computeAgentScore(agent, stores);
    const totalCommissions = stores.reduce((sum: number, s: any) => sum + (s.billingCycleCount || 0) * 800, 0);

    const weeklyActivity = await ActivityLog.aggregate([
      { $match: { agentCode } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%V", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]);

    const dailyActivity = await ActivityLog.aggregate([
      { $match: { agentCode, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlySubs = await Store.aggregate([
      { $match: { agentCode, paidUntil: { $ne: null } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paidUntil" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);

    const installByWeek = await Store.aggregate([
      { $match: { agentCode, createdAt: { $gte: new Date(Date.now() - 90 * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%V", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      agent: { ...agent, ...scoreData, totalCommissions },
      stores,
      charts: {
        weeklyActivity: weeklyActivity.reverse(),
        dailyActivity,
        monthlySubscriptions: monthlySubs,
        installByWeek,
      },
    });
  } catch (e) {
    console.error("❌ managerAgentDetail error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
PATCH /api/admin-manager/agents/:id/suspend
===================================================== */
router.patch("/agents/:id/suspend", async (req: any, res: any) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    agent.isActive = false;
    await agent.save();
    res.json({ success: true, message: "Agent suspendu" });
  } catch (e) {
    console.error("❌ suspendAgent error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
PATCH /api/admin-manager/agents/:id/unsuspend
===================================================== */
router.patch("/agents/:id/unsuspend", async (req: any, res: any) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    agent.isActive = true;
    await agent.save();
    res.json({ success: true, message: "Agent réactivé" });
  } catch (e) {
    console.error("❌ unsuspendAgent error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
POST /api/admin-manager/agents/:id/reset-password
===================================================== */
router.post("/agents/:id/reset-password", async (req: any, res: any) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(400).json({ error: "id manquant" });
    const agent = await Agent.findById(id).select("_id name phone code isActive");
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    const authCode = generateAuthCode(6);
    const authCodeHash = await bcrypt.hash(authCode, 10);
    await Agent.updateOne(
      { _id: id },
      { $set: { mustChangePassword: true, passwordHash: null, authCodeHash, authCodeIssuedAt: new Date() } }
    );
    const msg = `Vocoshop Agent 🔐\nBonjour ${agent.name},\nVotre accès a été réinitialisé.\nCode: ${agent.code}\nCode d'accès (1ère connexion): ${authCode}\nConnectez-vous puis définissez votre mot de passe.`;
    const smsOk = await sendSMS(String(agent.phone), msg).catch(() => false);
    res.json({ message: smsOk ? "Accès réinitialisé + SMS envoyé" : "Accès réinitialisé (SMS non envoyé)", smsSent: smsOk });
  } catch (e) {
    console.error("❌ managerResetPassword error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
POST /api/admin-manager/agents/:id/message
===================================================== */
router.post("/agents/:id/message", async (req: any, res: any) => {
  try {
    const id = String(req.params?.id || "").trim();
    const { message } = req.body;
    if (!id || !message?.trim()) return res.status(400).json({ error: "id et message requis" });
    const agent = await Agent.findById(id).select("_id name code phone");
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    await ActivityLog.create({
      agentCode: agent.code,
      type: "commission_earned",
      message: `📩 Message de l'Admin Manager: ${message}`,
      icon: "📩",
    });
    res.json({ success: true, message: "Message envoyé" });
  } catch (e) {
    console.error("❌ managerSendMessage error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/stores
===================================================== */
router.get("/stores", async (req: any, res: any) => {
  try {
    const accessFilter = buildAccessFilter(req.manager);
    const agents = await Agent.find({ ...accessFilter, isApproved: true }).lean();
    const agentCodes = agents.map((a: any) => a.code?.toLowerCase()).filter(Boolean);

    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));

    const filter: any = { agentCode: { $in: agentCodes } };
    if (q) {
      const eq = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { storeName: { $regex: eq, $options: "i" } },
        { shopId: { $regex: eq, $options: "i" } },
        { phone: { $regex: eq, $options: "i" } },
      ];
    }

    const [stores, total] = await Promise.all([
      Store.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Store.countDocuments(filter),
    ]);

    res.json({ stores, meta: { page, limit, total } });
  } catch (e) {
    console.error("❌ managerStores error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/alerts
===================================================== */
router.get("/alerts", async (req: any, res: any) => {
  try {
    const accessFilter = buildAccessFilter(req.manager);
    const agents = await Agent.find({ ...accessFilter, isApproved: true }).lean();
    const agentCodes = agents.map((a: any) => a.code?.toLowerCase()).filter(Boolean);
    const stores = await Store.find({ agentCode: { $in: agentCodes } }).lean();

    const alerts: any[] = [];

    const agentMap: Record<string, any> = {};
    agents.forEach((a: any) => { agentMap[a._id.toString()] = a; });
    const agentCodeMap: Record<string, any> = {};
    agents.forEach((a: any) => { agentCodeMap[(a.code || "").toLowerCase()] = a; });

    agents.forEach((a: any) => {
      const code = (a.code || "").toLowerCase();
      const agentStores = stores.filter((s: any) => (s.agentCode || "").toLowerCase() === code);
      const active = agentStores.filter((s: any) => s.subscriptionStatus === "active").length;

      if (!a.isActive) {
        alerts.push({ type: "danger", label: "Agent inactif", agent: a.name || a.code, severity: "🔴", agentId: a._id, store: null });
      }
      if (a.lastLoginAt && (Date.now() - new Date(a.lastLoginAt).getTime()) > 7 * 86400000) {
        alerts.push({ type: "danger", label: "Inactif depuis 7 jours", agent: a.name || a.code, severity: "🔴", agentId: a._id, store: null });
      }
      if (agentStores.length > 5 && active < agentStores.length * 0.3) {
        alerts.push({ type: "warning", label: "Taux d'abonnement faible", agent: a.name || a.code, severity: "🟡", agentId: a._id, store: null });
      }
      if (agentStores.filter((s: any) => !s.lastActiveAt).length > 3) {
        alerts.push({ type: "warning", label: "Boutiques jamais activées", agent: a.name || a.code, severity: "🟠", agentId: a._id, store: null });
      }
    });

    // Alertes par boutique
    stores.forEach((s: any) => {
      const agent = agentCodeMap[(s.agentCode || "").toLowerCase()];
      const agentId = agent?._id || null;
      const agentName = agent?.name || agent?.code || s.agentCode || "Inconnu";
      const storeName = s.storeName || s.name || "Boutique";

      // Abonnement expiré
      if (s.subscriptionStatus === "expired") {
        alerts.push({
          type: "danger", severity: "🔴",
          label: "Abonnement expiré", store: storeName,
          agent: agentName, agentId, storeId: s._id,
        });
      }
      // Expire bientôt (moins de 7 jours)
      if (s.paidUntil && s.subscriptionStatus === "active") {
        const daysLeft = Math.round((new Date(s.paidUntil).getTime() - Date.now()) / 86400000);
        if (daysLeft <= 7 && daysLeft >= 0) {
          alerts.push({
            type: "warning", severity: "🟡",
            label: `Expire dans ${daysLeft}j`, store: storeName,
            agent: agentName, agentId, storeId: s._id,
          });
        }
      }
      // Boutique inactive depuis 14+ jours
      if (s.status === "inactive" && s.lastActiveAt && (Date.now() - new Date(s.lastActiveAt).getTime()) > 14 * 86400000) {
        alerts.push({
          type: "warning", severity: "🟠",
          label: "Inactive depuis 14j+", store: storeName,
          agent: agentName, agentId, storeId: s._id,
        });
      }
      // En période d'essai dépassée (trial non converti)
      if (s.subscriptionStatus === "trial" && s.createdAt && (Date.now() - new Date(s.createdAt).getTime()) > 35 * 86400000) {
        alerts.push({
          type: "warning", severity: "🟠",
          label: "Essai non converti", store: storeName,
          agent: agentName, agentId, storeId: s._id,
        });
      }
    });

    alerts.sort((a, b) => {
      const order: any = { "🔴": 0, "🟠": 1, "🟡": 2 };
      return (order[a.severity] || 9) - (order[b.severity] || 9);
    });

    res.json({ alerts });
  } catch (e) {
    console.error("❌ managerAlerts error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/activity-stats
===================================================== */
router.get("/activity-stats", async (req: any, res: any) => {
  try {
    const accessFilter = buildAccessFilter(req.manager);
    const agents = await Agent.find({ ...accessFilter, isApproved: true }).lean();
    const agentCodes = agents.map((a: any) => a.code?.toLowerCase()).filter(Boolean);

    const days = Math.min(Math.max(parseInt(req.query.days || "30", 10) || 30, 7), 90);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const activityData = await ActivityLog.aggregate([
      { $match: { agentCode: { $in: agentCodes }, createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const stores = await Store.find({ agentCode: { $in: agentCodes }, createdAt: { $gte: start } }).lean();
    const storeMap: Record<string, number> = {};
    stores.forEach((s: any) => {
      const day = new Date(s.createdAt).toISOString().split("T")[0];
      storeMap[day] = (storeMap[day] || 0) + 1;
    });

    const activityMap: Record<string, number> = {};
    activityData.forEach((a: any) => { activityMap[a._id] = a.count; });

    const result = [];
    const cur = new Date(start);
    while (cur <= now) {
      const day = cur.toISOString().split("T")[0];
      result.push({
        day,
        label: cur.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
        activity: activityMap[day] || 0,
        stores: storeMap[day] || 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    res.json({ days: result, period: days });
  } catch (e) {
    console.error("❌ managerActivityStats error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/agents/:id/logs
Retourne les logs d'activité d'un agent
===================================================== */
router.get("/agents/:id/logs", async (req: any, res: any) => {
  try {
    const agent = await Agent.findById(req.params.id).select("code").lean();
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    const agentCode = (agent.code || "").toLowerCase();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "50", 10) || 50));

    const [logs, total] = await Promise.all([
      ActivityLog.find({ agentCode }).sort({ createdAt: -1 }).limit(limit).lean(),
      ActivityLog.countDocuments({ agentCode }),
    ]);

    res.json({ logs, total });
  } catch (e) {
    console.error("❌ managerAgentLogs error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/agents/:id/score-evolution
Score hebdomadaire sur 8 semaines
===================================================== */
router.get("/agents/:id/score-evolution", async (req: any, res: any) => {
  try {
    const agent = await Agent.findById(req.params.id).lean();
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    const agentCode = (agent.code || "").toLowerCase();

    const stores = await Store.find({ agentCode }).lean();
    const weeks = 8;
    const now = new Date();
    const data: { week: string; label: string; score: number; stores: number; active: number }[] = [];

    for (let w = weeks - 1; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 7 * w));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const storesAtTime = stores.filter((s: any) => s.createdAt && new Date(s.createdAt) <= weekEnd);
      const total = storesAtTime.length;
      const active = storesAtTime.filter((s: any) => {
        if (!s.paidUntil) return s.trialEnd && new Date(s.trialEnd) > weekStart;
        return new Date(s.paidUntil) >= weekStart || (s.graceUntil && new Date(s.graceUntil) >= weekStart);
      }).length;
      const inactive = total - active;

      const lastLogin = agent.lastLoginAt ? new Date(agent.lastLoginAt).getTime() : 0;
      const daysSinceActive = weekEnd ? (weekEnd.getTime() - lastLogin) / 86400000 : 999;

      let score = 100;
      if (total === 0) score -= 30;
      if (active < total * 0.5) score -= 20;
      if (inactive > total * 0.3) score -= 15;
      if (daysSinceActive > 7) score -= 10;
      if (daysSinceActive > 14) score -= 10;
      if (daysSinceActive > 30) score -= 10;
      if (!agent.isActive) score -= 20;
      score = Math.max(0, Math.min(100, score));

      data.push({
        week: weekStart.toISOString().slice(0, 10),
        label: weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        score,
        stores: total,
        active,
      });
    }

    res.json({ evolution: data });
  } catch (e) {
    console.error("❌ scoreEvolution error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/inactive-stores
Rapport des boutiques inactives groupées par agent
===================================================== */
router.get("/inactive-stores", async (req: any, res: any) => {
  try {
    const accessFilter = buildAccessFilter(req.manager);
    const agents = await Agent.find({ ...accessFilter, isApproved: true }).lean();
    const agentCodes = agents.map((a: any) => a.code?.toLowerCase()).filter(Boolean);
    const stores = await Store.find({ agentCode: { $in: agentCodes } }).lean();
    const now = Date.now();

    const byAgent: Record<string, { agent: any; stores: any[] }> = {};
    agents.forEach((a: any) => {
      const code = (a.code || "").toLowerCase();
      const codeStores = stores.filter((s: any) => (s.agentCode || "").toLowerCase() === code);
      const inactive = codeStores.filter((s: any) => {
        if (!s.lastActiveAt) return true;
        return (now - new Date(s.lastActiveAt).getTime()) > 7 * 86400000;
      });
      if (inactive.length > 0) {
        byAgent[code] = {
          agent: { _id: a._id, name: a.name, code: a.code, phone: a.phone },
          stores: inactive.map((s: any) => ({
            _id: s._id,
            name: s.storeName || s.name,
            phone: s.phone,
            city: s.city,
            lastActiveAt: s.lastActiveAt,
            inactiveDays: Math.round((now - new Date(s.lastActiveAt || s.createdAt).getTime()) / 86400000),
            subscriptionStatus: s.subscriptionStatus,
          })),
        };
      }
    });

    res.json({ agents: Object.values(byAgent).sort((a: any, b: any) => b.stores.length - a.stores.length) });
  } catch (e) {
    console.error("❌ inactiveStores error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/stores/:id
Détail d'une boutique
===================================================== */
router.get("/stores/:id", async (req: any, res: any) => {
  try {
    const store = await Store.findById(req.params.id).lean();
    if (!store) return res.status(404).json({ error: "Boutique introuvable" });

    const logs = await ActivityLog.find({
      $or: [
        { agentCode: (store.agentCode || "").toLowerCase() },
        { storeId: store._id },
      ],
    }).sort({ createdAt: -1 }).limit(50).lean();

    const agent = store.agentCode
      ? await Agent.findOne({ code: { $regex: new RegExp(`^${store.agentCode}$`, "i") } }).select("name code phone city").lean()
      : null;

    res.json({ store, logs, agent });
  } catch (e) {
    console.error("❌ storeDetail error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin-manager/agent-notifications
Retourne les notifications des stores sous les agents du manager
===================================================== */
router.get("/agent-notifications", async (req: any, res: any) => {
  try {
    const accessFilter = buildAccessFilter(req.manager);
    const agents = await Agent.find({ ...accessFilter, isApproved: true }).lean();
    const agentCodes = agents.map((a: any) => a.code?.toLowerCase()).filter(Boolean);
    const stores = await Store.find({ agentCode: { $in: agentCodes } }).select("_id storeName agentCode phone city").lean();
    const storeIds = stores.map((s: any) => s._id);

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "30", 10)));

    const [notifications, total] = await Promise.all([
      Notification.find({ storeId: { $in: storeIds } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ storeId: { $in: storeIds } }),
    ]);

    const storeMap: Record<string, any> = {};
    stores.forEach((s: any) => { storeMap[String(s._id)] = s; });

    const enriched = notifications.map((n: any) => ({
      ...n,
      store: storeMap[String(n.storeId)] || null,
    }));

    res.json({ notifications: enriched, meta: { page, limit, total } });
  } catch (e) {
    console.error("❌ agentNotifications error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
POST /api/admin-manager/agents/:id/send-notification
Envoie une notification push à l'agent
===================================================== */
router.post("/agents/:id/send-notification", async (req: any, res: any) => {
  try {
    const { title, message } = req.body;
    if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: "Titre et message requis" });

    const agent = await Agent.findById(req.params.id).select("code name").lean();
    if (!agent) return res.status(404).json({ error: "Agent introuvable" });

    await PushNotificationService.sendToAgent(agent.code, title, message, { type: "system" });

    await ActivityLog.create({
      agentCode: agent.code,
      type: "message",
      message: `📨 Notification envoyée: ${title}`,
      icon: "📨",
    });

    res.json({ success: true, message: "Notification envoyée" });
  } catch (e) {
    console.error("❌ sendNotification error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
POST /api/admin-manager/broadcast-message
Envoie une notification push à tous les stores des agents du manager
===================================================== */
router.post("/broadcast-message", async (req: any, res: any) => {
  try {
    const { title, message } = req.body;
    if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: "Titre et message requis" });

    const accessFilter = buildAccessFilter(req.manager);
    const agents = await Agent.find({ ...accessFilter, isApproved: true }).lean();
    const agentCodes = agents.map((a: any) => a.code?.toLowerCase()).filter(Boolean);
    const stores = await Store.find({ agentCode: { $in: agentCodes } }).lean();
    const totalStores = stores.length;
    let sent = 0;

    await Promise.allSettled(agents.map(async (a: any) => {
      await PushNotificationService.sendToAgent(a.code, title, message, { type: "system" }).catch(() => {});
      sent++;
    }));

    res.json({ success: true, sent, total: totalStores, message: `Notification envoyée à ${sent} agents (${totalStores} boutiques)` });
  } catch (e) {
    console.error("❌ broadcast error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
   GET /api/admin-manager/commissions
   Liste des commissions (admin-manager)
   ===================================================== */
router.get("/commissions", async (req: any, res: any) => {
  try {
    const manager = req.manager;
    const filter = buildAccessFilter(manager);
    const { status, page = "1", limit = "50" } = req.query;

    const query: any = {};
    if (filter.agentCodes && filter.agentCodes.length > 0) {
      query.agentCode = { $in: filter.agentCodes };
    }
    if (status && status !== "all") query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [commissions, total] = await Promise.all([
      Commission.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Commission.countDocuments(query),
    ]);

    const totalAmount = await Commission.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      commissions,
      total,
      totalAmount: totalAmount[0]?.total || 0,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (e) {
    console.error("❌ commissions error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
   PATCH /api/admin-manager/commissions/:id/pay
   Marquer une commission comme payée
   ===================================================== */
router.patch("/commissions/:id/pay", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const commission = await Commission.findByIdAndUpdate(
      id,
      { status: "paid", paidAt: new Date() },
      { new: true }
    ).lean();
    if (!commission) return res.status(404).json({ error: "Commission introuvable" });
    res.json({ commission });
  } catch (e) {
    console.error("❌ pay commission error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
