import { Request, Response } from "express";
import crypto from "crypto";
import Store from "../models/Store";
import Sale from "../models/Sales";
import OcrScan from "../models/OcrScan";
import FundingDemande from "../models/FundingDemande";
import StockHistory from "../models/StockHistory";
import Product from "../models/Product";
import SharedReportLink from "../models/SharedReportLink";
import DailyReport from "../models/DailyReport";
import Partner from "../models/Partner";
import { sendLoanRequestEmail } from "../services/emailService";
import { getStoreId } from "../utils/storeId";
import { isValidObjectId } from "../utils/helpers";

/* =====================================================
   CALCUL DU SCORE COMMERCANT V1
   Sur 100 points :
   - Régularité d'utilisation : 30 pts
   - Qualité des données : 20 pts
   - Ancienneté : 15 pts
   - Stabilité commerciale : 15 pts
   - Gestion du stock : 10 pts
   - Historique financier : 10 pts (réservé futur)
   ===================================================== */
async function calculateScore(storeId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const store = await Store.findOne({ shopId: storeId }).lean();
  const createdAt = store?.createdAt ? new Date(store.createdAt) : now;
  const monthsActive = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)));

  const [totalSales, recentSales, totalScans, recentScans, totalProducts, recentStockMoves] = await Promise.all([
    Sale.countDocuments({ storeId }),
    Sale.countDocuments({ storeId, createdAt: { $gte: thirtyDaysAgo } }),
    OcrScan.countDocuments({ storeId }),
    OcrScan.countDocuments({ storeId, createdAt: { $gte: thirtyDaysAgo } }),
    Product.countDocuments({ storeId }),
    StockHistory.countDocuments({ storeId, createdAt: { $gte: ninetyDaysAgo } }),
  ]);

  const uniqueSaleDays = await Sale.distinct("businessDate", { storeId, createdAt: { $gte: thirtyDaysAgo } });
  const activeDays = Array.isArray(uniqueSaleDays) ? uniqueSaleDays.length : 0;

  const uniqueScanDays = await OcrScan.distinct("createdAt", { storeId, createdAt: { $gte: thirtyDaysAgo } });
  const scanDays = Array.isArray(uniqueScanDays) ? uniqueScanDays.length : 0;

  const lastSale = await Sale.findOne({ storeId }).sort({ createdAt: -1 }).lean();
  const lastActivity = lastSale?.createdAt || store?.createdAt || null;

  const scansWithReview = await OcrScan.countDocuments({ storeId, needsReview: true });
  const reviewRate = totalScans > 0 ? scansWithReview / totalScans : 0;

  /* --- Régularité (30 pts) --- */
  const dayScore = Math.min(30, (activeDays / 30) * 20 + (scanDays / 30) * 10);

  /* --- Qualité des données (20 pts) --- */
  const hasProducts = totalProducts > 0 ? 5 : 0;
  const qualityNoReview = Math.max(0, 10 - reviewRate * 20);
  const dataScore = Math.min(20, hasProducts + qualityNoReview + (totalSales > 10 ? 5 : totalSales > 0 ? 2 : 0));

  /* --- Ancienneté (15 pts) --- */
  const ancienneteScore = Math.min(15, monthsActive * 2);

  /* --- Stabilité (15 pts) --- */
  const stabilityScore = Math.min(15, activeDays >= 20 ? 15 : activeDays >= 10 ? 10 : activeDays >= 5 ? 6 : activeDays >= 1 ? 3 : 0);

  /* --- Gestion stock (10 pts) --- */
  const stockScore = Math.min(10, (recentStockMoves > 0 ? 5 : 0) + (totalProducts >= 5 ? 5 : totalProducts >= 1 ? 3 : 0));

  /* --- Historique financier (10 pts) - réservé futur --- */
  const financeScore = 0;

  const total = Math.round(dayScore + dataScore + ancienneteScore + stabilityScore + stockScore + financeScore);

  return {
    score: Math.min(100, Math.max(0, total)),
    breakdown: {
      regularite: { points: Math.round(dayScore), max: 30, label: "Régularité d'utilisation" },
      qualite: { points: Math.round(dataScore), max: 20, label: "Qualité des données" },
      anciennete: { points: Math.round(ancienneteScore), max: 15, label: "Ancienneté" },
      stabilite: { points: Math.round(stabilityScore), max: 15, label: "Stabilité commerciale" },
      stock: { points: Math.round(stockScore), max: 10, label: "Gestion du stock" },
      finance: { points: financeScore, max: 10, label: "Historique financier" },
    },
    meta: {
      monthsActive,
      activeDays,
      totalSales,
      totalScans,
      totalProducts,
      lastActivity: lastActivity?.toISOString() || null,
      reviewRate: Math.round(reviewRate * 100),
    },
  };
}

/* =====================================================
   GET /api/funding/score
   ===================================================== */
export const getScore = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(401).json({ error: "Non autorisé" });

    const result = await calculateScore(storeId);
    res.json(result);
  } catch (err: any) {
    console.error("Erreur calcul score:", err);
    res.status(500).json({ error: "Erreur lors du calcul du score" });
  }
};

