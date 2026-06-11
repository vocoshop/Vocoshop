import express from "express";
import OpenAI from "openai";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import Store from "../models/Store";
import Agent from "../models/Agent";
import Invoice from "../models/Invoice";
import { SecurityMonitor } from "../services/securityMonitor";
import { PlatformAnalyzer } from "../services/platformAnalyzer";
import { AICommandExecutor } from "../services/aiCommandExecutor";

const router = express.Router();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Tu es VocoAI, l'assistant IA du Super Admin VocoShop. Tu as accès à toutes les données de la plateforme en temps réel via des outils spécialisés. Tu peux aussi exécuter des actions administratives si l'utilisateur te le demande.

Tes capacités:
1. ANALYSER — Je peux analyser les stats, revenus, conversions, trends
2. SÉCURITÉ — Je peux faire une veille de sécurité et détecter les anomalies
3. INTERVENIR — Je peux suspendre/activer boutiques, approuver/rejeter agents, étendre abonnements, envoyer notifications
4. CONSEILLER — Je donne des recommandations basées sur les données

Règles:
- Sois concis et actionnable (max 3-5 phrases par réponse)
- Réponds toujours en français
- Pour les actions sensibles, annonce ce que tu vas faire puis demande confirmation avec "CONFIRMER"
- Commence toujours par donner le contexte/les chiffres pertinents
- Termine par une question ou une suggestion d'action
- Si l'utilisateur demande une action, executes-la directement si c'est simple, ou annonce les conséquences
- Style: professionnel mais accessible, comme un consultant business`;

function formatSecurityReport(report: any): string {
  if (!report) return "Rapport de sécurité indisponible.";
  const score = report.score >= 85 ? "🟢" : report.score >= 70 ? "🟡" : "🔴";
  let text = `${score} Score sécurité: ${report.score}/100 (${report.label})\n\n`;
  text += `📊 Métriques:\n`;
  text += `- Échecs connexion 24h: ${report.metrics.failedLogins24h}\n`;
  text += `- Erreurs système 7j: ${report.metrics.errorLogs7d}\n`;
  text += `- Boutiques expirées: ${report.metrics.suspiciousStores}\n`;
  text += `- En grâce: ${report.metrics.expiringSubscriptions}\n`;
  text += `- Inactives: ${report.metrics.inactiveStores}\n`;
  if (report.criticalAlerts.length > 0) {
    text += `\n🚨 Alertes critiques:\n`;
    report.criticalAlerts.forEach((a: any) => {
      text += `- ${a.store}: ${a.detail}\n`;
    });
  }
  if (report.recommendations.length > 0) {
    text += `\n💡 Recommandations:\n`;
    report.recommendations.forEach((r: string) => { text += `${r}\n`; });
  }
  return text;
}

function formatAnalysis(analysis: any): string {
  if (!analysis) return "Analyse indisponible.";
  const s = analysis.summary;
  let text = `📊 Vue d'ensemble:\n`;
  text += `- Boutiques: ${s.totalStores} total (${s.activeStores} actives, ${s.trialStores} trial, ${s.graceStores} grace, ${s.expiredStores} expirées)\n`;
  text += `- Agents: ${s.activeAgents} actifs / ${s.totalAgents} total\n`;
  text += `- Revenus mensuel: ${s.monthlyRevenue.toLocaleString()} XAF\n`;
  text += `- Nouvelles boutiques (30j): +${s.newStoresMonth}\n`;
  text += `- Revenu moyen/boutique: ${s.revenuePerStore.toLocaleString()} XAF\n`;
  if (analysis.topCities.length > 0) {
    text += `\n🏙️ Top villes: ${analysis.topCities.map((c: any) => `${c.city} (${c.count})`).join(", ")}\n`;
  }
  if (analysis.insights.length > 0) {
    text += `\n💡 Insights:\n`;
    analysis.insights.forEach((i: string) => { text += `${i}\n`; });
  }
  if (analysis.churnRisk.length > 0) {
    text += `\n⚠️ Risque churn: ${analysis.churnRisk.length} boutique(s)\n`;
    analysis.churnRisk.slice(0, 3).forEach((s: any) => {
      text += `- ${s.name} (${s.status})\n`;
    });
  }
  return text;
}

