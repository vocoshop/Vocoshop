import crypto from "crypto";
import Store from "../models/Store";
import Sales from "../models/Sales";
import StockHistory from "../models/StockHistory";
import Subscription from "../models/Subscription";
import MerchantScore, { IScoreComponent } from "../models/MerchantScore";
import { anchorReport } from "../services/blockchainAnchorService";
import { VocoScoreData, ScoreComponent, VerificationResult } from "./types";

const SCORE_MAX = 1000;

const COMPONENT_DEFINITIONS: { name: string; label: string; weight: number; maxScore: number }[] = [
  { name: "account_age", label: "Ancienneté boutique", weight: 0.10, maxScore: 100 },
  { name: "transaction_frequency", label: "Fréquence ventes", weight: 0.20, maxScore: 200 },
  { name: "revenue_stability", label: "Stabilité revenus", weight: 0.15, maxScore: 150 },
  { name: "subscription_regularity", label: "Régularité abonnement", weight: 0.10, maxScore: 100 },
  { name: "stock_management", label: "Gestion stock", weight: 0.10, maxScore: 100 },
  { name: "sales_regularity", label: "Régularité activité", weight: 0.15, maxScore: 150 },
  { name: "app_engagement", label: "Engagement application", weight: 0.10, maxScore: 100 },
  { name: "payment_history", label: "Historique paiements", weight: 0.10, maxScore: 100 },
];

function hashScoreData(data: VocoScoreData): string {
  const serialized = JSON.stringify({
    storeId: data.storeId,
    overallScore: data.overallScore,
    components: data.components.map((c) => ({ name: c.name, score: c.score })),
    periodEnd: data.periodEnd.toISOString(),
    transactionCount: data.transactionCount,
  });
  return crypto.createHash("sha256").update(serialized, "utf8").digest("hex");
}

function computeChainHash(dataHash: string, previousHash: string | null): string {
  return crypto
    .createHash("sha256")
    .update(dataHash + (previousHash || "genesis"))
    .digest("hex");
}

