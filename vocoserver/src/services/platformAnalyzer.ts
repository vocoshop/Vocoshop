// services/platformAnalyzer.ts
import Store from "../models/Store";
import Agent from "../models/Agent";
import Invoice from "../models/Invoice";
import ActivityLog from "../models/ActivityLog";

export const PlatformAnalyzer = {
  async getOverview(): Promise<any> {
    try {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        storeStats,
        agentStats,
        revenueData,
        newStoresMonth,
        newStoresWeek,
        topCities,
        churnRisk,
        topAgents,
      ] = await Promise.all([
        Store.aggregate([{ $group: { _id: "$subscriptionStatus", count: { $sum: 1 } } }]),
        Agent.aggregate([{ $match: { isApproved: true } }, { $group: { _id: "$isActive", count: { $sum: 1 } } }]),
        Invoice.aggregate([
          { $match: { paidAt: { $gte: monthAgo } } },
          { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]),
        Store.countDocuments({ createdAt: { $gte: monthAgo } }),
        Store.countDocuments({ createdAt: { $gte: weekAgo } }),
        Store.aggregate([{ $group: { _id: "$city", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
        Store.find({ $or: [
          { subscriptionStatus: "grace" },
          { subscriptionStatus: "expired" },
          { lastActiveAt: { $lt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) } }
        ]}).select("storeName subscriptionStatus lastActiveAt paidUntil agentCode").lean(),
        Agent.find({ isApproved: true }).select("name code city").lean(),
      ]);

      const subMap: Record<string, number> = {};
      storeStats.forEach((s: any) => { subMap[s._id || "unknown"] = s.count; });
      const totalStores = Object.values(subMap).reduce((a, b) => a + b, 0);
      const activeAgents = agentStats.find((a: any) => a._id === true)?.count || 0;
      const monthlyRevenue = revenueData[0]?.total || 0;

      // Compute agent performance
      const agentPerformance = await Promise.all(topAgents.map(async (a: any) => {
        const stores = await Store.find({ agentCode: a.code }).select("subscriptionStatus").lean();
        const active = stores.filter((s: any) => s.subscriptionStatus === "active").length;
        const total = stores.length;
        return { name: a.name, code: a.code, total, active, activation: total > 0 ? Math.round((active / total) * 100) : 0 };
      }));

      agentPerformance.sort((a, b) => b.active - a.active || b.total - a.total);

      return {
        summary: {
          totalStores,
          activeStores: subMap.active || 0,
          trialStores: subMap.trial || 0,
          graceStores: subMap.grace || 0,
          expiredStores: subMap.expired || 0,
          activeAgents,
          totalAgents: agentStats.reduce((a: number, b: any) => a + b.count, 0),
          monthlyRevenue,
          revenuePerStore: totalStores > 0 ? Math.round(monthlyRevenue / totalStores) : 0,
          newStoresMonth,
          newStoresWeek,
        },
        churnRisk: churnRisk.map((s: any) => ({
          name: s.storeName,
          status: s.subscriptionStatus,
          lastActive: s.lastActiveAt,
          paidUntil: s.paidUntil,
          agentCode: s.agentCode,
        })),
        topCities: topCities.map((c: any) => ({ city: c._id || "Inconnu", count: c.count })),
        topAgents: agentPerformance.slice(0, 10),
        insights: this.generateInsights(subMap, totalStores, monthlyRevenue, activeAgents, churnRisk.length),
      };
    } catch (e) {
      console.error("❌ platformAnalyzer:", e);
      return null;
    }
  },

  generateInsights(subMap: Record<string, number>, total: number, revenue: number, agents: number, churn: number): string[] {
    const insights: string[] = [];
    const active = subMap.active || 0;
    const trial = subMap.trial || 0;
    const grace = subMap.grace || 0;
    const expired = subMap.expired || 0;

    if (total > 0) {
      const convRate = Math.round((active / total) * 100);
      if (convRate < 50) insights.push(`📉 Taux de conversion trial→actif bas (${convRate}%) — trop de boutiques en trial ou expirées`);
      else if (convRate >= 70) insights.push(`📈 Excellent taux de conversion (${convRate}%) — la plateforme performe bien`);
    }

    if (revenue > 0 && total > 0) {
      const avgRev = Math.round(revenue / total);
      insights.push(`💰 Revenu moyen par boutique: ${avgRev.toLocaleString()} XAF/mois`);
    }

    if (trial > active) insights.push(`⚠️ Plus de boutiques en trial (${trial}) que actives (${active}) — travaillez le conversion`);
    if (grace > 0) insights.push(`⏰ ${grace} boutique(s) en grâce — risque de churn élevé`);
    if (expired > 0) insights.push(`🚨 ${expired} boutique(s) expirée(s) — intervention nécessaire`);
    if (churn > 0) insights.push(`⚠️ ${churn} boutique(s) à risque de désabonnement`);

    return insights;
  },

  async getRevenueTimeline(months: number = 6): Promise<any[]> {
    try {
      const since = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000);
      const data = await Invoice.aggregate([
        { $match: { paidAt: { $gte: since } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]);
      return data.map((d: any) => ({
        month: d._id,
        revenue: d.revenue,
        transactions: d.count,
      }));
    } catch (e) {
      return [];
    }
  },
};