router.post("/admin-chat", authMiddleware, requireOwner, async (req: any, res: any) => {
  try {
    const { messages, command, params } = req.body;
    const adminToken = req.headers.authorization;

    // Handle direct commands
    if (command) {
      const result = await AICommandExecutor.execute(command, params, adminToken);
      return res.json({ reply: result.success ? `✅ ${result.message}` : `❌ ${result.message}`, result });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages requis" });
    }

    const lastMessage = messages[messages.length - 1]?.content || messages[messages.length - 1]?.parts?.[0]?.text || "";
    const msg = typeof lastMessage === 'string' ? lastMessage : "";

    // Parse intent for actions
    const parsed = await AICommandExecutor.parseUserIntent(msg);
    if (parsed) {
      const result = await AICommandExecutor.execute(parsed.command, parsed.params, adminToken);
      if (result.success) {
        return res.json({ reply: `✅ ${result.message}`, result, action: parsed.command });
      }
    }

    // Detect special queries
    const lower = msg.toLowerCase();

    if (lower.includes("sécurité") || lower.includes("security") || lower.includes("alerte") || lower.includes("veil")) {
      const report = await SecurityMonitor.getHealthReport();
      return res.json({ reply: formatSecurityReport(report), type: "security" });
    }

    if (lower.includes("analyse") || lower.includes("overview") || lower.includes("vue d'ensemble") || lower.includes("stats") || lower.includes("revenus") || lower.includes("tendances")) {
      const analysis = await PlatformAnalyzer.getOverview();
      return res.json({ reply: formatAnalysis(analysis), type: "analysis" });
    }

    if (lower.includes("logs") || lower.includes("activité") || lower.includes("activity") || lower.includes("historique")) {
      const days = lower.includes("jour") ? parseInt(msg.match(/(\d+)\s*jour/i)?.[1] || "7") : 7;
      const feed = await SecurityMonitor.getActivityFeed(days);
      let text = `📋 Activité système (${days} derniers jours):\n\n`;
      feed.slice(0, 15).forEach((l: any) => {
        const date = new Date(l.date).toLocaleString("fr-FR");
        text += `[${date}] ${l.type?.toUpperCase()} ${l.message?.substring(0, 80)}\n`;
      });
      return res.json({ reply: text, type: "logs" });
    }

    // Build context with live data
    const [
      storeStats,
      agentStats,
      revenueStats,
      securityReport,
      platformAnalysis,
    ] = await Promise.all([
      Store.aggregate([{ $group: { _id: "$subscriptionStatus", count: { $sum: 1 } } }]).catch(() => []),
      Agent.countDocuments({ isApproved: true }).catch(() => 0),
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]).catch(() => [{ total: 0 }]),
      SecurityMonitor.getHealthReport().catch(() => null),
      PlatformAnalyzer.getOverview().catch(() => null),
    ]);

    const subMap: Record<string, number> = {};
    storeStats.forEach((s: any) => { subMap[s._id || "unknown"] = s.count; });

    const context = `
Plateforme actuelle:
- Boutiques: ${subMap.active || 0} actives | ${subMap.trial || 0} trial | ${subMap.grace || 0} grace | ${subMap.expired || 0} expirées
- Revenus total: ${(revenueStats[0]?.total || 0).toLocaleString()} XAF
- Agents: ${agentStats} approuvés
- Score sécurité: ${securityReport?.score || "?"}/100 (${securityReport?.label || "?"})
- Risque churn: ${platformAnalysis?.churnRisk?.length || 0} boutiques
- Nouvelles boutiques 7j: ${platformAnalysis?.summary?.newStoresWeek || 0}
- Revenus mensuels: ${(platformAnalysis?.summary?.monthlyRevenue || 0).toLocaleString()} XAF
`.trim();

    const fullMessages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
      ...messages.slice(-6).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof m.content === 'string' ? m.content : m.parts?.[0]?.text || '' }],
      })),
    ];

    const ai = await (client as any).responses.create({
      model: "gpt-4o-mini",
      input: fullMessages,
      max_output_tokens: 600,
    });

    const reply = typeof ai.output_text === 'string'
      ? ai.output_text
      : ai.output?.[0]?.content?.[0]?.text || "Je n'ai pas pu traiter votre demande.";

    res.json({ reply, type: "chat" });
  } catch (err: any) {
    console.error("❌ VocoAI error:", err.message);
    res.status(500).json({ error: "Erreur VocoAI", details: err.message });
  }
});

/* =====================================================
📌 Route : Deviner la catégorie automatiquement
===================================================== */
router.post("/suggest-category", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Product name required" });

    const ai = await client.responses.create({
      model: "gpt-4o-mini",
      input: `Donne la meilleure catégorie pour ce produit: "${name}". Réponds en JSON: {"category": "...", "confidence": 0-1}`,
    });

    const result = JSON.parse(ai.output_text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "AI failed" });
  }
});

export default router;