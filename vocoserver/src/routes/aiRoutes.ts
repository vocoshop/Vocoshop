import express from "express";
import OpenAI from "openai";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import Store from "../models/Store";
import Product from "../models/Product";
import Agent from "../models/Agent";
import Invoice from "../models/Invoice";
import { SecurityMonitor } from "../services/securityMonitor";
import { PlatformAnalyzer } from "../services/platformAnalyzer";
import { AICommandExecutor } from "../services/aiCommandExecutor";
import { preprocessForVision } from "../services/imagePreprocess";
import { getStoreId } from "../utils/storeId";

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
      let days = 7;
      const jourIdx = lower.indexOf("jour");
      if (jourIdx > 0) {
        let i = jourIdx - 1;
        while (i >= 0 && lower[i] === " ") i--;
        let end = i + 1;
        while (i >= 0 && lower[i] >= "0" && lower[i] <= "9") i--;
        if (i + 1 < end) days = parseInt(lower.slice(i + 1, end), 10);
      }
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
    res.status(500).json({ error: "Erreur VocoAI" });
  }
});

/* =====================================================
📸 Route : Reconnaître des produits par photo (Vision IA)
===================================================== */
router.post("/vision-products", authMiddleware, async (req, res) => {
  try {
    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Images requises" });
    }

    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    // Preprocess images for Vision API
    const processedImages = await Promise.all(
      images.map(async (img: string) => {
        try {
          const result = await preprocessForVision(img);
          return `data:${result.mimeType};base64,${result.buffer.toString("base64")}`;
        } catch {
          return img;
        }
      })
    );

    // Prepare image content parts for OpenAI
    const imageParts = processedImages.map((img) => ({
      type: "image_url" as const,
      image_url: { url: img, detail: "low" as const },
    }));

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Tu es un assistant de gestion de stock pour boutique africaine. " +
              "Analyse la/les photo(s) de produits. " +
              "Reponds UNIQUEMENT avec un JSON valide, sans preambule, sans texte autour, sans balises markdown.\n\n" +
              "Format JSON attendu:\n" +
              `{\n` +
              `  "products": [\n` +
              `    { "name": "Marque Produit avec taille", "category": "Categorie", "brand": "Marque", "unit": "piece", "estimatedQuantity": 1, "suggestedExpirationDate": "", "suggestedSellPrice": 0, "suggestedPurchasePrice": 0, "packaging": { "name": "Casier", "contains": 24 } }\n` +
              `  ]\n` +
              `}\n\n` +
              "REGLE IMPORTANTE — DETECTER L'EMBALLAGE / CONDITIONNEMENT:\n" +
              "Si certaines photos montrent le produit a l'unite ET d'autres photos montrent un emballage (casier, carton, sac, pack...), remplis le champ 'packaging':\n" +
              "  - 'name' : le nom de l'emballage (Casier, Carton, Sac, Pack, Palette, Bouteille...)\n" +
              "  - 'contains' : combien d'unites sont dans cet emballage (ex: 24 pour un casier de 24 bouteilles, 12 pour un carton)\n\n" +
              "POUR LES SACS :\n" +
              "  - Lis TOUS les textes imprimes sur le sac (poids, etiquette).\n" +
              "  - Si '50 kg', '25 kg', '10 kg' est ecrit → 'contains' = 50, 25 ou 10\n" +
              "  - Si 'Net Wt 50 KG', 'Poids Net 25kg' → extrais le nombre\n" +
              "  - Le nom devient 'name': 'Sac' et 'contains': le poids en chiffres\n" +
              "  - Ex: sac Dania marque '50 KG' → packaging: { name: 'Sac', contains: 50 }\n" +
              "  - Ex: sac farine '25 kg net' → packaging: { name: 'Sac', contains: 25 }\n\n" +
              "Exemples:\n" +
              "  Photo unite: bouteille Coca 50cl | Photo casier: casier rouge 24 bouteilles → packaging: { name: \"Casier\", contains: 24 }\n" +
              "  Photo unite: paquet de sucre 1kg | Photo sac: sac Dania '50 KG' → packaging: { name: \"Sac\", contains: 50 }\n" +
              "  Photo sac seul: sac farine 'NET WT 25kg' → packaging: { name: \"Sac\", contains: 25 }\n" +
              "  Photo unite: sachet lait 500g | Photo carton: carton 12 sachets → packaging: { name: \"Carton\", contains: 12 }\n\n" +
              "REGLE ABSOLUE — LA MARQUE FAIT PARTIE DU NOM:\n" +
              "Deux memes produits avec la MEME taille/poids mais de MARQUES DIFFERENTES sont des produits DIFFERENTS.\n" +
              "Le nom DOIT inclure la marque quand elle est visible.\n" +
              "Exemples:\n" +
              "  CORRECT: \"Lait Candia 1L\" et \"Lait Lactel 1L\" (memes format, marques differentes)\n" +
              "  CORRECT: \"Sucre Dania 1kg\" et \"Sucre Saint-Louis 1kg\"\n" +
              "  CORRECT: \"Eau Pure Vie 1.5L\" et \"Eau Olgane 1.5L\"\n" +
              "  CORRECT: \"Farine La Colombe 1kg\" et \"Farine Les Moulins 1kg\"\n" +
              "  FAUX: \"Lait 1L\" et \"Lait 1L\" (marques non specifiees = confusion)\n\n" +
              "REGLE ABSOLUE — DISTINGUER LES FORMATS/TAILLES:\n" +
              "Le MEME produit vendu en DIFFERENTES TAILLES/VOLUMES/POIDS doit etre liste comme des produits SEPARES avec des noms DIFFERENTS.\n" +
              "Exemples concrets:\n" +
              "  CORRECT: \"Huile Aya 50cl\" et \"Huile Aya 1L\" (deux noms differents !)\n" +
              "  CORRECT: \"Riz Sodex 1kg\" et \"Riz Sodex 5kg\" et \"Riz Sodex 25kg\"\n" +
              "  CORRECT: \"Savon Super 200g\" et \"Savon Super 400g\"\n" +
              "  CORRECT: \"Eau Pure Vie 50cl\" et \"Eau Pure Vie 1.5L\"\n" +
              "  FAUX: \"Eau\" ou \"Lait\" ou \"Riz\" (trop generique)\n\n" +
              "Regles:\n" +
              "- Le champ 'name' DOIT TOUJOURS inclure: [Marque] + [Produit] + [Taille/Volume/Poids] si visibles sur l'emballage\n" +
              "- Le champ 'brand' = le nom de la marque si visible (ex: \"Candia\", \"Coca-Cola\", \"Dania\"), sinon chaine vide\n" +
              "- Si la marque n'est PAS visible, mets juste \"Produit + Taille\" (ex: \"Riz parfume 1kg\")\n" +
              "- Meme si le format n'est pas ecrit, deduis-le de la forme de l'emballage (bouteille 50cl vs 1L, sachet 500g vs 1kg)\n" +
              "- Categorie en francais (ex: Boisson, Epicerie, Laitiere, Hygiene, Quincaillerie, etc.)\n" +
              "- unit = l'unite de vente. Pour les sacs de farine/riz/sucre, mets 'kg' ou 'kilogramme'. Pour les bouteilles, mets 'piece' ou 'bouteille'. Pour les sachets, mets 'sachet' ou 'piece'.\n" +
              "- estimatedQuantity = la quantite estimee visible sur la photo (ex: 1 bouteille = 1, un pack de 6 = 6, un carton de 12 = 12, un lot de 20 savons = 20)\n" +
              "- suggestedExpirationDate = date d'expiration si visible sur l'emballage (format YYYY-MM-DD ou YYYY-MM, sinon chaine vide)\n" +
              "- suggestedSellPrice = prix de vente estime en FCFA (0 si inconnu)\n" +
              "- suggestedPurchasePrice = prix d'achat estime en FCFA (0 si inconnu)\n" +
              "- Si aucune photo ne montre de produit identifiable, reponds { \"products\": [] }",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identifie tous les produits visibles sur ces photos. ATTENTION: certaines photos peuvent montrer le produit a l'unite, d'autres son emballage (casier, carton, sac). Si tu vois un emballage, indique son nom et combien d'unites il contient dans le champ packaging. Si la marque est visible, inclus-la dans le nom.",
              },
              ...imageParts,
            ],
          },
        ],
        max_completion_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenAI Vision API error:", response.status, text);
      return res.status(502).json({ error: "Erreur API Vision" });
    }

    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown-wrapped JSON)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "Réponse IA invalide", raw: content });
    }

    const result = JSON.parse(jsonMatch[0]);
    res.json(result);
  } catch (err: any) {
    console.error("Vision products error:", err.message);
    res.status(500).json({ error: "Erreur lors de l'analyse des produits" });
  }
});