export async function computeScore(storeId: string): Promise<VocoScoreData> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [store, recentSales, subscription] = await Promise.all([
    Store.findOne({ shopId: storeId }).lean(),
    Sales.find({ storeId, createdAt: { $gte: thirtyDaysAgo } }).sort({ createdAt: -1 }).lean(),
    Subscription.findOne({ storeId }).sort({ createdAt: -1 }).lean(),
  ]);

  const components: ScoreComponent[] = [];

  let accountAgeDays = 0;
  if (store?.createdAt) {
    accountAgeDays = Math.floor(
      (now.getTime() - new Date(store.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
  }
  const accountAgeScore = Math.min(accountAgeDays, 365);
  components.push({
    name: "account_age",
    label: "Ancienneté boutique",
    value: accountAgeDays,
    weight: 0.10,
    score: Math.round((accountAgeScore / 365) * 100),
    maxScore: 100,
  });

  const transactionCount = recentSales.length;
  const avgMonthlyTransactions = transactionCount;
  const transactionScore = Math.min(avgMonthlyTransactions * 5, 200);
  components.push({
    name: "transaction_frequency",
    label: "Fréquence ventes",
    value: avgMonthlyTransactions,
    weight: 0.20,
    score: transactionScore,
    maxScore: 200,
  });

  let revenueStability = 100;
  if (recentSales.length >= 4) {
    const weeklyRevenues = [0, 0, 0, 0];
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    recentSales.forEach((sale) => {
      const saleDate = new Date(sale.createdAt);
      const weekIndex = Math.min(
        Math.floor(
          (saleDate.getTime() - fourWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000)
        ),
        3
      );
      if (weekIndex >= 0) {
        weeklyRevenues[weekIndex] += typeof (sale as any).totalAmount === "number" ? (sale as any).totalAmount : 0;
      }
    });
    const maxRevenue = Math.max(...weeklyRevenues, 1);
    const minRevenue = Math.min(...weeklyRevenues, 0);
    revenueStability = minRevenue > 0 ? Math.round((minRevenue / maxRevenue) * 150) : 30;
  }
  components.push({
    name: "revenue_stability",
    label: "Stabilité revenus",
    value: revenueStability,
    weight: 0.15,
    score: Math.min(revenueStability, 150),
    maxScore: 150,
  });

  let subscriptionRegularity = 50;
  if (subscription) {
    subscriptionRegularity = subscription.status === "active" ? 100 : 30;
  }
  components.push({
    name: "subscription_regularity",
    label: "Régularité abonnement",
    value: subscriptionRegularity,
    weight: 0.10,
    score: subscriptionRegularity,
    maxScore: 100,
  });

  const stockHistory = await StockHistory.find({ storeId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const stockManagementScore = Math.min(stockHistory.length * 2, 100);
  components.push({
    name: "stock_management",
    label: "Gestion stock",
    value: stockHistory.length,
    weight: 0.10,
    score: stockManagementScore,
    maxScore: 100,
  });

  const daysActive = Math.min(
    recentSales.length > 0
      ? new Set(
          recentSales.map((s) =>
            new Date(s.createdAt).toISOString().slice(0, 10)
          )
        ).size * 5
      : 0,
    150
  );
  components.push({
    name: "sales_regularity",
    label: "Régularité activité",
    value: daysActive,
    weight: 0.15,
    score: daysActive,
    maxScore: 150,
  });

  const loginCount = store?.loginCount || 0;
  const appEngagement = Math.min(loginCount * 2, 100);
  components.push({
    name: "app_engagement",
    label: "Engagement application",
    value: loginCount,
    weight: 0.10,
    score: appEngagement,
    maxScore: 100,
  });

  const paymentHistoryScore = subscription?.status === "active" ? 100 : 20;
  components.push({
    name: "payment_history",
    label: "Historique paiements",
    value: paymentHistoryScore,
    weight: 0.10,
    score: paymentHistoryScore,
    maxScore: 100,
  });

  const overallScore = Math.round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0)
  );

  return {
    storeId,
    overallScore: Math.min(overallScore, SCORE_MAX),
    components,
    periodStart: thirtyDaysAgo,
    periodEnd: now,
    transactionCount,
    averageMonthlyTransactions: avgMonthlyTransactions,
    accountAgeDays,
    subscriptionRegularity,
    stockManagementScore,
    revenueStability,
  };
}

export async function certifyScore(storeId: string): Promise<VocoScoreData & {
  chainHash: string;
  previousHash: string | null;
  anchorType: string;
  txHash: string | null;
  blockNumber: number | null;
  explorerUrl: string | null;
  certificationId: string;
}> {
  const scoreData = await computeScore(storeId);
  const dataHash = hashScoreData(scoreData);

  const lastScore = await MerchantScore.findOne({ storeId })
    .sort({ createdAt: -1 })
    .lean();
  const previousHash = lastScore ? lastScore.chainHash : null;

  const anchorResult = await anchorReport({
    dataHash,
    storeId,
    month: new Date().toISOString().slice(0, 7),
  });

  const chainHash = computeChainHash(dataHash, previousHash);

  await MerchantScore.create({
    storeId: scoreData.storeId,
    overallScore: scoreData.overallScore,
    components: scoreData.components.map((c) => ({
      name: c.name,
      label: c.label,
      value: c.value,
      weight: c.weight,
      score: c.score,
      maxScore: c.maxScore,
    })),
    periodStart: scoreData.periodStart,
    periodEnd: scoreData.periodEnd,
    transactionCount: scoreData.transactionCount,
    averageMonthlyTransactions: scoreData.averageMonthlyTransactions,
    accountAgeDays: scoreData.accountAgeDays,
    subscriptionRegularity: scoreData.subscriptionRegularity,
    stockManagementScore: scoreData.stockManagementScore,
    revenueStability: scoreData.revenueStability,
    chainHash,
    previousHash,
    anchorType: anchorResult.type,
    txHash: anchorResult.txHash,
    blockNumber: anchorResult.blockNumber,
    chainId: anchorResult.chainId,
    explorerUrl: anchorResult.explorerUrl,
  });

  return {
    ...scoreData,
    chainHash,
    previousHash,
    anchorType: anchorResult.type,
    txHash: anchorResult.txHash,
    blockNumber: anchorResult.blockNumber,
    explorerUrl: anchorResult.explorerUrl,
    certificationId: chainHash,
  };
}

export async function verifyScore(storeId: string): Promise<{
  current: VocoScoreData | null;
  lastCertified: VocoScoreData | null;
  verification: VerificationResult | null;
}> {
  const lastCertifiedDoc = await MerchantScore.findOne({ storeId })
    .sort({ createdAt: -1 })
    .lean();

  const current = await computeScore(storeId);

  if (!lastCertifiedDoc) {
    return { current, lastCertified: null, verification: null };
  }

  const dataHash = hashScoreData(current);
  const expectedChainHash = computeChainHash(dataHash, lastCertifiedDoc.previousHash);
  const chainHashMatches = expectedChainHash === lastCertifiedDoc.chainHash;

  const integrityCheck = {
    computedHash: dataHash,
    storedHash: lastCertifiedDoc.chainHash,
    matches: chainHashMatches,
  };

  let previousCheck = { isLinked: true, expectedPreviousHash: null as string | null, actualPreviousHash: null as string | null };
  if (lastCertifiedDoc.previousHash) {
    const prev = await MerchantScore.findOne({ chainHash: lastCertifiedDoc.previousHash }).lean();
    previousCheck = {
      isLinked: !!prev,
      expectedPreviousHash: lastCertifiedDoc.previousHash,
      actualPreviousHash: prev?.chainHash || null,
    };
  }

  const lastCertified: VocoScoreData = {
    storeId: lastCertifiedDoc.storeId,
    overallScore: lastCertifiedDoc.overallScore,
    components: lastCertifiedDoc.components.map((c) => ({
      name: c.name,
      label: c.label,
      value: c.value,
      weight: c.weight,
      score: c.score,
      maxScore: c.maxScore,
    })),
    periodStart: lastCertifiedDoc.periodStart,
    periodEnd: lastCertifiedDoc.periodEnd,
    transactionCount: lastCertifiedDoc.transactionCount,
    averageMonthlyTransactions: lastCertifiedDoc.averageMonthlyTransactions,
    accountAgeDays: lastCertifiedDoc.accountAgeDays,
    subscriptionRegularity: lastCertifiedDoc.subscriptionRegularity,
    stockManagementScore: lastCertifiedDoc.stockManagementScore,
    revenueStability: lastCertifiedDoc.revenueStability,
  };

  return {
    current,
    lastCertified,
    verification: {
      isValid: chainHashMatches && previousCheck.isLinked,
      document: {
        id: lastCertifiedDoc._id.toString(),
        documentType: "confidence_score",
        storeId: lastCertifiedDoc.storeId,
        createdAt: lastCertifiedDoc.createdAt,
      },
      chain: {
        chainHash: lastCertifiedDoc.chainHash,
        previousHash: lastCertifiedDoc.previousHash,
        anchorType: lastCertifiedDoc.anchorType,
        txHash: lastCertifiedDoc.txHash,
        blockNumber: lastCertifiedDoc.blockNumber,
      },
      integrityCheck,
      chainIntegrity: previousCheck,
    },
  };
}

export async function getScoreHistory(
  storeId: string,
  limit = 12,
  offset = 0
): Promise<{ scores: VocoScoreData[]; total: number }> {
  const [docs, total] = await Promise.all([
    MerchantScore.find({ storeId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    MerchantScore.countDocuments({ storeId }),
  ]);

  const scores = docs.map((doc) => ({
    storeId: doc.storeId,
    overallScore: doc.overallScore,
    components: doc.components.map((c: IScoreComponent) => ({
      name: c.name,
      label: c.label,
      value: c.value,
      weight: c.weight,
      score: c.score,
      maxScore: c.maxScore,
    })),
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    transactionCount: doc.transactionCount,
    averageMonthlyTransactions: doc.averageMonthlyTransactions,
    accountAgeDays: doc.accountAgeDays,
    subscriptionRegularity: doc.subscriptionRegularity,
    stockManagementScore: doc.stockManagementScore,
    revenueStability: doc.revenueStability,
  }));

  return { scores, total };
}

export function getScoreComponents(): { name: string; label: string; weight: number; maxScore: number }[] {
  return COMPONENT_DEFINITIONS;
}