/* =====================================================
   GET /api/funding/demandes
   ===================================================== */
export const getDemandes = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(401).json({ error: "Non autorisé" });

    const demandes = await FundingDemande.find({ storeId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: demandes });
  } catch (err: any) {
    console.error("Erreur get demandes:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des demandes" });
  }
};

/* =====================================================
   POST /api/funding/demandes
   Crée la demande + envoie un mail lettre de prêt au partenaire
   ===================================================== */
export const createDemande = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    const userId = req.user?.id || "";
    if (!storeId) return res.status(401).json({ error: "Non autorisé" });

    const { partnerId, amount, objective, phone, address, comment, partnerEmail, consentGiven } = req.body;

    if (!amount || !phone) {
      return res.status(400).json({ error: "Montant et téléphone requis" });
    }

if (!consentGiven) {
return res.status(400).json({ error: "Consentement requis : tu dois autoriser le partage de tes données financières" });
}

if (!partnerId || !isValidObjectId(partnerId)) {
return res.status(400).json({ error: "Partenaire invalide" });
}
const partner = await Partner.findOne({ _id: partnerId, active: true }).lean();
    const partnerName = partner?.name || "";
    const recipientEmail = partnerEmail || partner?.email || "";

    const demande = await FundingDemande.create({
      storeId,
      userId,
      partnerId: partnerId || "",
      partnerName,
      amount: Number(amount),
      objective: objective || "",
      phone,
      address: address || "",
      comment: comment || "",
      status: "pending",
      consentGiven: true,
      consentDate: new Date(),
    });

    // ===== ENVOI EMAIL LETTRE DE PRÊT =====
    let emailSent = false;
    let emailError: string | undefined;

    if (recipientEmail) {
      try {
        // Calculer le score
        const scoreResult = await calculateScore(storeId);
        const { score, breakdown, meta } = scoreResult;

        // Récupérer les infos du store
        const storeDoc = await Store.findOne({ shopId: storeId }).lean();
        const merchantName = String((storeDoc as any)?.storeName || "Commerce");
        const merchantCity = String((storeDoc as any)?.city || "");
        const merchantPhone = String((storeDoc as any)?.phone || phone);

        // Score label
        const scoreLabel = score >= 70 ? "Excellent" : score >= 50 ? "Bon" : score >= 30 ? "Moyen" : "Faible";

        // Mois en cours
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthFrom = `${currentMonth}-01`;
        const monthTo = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

        // KPIs du mois
        const reports = await DailyReport.find({
          storeId,
          date: { $gte: monthFrom, $lte: monthTo },
        }).lean();

        const monthlyRevenue = (reports as any[]).reduce((s, r) => s + Number(r?.totalRevenue || 0), 0);
        const monthlyGrossProfit = (reports as any[]).reduce((s, r) => s + Number(r?.grossProfit || 0), 0);
        const monthlyNetProfit = (reports as any[]).reduce((s, r) => s + Number(r?.netProfit || 0), 0);
        const totalSales = await Sale.countDocuments({ storeId });

        // Trouver ou créer un lien de partage pour le mois en cours
        let shareLink = await SharedReportLink.findOne({
          storeId,
          month: currentMonth,
          isActive: true,
          expiresAt: { $gt: now },
        }).lean();

        if (!shareLink) {
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

          // Hash d'intégrité
          const dataRows = (reports as any[]).map(r => ({
            date: String(r.date || "").slice(0, 10),
            revenue: Number(r?.totalRevenue || 0),
            cogs: Number(r?.cogs || 0),
            profit: Number(r?.netProfit || r?.grossProfit || 0),
            sales: Number(r?.totalSales || 0),
          }));
          const monthlyCogs = (reports as any[]).reduce((s, r) => s + Number(r?.cogs || 0), 0);
          const monthlyMarginPercent = monthlyRevenue > 0 ? (monthlyGrossProfit / monthlyRevenue) * 100 : 0;

          const { computeDataHash } = await import("./reportController");
          const dataHash = computeDataHash({
            revenue: monthlyRevenue, cogs: monthlyCogs,
            grossProfit: monthlyGrossProfit, netProfit: monthlyNetProfit,
            salesCount: totalSales, marginPercent: monthlyMarginPercent,
            from: monthFrom, to: monthTo, rows: dataRows,
          });

          shareLink = await SharedReportLink.create({
            storeId,
            month: currentMonth,
            token,
            isActive: true,
            expiresAt,
            dataHash,
            storeName: merchantName,
          }) as any;
        }

        const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
        const token = String((shareLink as any).token);
        const dashboardUrl = `${base}/api/public/report/share/${token}`;
        const pdfUrl = `${base}/api/public/report/share/${token}/pdf`;
        const verifyUrl = `${base}/api/public/report/verify/${token}`;

        // Envoi de l'email
        const result = await sendLoanRequestEmail({
          to: recipientEmail,
          merchantName,
          merchantCity,
          merchantPhone,
          shopId: storeId,
          amount: Number(amount),
          objective: objective || "",
          partnerName,
          score,
          scoreLabel,
          monthlyRevenue,
          monthlyProfit: monthlyNetProfit,
          monthsActive: meta.monthsActive,
          totalSales,
          dashboardUrl,
          pdfUrl,
          verifyUrl,
        });

        emailSent = result.sent;
        emailError = result.error;

        // Mettre à jour la demande avec le lien
        await FundingDemande.updateOne(
          { _id: demande._id },
          {
            $set: {
              emailSent,
              dashboardUrl,
              shareToken: token,
            },
          }
        );
      } catch (emailErr: any) {
        console.error("❌ Erreur envoi email prêt:", emailErr?.message || emailErr);
        emailError = emailErr?.message || "Erreur inconnue";
      }
    }

    res.status(201).json({
      ...((demande as any).toObject?.() || demande),
      emailSent,
      emailError: emailSent ? undefined : emailError || (recipientEmail ? "Email non envoyé" : "Aucune adresse email partenaire"),
    });
  } catch (err: any) {
    console.error("Erreur create demande:", err);
    res.status(500).json({ error: "Erreur lors de la création de la demande" });
  }
};