/* =====================================================
📌 Route : Importer en stock les produits détectés par photo
===================================================== */
router.post("/vision-products/import", authMiddleware, async (req, res) => {
  try {
    const { products: productList } = req.body;
    const storeId = getStoreId(req);
    if (!storeId) return res.status(401).json({ error: "Authentification requise" });

    if (!Array.isArray(productList) || productList.length === 0) {
      return res.status(400).json({ error: "Liste de produits requise" });
    }

    const created: any[] = [];
    const errors: string[] = [];

    for (const item of productList) {
      try {
        if (!item.name || !item.name.trim()) {
          errors.push("Nom de produit manquant");
          continue;
        }

        // Check if product already exists (by name — exact puis flexible)
        const cleanName = item.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let existing = await Product.findOne({
          storeId,
          name: { $regex: new RegExp(`^${cleanName}$`, "i") },
        });

        // 🔄 Fallback flexible : tous les mots doivent être présents
        if (!existing) {
          const words = cleanName.split(/\s+/).filter(Boolean);
          if (words.length > 1) {
            const andPattern = words.map((w: string) => `(?=.*${w})`).join("");
            existing = await Product.findOne({
              storeId,
              name: { $regex: new RegExp(andPattern, "i") },
            });
          }
        }

        let product;
        const qty = Math.max(1, parseInt(item.quantity) || 1);
        const unit = item.unit || "pièce";
        const updateFields: any = {
          $inc: { quantity: qty },
          ...(item.purchasePrice > 0 ? { purchasePrice: item.purchasePrice } : {}),
          ...(unit !== "pièce" ? { unit } : {}),
        };

        // Handle expiration date
        if (item.expirationDate) {
          const expDate = new Date(item.expirationDate);
          if (!isNaN(expDate.getTime())) {
            updateFields.$push = { expirationDates: expDate };
          }
        }

        if (existing) {
          product = await Product.findByIdAndUpdate(
            existing._id,
            updateFields,
            { new: true }
          );
          created.push({ product, isNew: false, quantityAdded: qty });
        } else {
          // Packaging détecté par l'IA
          const packaging = (item as any).packaging;
          const pConfigs: any[] = [];
          if (packaging && packaging.name && packaging.contains > 1) {
            pConfigs.push({
              name: packaging.name,
              quantity: packaging.contains,
              purchasePrice: Math.max(0, parseInt(item.purchasePrice) || 0),
            });
          }
          const createFields: any = {
            storeId,
            name: item.name.trim(),
            category: item.category || "",
            unit,
            baseUnit: unit,
            sellPrice: Math.max(0, parseInt(item.sellPrice) || 0),
            purchasePrice: Math.max(0, parseInt(item.purchasePrice) || 0),
            quantity: qty,
            alertLevel: 3,
            purchaseConfigs: pConfigs,
            sellConfigs: [{
              name: "Unité",
              quantity: 1,
              sellPrice: Math.max(0, parseInt(item.sellPrice) || 0),
            }],
          };
          if (item.expirationDate) {
            const expDate = new Date(item.expirationDate);
            if (!isNaN(expDate.getTime())) {
              createFields.expirationDates = [expDate];
            }
          }
          product = await Product.create(createFields);
          created.push({ product, isNew: true, quantityAdded: qty });
        }
      } catch (err: any) {
        errors.push(`${item.name || "?"}: ${err.message}`);
      }
    }

    res.json({
      created: created.length,
      errors,
      products: created.map((c) => ({
        _id: c.product._id,
        name: c.product.name,
        quantity: c.product.quantity,
        isNew: c.isNew,
        quantityAdded: c.quantityAdded,
      })),
    });
  } catch (err: any) {
    console.error("Vision products import error:", err.message);
    res.status(500).json({ error: "Erreur lors de l'import des produits" });
  }
});

/* =====================================================
📌 Route : Deviner la catégorie automatiquement
===================================================== */
router.post("/suggest-category", authMiddleware, async (req, res) => {
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