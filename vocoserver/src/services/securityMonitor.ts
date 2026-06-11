// services/securityMonitor.ts
import SystemLog from "../models/SystemLog";
import Store from "../models/Store";
import Agent from "../models/Agent";
import Otp from "../models/Otp";

export const SecurityMonitor = {
  async getHealthReport(): Promise<any> {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        failedLogins24h,
        errorLogs7d,
        suspiciousStores,
        expiringSubscriptions,
        inactiveStores,
        recentOtpFailures,
      ] = await Promise.all([
        SystemLog.countDocuments({ source: "auth", message: /échec/i, createdAt: { $gte: last24h } }),
        SystemLog.find({ level: "error", createdAt: { $gte: last7d } })
          .select("message source createdAt").sort({ createdAt: -1 }).limit(20).lean(),
        Store.find({ subscriptionStatus: "expired", lastActiveAt: { $lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } })
          .select("storeName phone lastActiveAt agentCode").lean(),
        Store.find({ subscriptionStatus: "grace" }).select("storeName paidUntil").lean(),
        Store.find({ lastActiveAt: { $lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } })
          .select("storeName lastActiveAt").limit(10).lean(),
        Otp.countDocuments({ verified: false, attempts: { $gte: 3 }, createdAt: { $gte: last24h } }),
      ]);

      const score = this.computeScore(failedLogins24h, errorLogs7d.length, expiringSubscriptions.length, suspiciousStores.length, recentOtpFailures);

      return {
        score,
        label: score >= 85 ? "Excellent" : score >= 70 ? "Bon" : score >= 50 ? "Attention" : "Alerte",
        metrics: {
          failedLogins24h,
          errorLogs7d: errorLogs7d.length,
          suspiciousStores: suspiciousStores.length,
          expiringSubscriptions: expiringSubscriptions.length,
          inactiveStores: inactiveStores.length,
          otpFailures24h: recentOtpFailures,
        },
        criticalAlerts: [
          ...suspiciousStores.map(s => ({ type: "store_inactive_expired", store: s.storeName, phone: s.phone, detail: "Boutique expirée inactive", severity: "high" })),
          ...expiringSubscriptions.map(s => ({ type: "grace_period", store: s.storeName, paidUntil: s.paidUntil, detail: "En période de grâce", severity: "medium" })),
        ],
        recentErrors: errorLogs7d.map((e: any) => ({ message: e.message, source: e.source, date: e.createdAt })),
        inactiveStores: inactiveStores.map((s: any) => ({ name: s.storeName, lastActive: s.lastActiveAt })),
        recommendations: this.generateRecommendations(failedLogins24h, errorLogs7d.length, suspiciousStores.length, score),
      };
    } catch (e) {
      console.error("❌ securityMonitor:", e);
      return null;
    }
  },

  computeScore(failedLogins: number, errors: number, grace: number, suspicious: number, otpFail: number): number {
    let score = 100;
    score -= Math.min(failedLogins * 2, 25);
    score -= Math.min(errors * 0.5, 20);
    score -= suspicious * 15;
    score -= grace * 3;
    score -= otpFail * 5;
    return Math.max(0, Math.min(100, Math.round(score)));
  },

  generateRecommendations(failedLogins: number, errors: number, suspicious: number, score: number): string[] {
    const recs: string[] = [];
    if (failedLogins > 5) recs.push(`⚠️ ${failedLogins} échecs de connexion en 24h — vérifiez les IPs suspectes`);
    if (errors > 10) recs.push(`🔴 ${errors} erreurs système cette semaine — priorité maintenance`);
    if (suspicious > 0) recs.push(`🚨 ${suspicious} boutique(s) expirée(s) inactive(s) — envisagez suspension`);
    if (score < 70) recs.push("🔒 Renforcez la sécurité : Activez le rate limiting, vérifiez les accès");
    if (score >= 85) recs.push("✅ Sécurité excellente — aucune action requise");
    return recs;
  },

  async getActivityFeed(days: number = 7): Promise<any[]> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const logs = await SystemLog.find({ createdAt: { $gte: since } })
        .select("level message source createdAt ip details")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return logs.map((l: any) => ({
        date: l.createdAt,
        type: l.level,
        message: l.message,
        source: l.source,
        ip: l.ip || null,
        details: l.details || null,
      }));
    } catch (e) {
      return [];
    }
  },
};