/* =====================================================
   GET /api/funding/opportunities
   ===================================================== */
export const getOpportunities = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(401).json({ error: "Non autorisé" });

    const result = await calculateScore(storeId);
    const { score, meta } = result;
    const opportunities: string[] = [];

    if (score >= 60) opportunities.push("Votre score est éligible au financement.");
    if (meta.activeDays >= 20) opportunities.push("Votre activité est très régulière ce mois-ci.");
    if (meta.totalSales > 50) opportunities.push("Vous avez plus de 50 ventes enregistrées.");
    if (meta.totalScans > 10) opportunities.push("Vos données OCR améliorent votre fiabilité.");
    if (score >= 70 && score < 81) opportunities.push("Vous êtes proche du niveau Excellent Profil.");
    if (meta.monthsActive >= 6) opportunities.push(`${meta.monthsActive} mois d'ancienneté — un atout pour le financement.`);
    if (meta.monthsActive >= 3 && meta.monthsActive < 6) opportunities.push("Votre activité est stable depuis 90 jours.");
    if (meta.monthsActive >= 1 && meta.monthsActive < 3) opportunities.push("Votre boutique gagne en maturité.");
    if (meta.monthsActive < 1 && meta.activeDays >= 1) opportunities.push(`${meta.activeDays} jours d'activité — continuez comme ça !`);

    if (opportunities.length === 0) {
      opportunities.push("Continuez à enregistrer vos ventes pour améliorer votre score.");
    }

    res.json({ score, opportunities, meta });
  } catch (err: any) {
    console.error("Erreur get opportunities:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des opportunités" });
  }
};

/* =====================================================
   GET /api/funding/partners
   Liste des partenaires actifs (publique)
   ===================================================== */
export const getPartners = async (req: Request, res: Response) => {
  try {
    const partners = await Partner.find({ active: true })
      .sort({ order: 1, createdAt: 1 })
      .select("name type min max responseTime rate")
      .lean();
    res.json({ partners });
  } catch (err: any) {
    console.error("Erreur get partners:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   GET /api/funding/admin/demandes
   Toutes les demandes (admin) avec infos store
   ===================================================== */
export const getAllDemandesAdmin = async (req: Request, res: Response) => {
  try {
const { status, page = "1", limit = "20" } = req.query;
const filter: any = {};
if (typeof status === "string" && status !== "all") filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [demandes, total] = await Promise.all([
      FundingDemande.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FundingDemande.countDocuments(filter),
    ]);

    const storeIds = [...new Set(demandes.map((d) => d.storeId).filter(Boolean))];
    const stores = await Store.find({ shopId: { $in: storeIds } })
      .select("shopId storeName city phone")
      .lean();
    const storeMap = new Map(stores.map((s: any) => [s.shopId, s]));

    const enriched = demandes.map((d) => ({
      ...d,
      storeInfo: storeMap.get(d.storeId) || null,
    }));

    res.json({ data: enriched, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err: any) {
    console.error("❌ getAllDemandesAdmin:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   PUT /api/funding/admin/demandes/:id
   Mettre à jour le statut d'une demande
   ===================================================== */
export const updateDemandeStatus = async (req: Request, res: Response) => {
  try {
const { id } = req.params;
if (!id || !isValidObjectId(id)) {
return res.status(400).json({ error: "ID demande invalide" });
}

const { status, comment } = req.body;

const validStatuses = ["pending", "info_required", "accepted", "rejected", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }

    const update: Record<string, unknown> = { status: String(status) };
    if (typeof comment === "string") update.adminComment = comment.trim();

    const demande = await FundingDemande.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!demande) return res.status(404).json({ error: "Demande introuvable" });

    res.json({ data: demande });
  } catch (err: any) {
    console.error("❌ updateDemandeStatus:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
