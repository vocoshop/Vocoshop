// controllers/reportController.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import PDFDocument = require("pdfkit");
import QRCode from "qrcode";

import Product from "../models/Product";
import StockHistory from "../models/StockHistory";
import Sale from "../models/Sales";
import DailyReport from "../models/DailyReport";
import SharedReportLink from "../models/SharedReportLink";
import Store from "../models/Store";
import OcrScan from "../models/OcrScan";
import { anchorReport, getAnchorsForHash } from "../services/blockchainAnchorService";
import { getStoreId } from "../utils/storeId";
import { getBusinessDate, safeNum, escapeRegex } from "../utils/helpers";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError } from "../utils/AppError";

/* =======================================================
UTILS (béton)
===================================================== */
function isISODate(s: any): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isISOMonth(s: any): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatMoney(n: number) {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function escapeHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPublicBaseUrl(req: Request) {
  const envUrl = process.env.PUBLIC_BASE_URL;
  if (envUrl && envUrl.startsWith("http")) return envUrl.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = req.get("host");
  return `${proto}://${host}`;
}

function monthToRange(month: string) {
  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const from = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function toMonthFromFromDate(from: string) {
  return String(from).slice(0, 7);
}

function safeFileName(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function computeDataHash(data: {
  revenue: number; cogs: number; grossProfit: number; netProfit: number;
  salesCount: number; marginPercent: number; from: string; to: string;
  rows: Array<{ date: string; revenue: number; cogs: number; profit: number; sales: number }>;
}): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/* =======================================================
PDF BUILDER (béton)
====================================================== */
function buildSharedReportPdf(params: {
  month: string;
  from: string;
  to: string;
  expiresAt: string;
  verifyUrl?: string;
  dataHash?: string;
  merchantName?: string;
  ownerName?: string;
  shopId?: string;
  kpis: {
    monthlyRevenue: number;
    monthlyCogs: number;
    monthlyGrossProfit: number;
    monthlyNetProfit: number;
    monthlySalesCount: number;
    monthlyMarginPercent: number;
  };
  rows: Array<{
    date: string;
    totalRevenue: number;
    cogs: number;
    netProfit: number;
    grossProfit: number;
    totalSales: number;
  }>;
}) {
  const { month, from, to, expiresAt, verifyUrl, dataHash, kpis, rows } = params;

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: {
      Title: `Bilan sécurisé ${month}`,
      Author: "Vocoshop",
      Subject: "Rapport financier officiel Vocoshop",
      Keywords: `vocoshop,bilan,${month},${from},${to}`,
    },
  });

  const pageW = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageW - doc.page.margins.right;

  const addFooter = (doc: any) => {
    const fy = doc.page.height - 30;
    doc.fontSize(7).fillColor("#999");
    doc.text("Vocoshop  Document officiel authentifié par empreinte numérique", left, fy, { width: pageW - left * 2, align: "center" });
    if (verifyUrl) {
      doc.fontSize(6).fillColor("#aaa");
      doc.text(`Vérification : ${verifyUrl}`, left, fy + 10, { width: pageW - left * 2, align: "center" });
    }
  };

  doc.fontSize(7).fillColor("#22c55e");
  doc.text("DOCUMENT OFFICIEL VOCOshop - Authentifie numeriquement", left, 25, { width: pageW - left * 2, align: "center" });
  doc.moveDown(0.3);

  if (params.merchantName) {
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#000").text(params.merchantName, left);
    doc.moveDown(0.2);
  }
  if (params.ownerName) {
    doc.fontSize(10).font("Helvetica").fillColor("#555").text(`Proprietaire : ${params.ownerName}`, left);
    doc.moveDown(0.1);
  }
  if (params.shopId) {
    doc.fontSize(8).font("Helvetica").fillColor("#888").text(`ID : ${params.shopId}`, left);
    doc.moveDown(0.3);
  }

  doc.fontSize(14).font("Helvetica-Bold").fillColor("#000").text("Bilan securise (lecture seule)", left);
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").fillColor("#333");
  doc.text(`Période : ${from} ? ${to}`, left);
  doc.text(`Mois : ${month}`, left);
  doc.text(`Expire le : ${String(expiresAt).slice(0, 10)}`, left);
  if (dataHash) {
    doc.fontSize(7).fillColor("#888");
    doc.text(`Empreinte : ${dataHash.slice(0, 20)}...`, left);
  }
  doc.moveDown(1);

  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#DDD").stroke();
  doc.moveDown(1);

  doc.fillColor("#000");
  doc.fontSize(12).font("Helvetica-Bold").text("Synthèse", left);
  doc.moveDown(0.5);

  const kpiLines = [
    ["Chiffre d'affaires", `${formatMoney(kpis.monthlyRevenue)} FCFA`],
    ["COGS (coût d'achat)", `${formatMoney(kpis.monthlyCogs)} FCFA`],
    ["Profit brut", `${formatMoney(kpis.monthlyGrossProfit)} FCFA`],
    ["Profit net", `${formatMoney(kpis.monthlyNetProfit)} FCFA`],
    ["Marge", `${Math.round(kpis.monthlyMarginPercent * 10) / 10}%`],
    ["Ventes", `${kpis.monthlySalesCount} tickets`],
  ];

  const labelW = 170;
  const valueX = left + labelW + 10;

  doc.font("Helvetica").fontSize(10);
  for (const [label, value] of kpiLines) {
    doc.fillColor("#444").text(String(label), left, doc.y, { width: labelW });
    doc.fillColor("#000").font("Helvetica-Bold").text(String(value), valueX, doc.y - 10);
    doc.font("Helvetica");
    doc.moveDown(0.4);
  }

  doc.moveDown(0.8);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#DDD").stroke();
  doc.moveDown(1);

  doc.fillColor("#000").font("Helvetica-Bold").fontSize(12).text("Détails par jour", left);
  doc.moveDown(0.6);

  const col = {
    date: left,
    ca: left + 90,
    cogs: left + 200,
    profit: left + 315,
    marge: left + 430,
    ventes: left + 510,
  };

  const headerY = doc.y;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#111");
  doc.text("Date", col.date, headerY);
  doc.text("CA", col.ca, headerY);
  doc.text("COGS", col.cogs, headerY);
  doc.text("Profit", col.profit, headerY);
  doc.text("Marge", col.marge, headerY);
  doc.text("Ventes", col.ventes, headerY);

  doc.moveDown(0.4);
  doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#EEE").stroke();
  doc.moveDown(0.4);

  doc.font("Helvetica").fontSize(9).fillColor("#222");

  for (const r of rows) {
    const y = doc.y;

    if (y > doc.page.height - 80) {
      doc.addPage();
      doc.fontSize(7).fillColor("#22c55e").text("? DOCUMENT OFFICIEL VOCOshop (suite)", left, 25, { width: pageW - left * 2, align: "center" });
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#000").text("Détails par jour (suite)", left, 40);
      doc.moveDown(0.8);

      const hy = doc.y;
      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Date", col.date, hy);
      doc.text("CA", col.ca, hy);
      doc.text("COGS", col.cogs, hy);
      doc.text("Profit", col.profit, hy);
      doc.text("Marge", col.marge, hy);
      doc.text("Ventes", col.ventes, hy);
      doc.moveDown(0.4);
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#EEE").stroke();
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(9);
    }

    const rev = safeNum(r.totalRevenue);
    const gp = safeNum(r.grossProfit);
    const margin = rev > 0 ? clamp((gp / rev) * 100, 0, 100) : 0;

    doc.text(String(r.date || "").slice(0, 10), col.date, doc.y);
    doc.text(formatMoney(rev), col.ca, y);
    doc.text(formatMoney(safeNum(r.cogs)), col.cogs, y);
    doc.text(formatMoney(safeNum(r.netProfit)), col.profit, y);
    doc.text(`${Math.round(margin * 10) / 10}%`, col.marge, y);
    doc.text(String(safeNum(r.totalSales)), col.ventes, y);

    doc.moveDown(0.55);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#F2F2F2").stroke();
    doc.moveDown(0.35);
  }

  addFooter(doc);

  doc.addPage();

  doc.fontSize(7).fillColor("#22c55e").text("? DOCUMENT OFFICIEL VOCOshop", left, 25, { width: pageW - left * 2, align: "center" });

  doc.fontSize(16).font("Helvetica-Bold").fillColor("#000").text("Vérification d'authenticité", left, 50);
  doc.moveDown(1);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  doc.text("Ce document est protégé par une empreinte numérique (SHA-256).", left);
  doc.text("Pour vérifier son intégrité, scannez le QR code ci-dessous", left);
  doc.text("ou rendez-vous sur le lien de vérification.", left);
  doc.moveDown(1);

  if (verifyUrl) {
    doc.fontSize(9).fillColor("#555").text("Lien de vérification :", left);
    doc.fontSize(8).fillColor("#22c55e").text(verifyUrl, left);

    try {
      doc.fontSize(8).fillColor("#333");
      doc.text("", left);
      const qrSvg = QRCode.toString(verifyUrl, { type: "svg", margin: 0, width: 200, color: { dark: "#000", light: "#fff" } }) as unknown as string;
      if (qrSvg && typeof qrSvg === "string") {
        doc.fontSize(6).fillColor("#999").text("(QR code disponible sur la version web)", left);
      }
    } catch {}
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  doc.fontSize(9).font("Helvetica").fillColor("#444");
  doc.text("Informations du document :", left);
  doc.fontSize(8).fillColor("#555");
  doc.text(`Période : ${from} ? ${to}`, left + 10);
  doc.text(`Mois : ${month}`, left + 10);
  doc.text(`Généré le : ${new Date().toISOString().slice(0, 10)}`, left + 10);
  doc.text(`Expire le : ${String(expiresAt).slice(0, 10)}`, left + 10);
  if (dataHash) {
    doc.text(`Empreinte SHA-256 : ${dataHash}`, left + 10);
  }
  doc.moveDown(0.5);

  doc.fontSize(7).fillColor("#888");
  doc.text("Vocoshop  Plateforme de gestion de boutiques agréée.", left);

  addFooter(doc);

  return doc;
}

/* =======================================================
1?? KPI (STOCK + VENTES mois si from/to)
GET /report/kpis?from=YYYY-MM-DD&to=YYYY-MM-DD
====================================================== */
export const getReportKpis = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const products = await Product.find({ storeId }).lean();

  let totalQuantity = 0;
  let totalStockValue = 0;
  let estimatedResellValue = 0;
  let totalPotentialProfit = 0;

  for (const p of products as any[]) {
    const qty = safeNum(p?.quantity);
    const buy = safeNum(p?.purchasePrice);
    const sell = safeNum(p?.sellPrice);
    totalQuantity += qty;
    totalStockValue += qty * buy;
    estimatedResellValue += qty * sell;
    totalPotentialProfit += qty * (sell - buy);
  }

  const from = (req.query as any)?.from;
  const to = (req.query as any)?.to;

  let monthlyRevenue = 0;
  let monthlySalesCount = 0;
  let monthlyCogs = 0;
  let monthlyGrossProfit = 0;
  let monthlyNetProfit = 0;
  let monthlyMarginPercent = 0;

  if (isISODate(from) && isISODate(to)) {
    const reports = await DailyReport.find({
      storeId,
      date: { $gte: from, $lte: to },
    }).lean();

    monthlyRevenue = (reports as any[]).reduce((sum, r) => sum + safeNum(r?.totalRevenue), 0);
    monthlySalesCount = (reports as any[]).reduce((sum, r) => sum + safeNum(r?.totalSales), 0);
    monthlyCogs = (reports as any[]).reduce((sum, r) => sum + safeNum(r?.cogs), 0);
    monthlyGrossProfit = (reports as any[]).reduce((sum, r) => {
      const v = r?.grossProfit ?? r?.netProfit ?? r?.totalProfit ?? r?.profitEstimated ?? 0;
      return sum + safeNum(v);
    }, 0);
    monthlyNetProfit = (reports as any[]).reduce((sum, r) => {
      const v = r?.netProfit ?? r?.grossProfit ?? r?.totalProfit ?? r?.profitEstimated ?? 0;
      return sum + safeNum(v);
    }, 0);
    monthlyMarginPercent = monthlyRevenue > 0 ? (monthlyGrossProfit / monthlyRevenue) * 100 : 0;
    monthlyMarginPercent = clamp(Number.isFinite(monthlyMarginPercent) ? monthlyMarginPercent : 0, 0, 100);
  }

  return res.json({
    totalProducts: products.length,
    totalQuantity,
    totalStockValue,
    estimatedResellValue,
    totalPotentialProfit,
    monthlyRevenue,
    monthlySalesCount,
    monthlyProfit: monthlyNetProfit,
    monthlyCogs,
    monthlyGrossProfit,
    monthlyNetProfit,
    monthlyMarginPercent,
  });
});

/* =======================================================
2?? INVENTORY DIFFS
GET /report/inventory-diffs
====================================================== */
export const getInventoryDiffs = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const history = await StockHistory.find({ storeId }).lean();

  if (!history.length) {
    return res.json({
      summary: { movementsCount: 0, gainsValue: 0, lossesValue: 0, netImpact: 0 },
      list: [],
    });
  }

  const productIds = Array.from(new Set((history as any[]).map((h) => h.productId).filter(Boolean)));
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select("_id name purchasePrice").lean()
    : [];

  const productMap: Record<string, { name: string; unitPrice: number }> = {};
  for (const p of products as any[]) {
    productMap[p._id.toString()] = { name: p.name, unitPrice: safeNum(p.purchasePrice) };
  }

  let gainsValue = 0;
  let lossesValue = 0;
  const list: any[] = [];

  for (const h of history as any[]) {
    const diff = safeNum(h.diff);
    const product = productMap[h.productId?.toString?.() ?? ""];
    const unitPrice = product?.unitPrice ?? 0;
    const totalValue = diff * unitPrice;

    if (totalValue > 0) gainsValue += totalValue;
    if (totalValue < 0) lossesValue += Math.abs(totalValue);

    list.push({
      productId: h.productId,
      productName: product?.name ?? "Produit inconnu",
      diff,
      unitPrice,
      totalValue,
      date: h.createdAt ?? h.appliedAt ?? null,
    });
  }

  return res.json({
    summary: {
      movementsCount: history.length,
      gainsValue,
      lossesValue,
      netImpact: gainsValue - lossesValue,
    },
    list,
  });
});

/* =======================================================
3?? AUJOURD'HUI  BILAN DU JOUR
GET /report/today
====================================================== */
export const getTodayReport = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const date = getBusinessDate();
  const report = await DailyReport.findOne({ storeId, date }).lean();

  if (!report) {
    return res.json({
      date,
      totalSales: 0,
      totalRevenue: 0,
      cogs: 0,
      grossProfit: 0,
      netProfit: 0,
      marginPercent: 0,
      sales: [],
    });
  }

  const totalRevenue = safeNum((report as any)?.totalRevenue);
  const grossProfit = safeNum((report as any)?.grossProfit);
  const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return res.json({
    ...(report as any),
    marginPercent: clamp(Number.isFinite(marginPercent) ? marginPercent : 0, 0, 100),
  });
});

/* =======================================================
4?? CLÔTURE DE JOURNÉE (Sale -> DailyReport)  PROFIT RÉEL
POST /report/close-day
====================================================== */
export const closeDayReport = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const date = getBusinessDate();

  const sales = await Sale.find({ storeId, businessDate: date }).lean();
  const totalRevenue = (sales as any[]).reduce((sum, s) => sum + safeNum(s?.totalAmount), 0);

  const productIds = Array.from(
    new Set((sales as any[]).map((s) => (s?.productId ? String(s.productId) : null)).filter(Boolean))
  );

  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds } }).select("_id purchasePrice name").lean()
    : [];

  const productBuyMap = new Map<string, number>();
  const productNameMap = new Map<string, string>();
  for (const p of products as any[]) {
    productBuyMap.set(String(p._id), safeNum(p.purchasePrice));
    productNameMap.set(String(p._id), String(p.name ?? ""));
  }

  let cogs = 0;
  let grossProfit = 0;

  const lines = (sales as any[]).map((s) => {
    const qty = safeNum(s?.quantity);
    const unitPrice = safeNum(s?.unitPrice);
    const totalAmount = safeNum(s?.totalAmount);
    const productId = s?.productId ? String(s.productId) : null;

    const purchasePrice =
      safeNum((s as any)?.purchasePriceAtSale) ||
      safeNum((s as any)?.purchasePrice) ||
      (productId ? productBuyMap.get(productId) ?? 0 : 0);

    const lineCogs = purchasePrice * qty;
    const lineProfit = (unitPrice - purchasePrice) * qty;

    cogs += lineCogs;
    grossProfit += lineProfit;

    return {
      productId: productId ?? undefined,
      productName:
        String(s?.productName ?? "") || (productId ? productNameMap.get(productId) ?? "Produit" : "Produit"),
      quantity: qty,
      unitPrice,
      purchasePrice,
      totalAmount,
      lineProfit,
    };
  });

  const netProfit = grossProfit;

  const report = await DailyReport.findOneAndUpdate(
    { storeId, date },
    {
      storeId,
      date,
      totalSales: (sales as any[]).length,
      totalRevenue,
      cogs,
      grossProfit,
      netProfit,
      sales: lines,
    },
    { upsert: true, new: true }
  ).lean();

  return res.json(report);
});

/* =======================================================
5?? HISTORIQUE DES BILANS
GET /report/history?from=YYYY-MM-DD&to=YYYY-MM-DD
====================================================== */
export const getReportHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const from = (req.query as any)?.from;
  const to = (req.query as any)?.to;

  const filter: any = { storeId };
  if (isISODate(from) && isISODate(to)) filter.date = { $gte: from, $lte: to };

  const reports = await DailyReport.find(filter).sort({ date: 1 }).lean();

  const out = (reports as any[]).map((r) => {
    const rev = safeNum(r?.totalRevenue);
    const gp = safeNum(r?.grossProfit);
    const marginPercent = rev > 0 ? (gp / rev) * 100 : 0;
    return { ...r, marginPercent: clamp(Number.isFinite(marginPercent) ? marginPercent : 0, 0, 100) };
  });

  return res.json(out);
});

/* =======================================================
6?? PARTAGE  CRÉER LIEN (privé)
POST /report/share/month
====================================================== */
export const createMonthlyShareLink = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const { month, from, to, expiresInDays } = (req.body || {}) as {
    month?: string;
    from?: string;
    to?: string;
    expiresInDays?: number;
  };

  let finalMonth: string;
  let rangeFrom: string;
  let rangeTo: string;

  if (isISOMonth(month)) {
    finalMonth = month;
    const r = monthToRange(month);
    rangeFrom = r.from;
    rangeTo = r.to;
  } else if (isISODate(from) && isISODate(to)) {
    finalMonth = toMonthFromFromDate(from);
    rangeFrom = from;
    rangeTo = to;
  } else {
    return next(new ValidationError("Paramètres invalides. Utilise month (YYYY-MM) ou from/to (YYYY-MM-DD)."));
  }

  const days = clamp(safeNum(expiresInDays ?? 30), 1, 180);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const reports = await DailyReport.find({
    storeId,
    date: { $gte: rangeFrom, $lte: rangeTo },
  }).sort({ date: 1 }).lean();

  const monthlyRevenue = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalRevenue), 0);
  const monthlyCogs = (reports as any[]).reduce((s, r) => s + safeNum(r?.cogs), 0);
  const monthlyGrossProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.grossProfit), 0);
  const monthlyNetProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.netProfit), 0);
  const monthlySalesCount = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalSales), 0);
  const monthlyMarginPercent = monthlyRevenue > 0 ? clamp((monthlyGrossProfit / monthlyRevenue) * 100, 0, 100) : 0;

  const dataRows = (reports as any[]).map(r => ({
    date: String(r.date || "").slice(0, 10),
    revenue: safeNum(r?.totalRevenue),
    cogs: safeNum(r?.cogs),
    profit: safeNum(r?.netProfit || r?.grossProfit),
    sales: safeNum(r?.totalSales),
  }));

  const dataHash = computeDataHash({
    revenue: monthlyRevenue, cogs: monthlyCogs,
    grossProfit: monthlyGrossProfit, netProfit: monthlyNetProfit,
    salesCount: monthlySalesCount, marginPercent: monthlyMarginPercent,
    from: rangeFrom, to: rangeTo, rows: dataRows,
  });

  const token = crypto.randomBytes(32).toString("hex");

  await SharedReportLink.updateMany({ storeId, month: finalMonth, isActive: true }, { $set: { isActive: false } });

  const storeName = String((reports as any[])[0]?.storeName || req.body?.storeName || "Boutique").trim();

  const link = await SharedReportLink.create({
    storeId,
    month: finalMonth,
    token,
    isActive: true,
    expiresAt,
    dataHash,
    storeName,
  });

  let blockchainProof: any = null;
  try {
    blockchainProof = await anchorReport({ dataHash, storeId, month: finalMonth });
  } catch (e) {
    console.error("blockchain anchor non-bloquant:", e);
  }

  const base = getPublicBaseUrl(req);
  const url = `${base}/api/public/report/share/${token}`;
  const verifyUrl = `${base}/api/public/report/verify/${token}`;

  return res.json({
    linkId: link._id,
    month: finalMonth,
    from: rangeFrom,
    to: rangeTo,
    url,
    verifyUrl,
    expiresAt,
    dataHash,
    blockchainProof: blockchainProof ? {
      type: blockchainProof.type,
      chainHash: blockchainProof.chainHash,
      explorerUrl: blockchainProof.explorerUrl,
      chainLabel: blockchainProof.chainLabel,
    } : null,
  });
});

/* =======================================================
7?? PARTAGE  DASHBOARD COMPLÈTE POUR MICROFINANCE
GET /api/public/report/share/:id
GET /api/public/report/share/:id?month=YYYY-MM
====================================================== */
export const viewSharedReport = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.id || "").trim();
    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).send("Lien invalide.");

    const link: any = await SharedReportLink.findOne({ token, isActive: true, expiresAt: { $gt: new Date() } }).lean();
    if (!link) return res.status(404).send("Lien invalide ou expire.");

    const storeId = String(link.storeId || "").trim();
    const defaultMonth = String(link.month || "").trim();
    if (!storeId) return res.status(404).send("Lien invalide.");

    const queryMonth = req.query.month as string | undefined;
    const compareMonth = req.query.compare as string | undefined;
    const customFrom = req.query.from as string | undefined;
    const customTo = req.query.to as string | undefined;

    let from: string, to: string;
    if (customFrom && customTo && isISODate(customFrom) && isISODate(customTo)) {
      from = customFrom; to = customTo;
    } else if (queryMonth === "all") {
      from = "2000-01-01"; to = "2099-12-31";
    } else {
      const base = (isISOMonth(queryMonth) ? queryMonth : defaultMonth) as string;
      if (!base) return res.status(404).send("Lien invalide.");
      try { const r = monthToRange(base); from = r.from; to = r.to; } catch { return res.status(404).send("Lien invalide."); }
    }
    const selectedMonth = queryMonth || defaultMonth;

    await SharedReportLink.updateOne({ _id: link._id }, { $inc: { viewsCount: 1 }, $set: { lastViewedAt: new Date() } }).catch(() => {});

    const now = new Date();
    const [store, reports, products] = await Promise.all([
      Store.findById(storeId).lean(),
      DailyReport.find({ storeId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(),
      Product.find({ storeId }).sort({ quantity: -1 }).limit(20).lean(),
    ]);

    let compareReports: any[] = [];
    let compareRevenue = 0, compareProfit = 0;
    if (compareMonth && isISOMonth(compareMonth)) {
      try {
        const cr = monthToRange(compareMonth);
        compareReports = await DailyReport.find({ storeId, date: { $gte: cr.from, $lte: cr.to } }).sort({ date: 1 }).lean();
        compareRevenue = (compareReports as any[]).reduce((s, r) => s + safeNum(r?.totalRevenue), 0);
        compareProfit = (compareReports as any[]).reduce((s, r) => s + safeNum(r?.grossProfit), 0);
      } catch {}
    }

    const merchantName = escapeHtml(String((store as any)?.storeName || link.storeName || "Commerce"));
    const ownerName = escapeHtml(String((store as any)?.ownerName || ""));
    const merchantCity = escapeHtml(String((store as any)?.city || ""));
    const merchantPhone = escapeHtml(String((store as any)?.phone || ""));
    const shopId = escapeHtml(String((store as any)?.shopId || storeId));
    const createdAtStr = (store as any)?.createdAt
      ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date((store as any).createdAt))
      : "N/A";

    const monthlyRevenue = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalRevenue), 0);
    const monthlyCogs = (reports as any[]).reduce((s, r) => s + safeNum(r?.cogs), 0);
    const monthlyGrossProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.grossProfit), 0);
    const monthlyNetProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.netProfit), 0);
    const monthlySalesCount = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalSales), 0);
    const monthlyMarginPercent = monthlyRevenue > 0 ? clamp((monthlyGrossProfit / monthlyRevenue) * 100, 0, 100) : 0;
    const stockValue = (products as any[]).reduce((s, p) => s + safeNum(p?.quantity) * safeNum(p?.sellPrice), 0);
    const estimatedResellValue = (products as any[]).reduce((s, p) => s + safeNum(p?.quantity) * safeNum(p?.sellPrice), 0);
    const totalPotentialProfit = (products as any[]).reduce((s, p) => s + safeNum(p?.quantity) * (safeNum(p?.sellPrice) - safeNum(p?.purchasePrice)), 0);

    const revEvol = compareRevenue > 0 ? (((monthlyRevenue - compareRevenue) / compareRevenue) * 100).toFixed(1) : null;
    const profitEvol = compareProfit > 0 ? (((monthlyGrossProfit - compareProfit) / compareProfit) * 100).toFixed(1) : null;

    const [totalSalesCount, totalProductsCount] = await Promise.all([
      Sale.countDocuments({ storeId }), Product.countDocuments({ storeId }),
    ]);
    const monthsActive = Math.max(0, Math.floor((now.getTime() - new Date((store as any)?.createdAt || now).getTime()) / (30 * 24 * 60 * 60 * 1000)));
    const totalScore = Math.min(100, Math.max(0, Math.round((totalSalesCount > 10 ? 30 : totalSalesCount > 0 ? 15 : 0) + (totalProductsCount >= 5 ? 20 : 5) + Math.min(20, monthsActive * 2) + 25)));
    const scoreColor = totalScore >= 70 ? "#22c55e" : totalScore >= 40 ? "#eab308" : "#ef4444";
    const scoreLabel = totalScore >= 70 ? "Excellent" : totalScore >= 50 ? "Bon" : totalScore >= 30 ? "Moyen" : "Faible";

    const availableMonthsRaw = await DailyReport.distinct("date", { storeId });
    const availableMonthsSet = new Set<string>();
    (availableMonthsRaw as string[]).forEach(d => { if (d) availableMonthsSet.add(d.slice(0, 7)); });
    const availableMonths = Array.from(availableMonthsSet).sort().reverse();

    const MONTH_NAMES = ["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];
    const periodLabel = queryMonth === "all" ? "Toute la periode" : (customFrom && customTo) ? `${new Date(customFrom).toLocaleDateString("fr")} - ${new Date(customTo).toLocaleDateString("fr")}` : `${MONTH_NAMES[parseInt((selectedMonth || defaultMonth).slice(5,7))-1]} ${(selectedMonth || defaultMonth).slice(0,4)}`;

    const fmtCFA = (v: number) => formatMoney(v) + " FCFA";

    let qrDataUri = "";
    try {
      const qr = await QRCode.toDataURL(`https://vocoshop.onrender.com/api/public/report/verify/${token}`, { width: 160, margin: 2, color: { dark: "#A78BFA", light: "#0A0617" } });
      qrDataUri = qr;
    } catch {}

    const baseUrl = getPublicBaseUrl(req);
    const verifyUrl = `${baseUrl}/api/public/report/verify/${token}`;
    const pdfUrl = `${baseUrl}/api/public/report/share/${token}/pdf`;

    const monthsOptions = availableMonths.map(m => {
      const label = `${MONTH_NAMES[parseInt(m.slice(5,7))-1]} ${m.slice(0,4)}`;
      const sel = m === queryMonth || (!queryMonth && m === defaultMonth) ? "selected" : "";
      return `<option value="${m}" ${sel}>${label}</option>`;
    }).join("");

    const compareOptions = availableMonths.map(m => {
      const label = `${MONTH_NAMES[parseInt(m.slice(5,7))-1]} ${m.slice(0,4)}`;
      const sel = m === compareMonth ? "selected" : "";
      return `<option value="${m}" ${sel}>${label}</option>`;
    }).join("");

    const chartLabels = (reports as any[]).map(r => r.date?.slice(8,10) || "");
    const chartRevenue = (reports as any[]).map(r => safeNum(r?.totalRevenue));
    const chartProfit = (reports as any[]).map(r => safeNum(r?.grossProfit));
    const chartCompareRevenue = (compareReports as any[]).map(r => safeNum(r?.totalRevenue));

    const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
    (reports as any[]).forEach(r => {
      (r.sales || []).forEach((s: any) => {
        const key = s.productName || "Inconnu";
        const prev = productSales.get(key) || { name: key, qty: 0, revenue: 0 };
        prev.qty += safeNum(s?.quantity);
        prev.revenue += safeNum(s?.totalAmount);
        productSales.set(key, prev);
      });
    });
    const topProducts = Array.from(productSales.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const stockItems = (products as any[]).filter(p => safeNum(p?.quantity) > 0).slice(0, 10);
    const stockLabels = stockItems.map(p => escapeHtml(String((p as any)?.name || "").slice(0,15)).replace(/"/g, ""));

    const kpi = (label: string, value: number | string, color: string, icon: string, evol: string | null = null) =>
      `<div class="kpi-card"><div class="kpi-icon">${icon}</div><div class="kpi-label">${label}</div><div class="kpi-value" style="color:${color}">${typeof value === 'number' ? fmtCFA(value) : value}</div>${evol ? '<div class="kpi-evol ' + (parseFloat(evol) >= 0 ? 'up' : 'down') + '">' + evol + '%</div>' : ''}</div>`;

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${merchantName} - Rapport VocoShop</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0A0617;color:#E8E4F0;line-height:1.5}
.wrap{max-width:1200px;margin:0 auto;padding:24px 20px}
.top-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.brand{font-size:14px;font-weight:800;color:#A78BFA;letter-spacing:1.5px}
.brand span{color:#fff}
.expires{font-size:11px;color:#6B7280;background:rgba(255,255,255,.03);padding:5px 12px;border-radius:8px}
.store-card{background:linear-gradient(135deg,#18122B 0%,#1E1638 100%);border:1px solid rgba(167,139,250,.15);border-radius:16px;padding:24px;margin-bottom:20px}
.store-header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px}
.store-info h1{font-size:24px;font-weight:900;color:#fff;margin-bottom:4px}
.store-info .owner{font-size:14px;color:#A78BFA;margin-bottom:2px}
.store-info .meta{font-size:12px;color:#6B7280;margin-top:6px;display:flex;gap:16px;flex-wrap:wrap}
.verified-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25);padding:8px 14px;border-radius:20px;font-size:12px;font-weight:700;color:#22c55e}
.score-box{display:flex;flex-direction:column;align-items:center}
.score-ring{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;border:3px solid ${scoreColor};color:#fff}
.score-sub{font-size:10px;color:#6B7280;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
.period-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;background:#18122B;border-radius:14px;padding:12px 16px;border:1px solid rgba(255,255,255,.05)}
.period-bar select{background:#1E1638;border:1px solid rgba(255,255,255,.1);color:#E8E4F0;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;min-width:140px}
.period-bar select:focus{outline:2px solid #A78BFA}
.quick-filters{display:flex;gap:6px;flex-wrap:wrap}
.qf-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#A8A3C2;padding:6px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s;text-decoration:none}
.qf-btn:hover,.qf-btn.active{background:rgba(167,139,250,.15);color:#A78BFA;border-color:rgba(167,139,250,.3)}
.qf-btn.active{background:rgba(167,139,250,.2)}
.nav-arrows{display:flex;gap:4px;margin-left:auto}
.nav-arrows button{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#A8A3C2;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.nav-arrows button:hover{background:rgba(167,139,250,.15);color:#A78BFA}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.kpi-card{background:#18122B;border-radius:14px;padding:18px;border:1px solid rgba(255,255,255,.05);transition:transform .2s}
.kpi-card:hover{transform:translateY(-2px)}
.kpi-icon{font-size:24px;margin-bottom:8px}
.kpi-label{font-size:11px;font-weight:700;color:#8B83A8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.kpi-value{font-size:20px;font-weight:900}
.kpi-evol{font-size:11px;font-weight:700;margin-top:4px}
.kpi-evol.up{color:#22c55e}
.kpi-evol.down{color:#ef4444}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
@media(max-width:768px){.chart-row{grid-template-columns:1fr}}
.chart-card{background:#18122B;border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,.05)}
.chart-title{font-size:14px;font-weight:800;color:#fff;margin-bottom:12px}
.chart-wrap{position:relative;height:280px}
.chart-wrap canvas{width:100%!important}
.table-card{background:#18122B;border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,.05);margin-bottom:20px;overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:10px 12px;font-size:11px;font-weight:700;color:#8B83A8;border-bottom:1px solid rgba(255,255,255,.08);text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
td{padding:10px 12px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.04);white-space:nowrap}
tr:hover td{background:rgba(255,255,255,.01)}
.text-right{text-align:right}
.text-green{color:#22c55e}
.text-gold{color:#F59E0B}
.export-bar{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;transition:all .2s;border:none;text-decoration:none}
.btn-primary{background:#7C3AED;color:#fff}
.btn-primary:hover{background:#6D28D9}
.btn-outline{background:transparent;border:1px solid rgba(255,255,255,.15);color:#CFC7E8}
.btn-outline:hover{background:rgba(255,255,255,.06)}
.qr-section{display:flex;align-items:center;gap:20px;background:#18122B;border-radius:14px;padding:20px;border:1px solid rgba(255,255,255,.05);margin-bottom:20px;flex-wrap:wrap}
.qr-section img{border-radius:10px;background:#fff;padding:8px}
.qr-info{flex:1;min-width:200px}
.qr-info h3{font-size:14px;font-weight:800;color:#fff;margin-bottom:6px}
.qr-info p{font-size:12px;color:#6B7280}
.compare-row{display:flex;align-items:center;gap:8px;margin-top:8px}
.compare-row select{background:#1E1638;border:1px solid rgba(255,255,255,.1);color:#E8E4F0;padding:6px 10px;border-radius:8px;font-size:12px}
.footer{text-align:center;padding:24px 0;color:#4A4464;font-size:11px;border-top:1px solid rgba(255,255,255,.04);margin-top:30px}
@media print{.period-bar,.export-bar,.nav-arrows,.btn,.qf-btn{display:none!important}body{background:#fff;color:#000}.store-card,.chart-card,.table-card,.kpi-card{background:#fff;border:1px solid #ddd;break-inside:avoid}}
</style>
</head>
<body>
<div class="wrap">
<div class="top-bar">
  <div class="brand"><span>VOCO</span>SHOP</div>
  <div class="expires">Lien securise · Expire le ${new Date(link.expiresAt).toLocaleDateString("fr")}</div>
</div>
<div class="store-card">
  <div class="store-header">
    <div class="store-info">
      <h1>${merchantName}</h1>
      ${ownerName ? '<div class="owner">' + ownerName + '</div>' : ''}
      <div class="meta">
        <span>${merchantCity || 'N/A'}</span>
        <span>${merchantPhone}</span>
        <span>${shopId}</span>
        <span>Cree le ${createdAtStr}</span>
      </div>
    </div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div class="verified-badge">Donnees verifiees par VocoShop</div>
      <div class="score-box">
        <div class="score-ring">${totalScore}</div>
        <div class="score-sub">${scoreLabel}</div>
      </div>
    </div>
  </div>
</div>
<div class="export-bar">
  <button class="btn btn-primary" onclick="window.print()">Imprimer</button>
  <a class="btn btn-outline" href="${pdfUrl}" download>PDF</a>
  <button class="btn btn-outline" onclick="downloadCSV()">Excel (CSV)</button>
</div>
<div class="period-bar">
  <select id="monthSelect" onchange="navigateMonth(this.value)">
    <option value="all" ${queryMonth === 'all' ? 'selected' : ''}>Toute la periode</option>
    ${monthsOptions}
  </select>
  <div class="nav-arrows">
    <button onclick="prevMonth()" title="Mois precedent">&#9664;</button>
    <button onclick="nextMonth()" title="Mois suivant">&#9654;</button>
  </div>
  <div class="quick-filters">
    <a class="qf-btn${!queryMonth || queryMonth === defaultMonth && !compareMonth ? ' active' : ''}" href="?month=${defaultMonth || ''}">Ce mois</a>
    <a class="qf-btn${queryMonth === 'all' && !customFrom ? ' active' : ''}" href="?month=all">Tout</a>
    <a class="qf-btn" href="#" onclick="setRange('3m');return false">3 mois</a>
    <a class="qf-btn" href="#" onclick="setRange('6m');return false">6 mois</a>
    <a class="qf-btn" href="#" onclick="setRange('12m');return false">12 mois</a>
  </div>
  <div class="compare-row">
    <span style="font-size:12px;color:#6B7280;">Comparer avec</span>
    <select id="compareSelect" onchange="navigateCompare(this.value)">
      <option value="">Aucune</option>
      ${compareOptions}
    </select>
    ${compareMonth ? '<a class="qf-btn" href="?month='+(queryMonth||defaultMonth)+'" style="color:#ef4444">x</a>' : ''}
  </div>
</div>
<div style="margin-bottom:12px;color:#A78BFA;font-size:13px;font-weight:700">${periodLabel}${compareMonth ? ' vs ' + MONTH_NAMES[parseInt(compareMonth.slice(5,7))-1] + ' ' + compareMonth.slice(0,4) : ''}</div>
<div class="kpi-grid">
  ${kpi("Chiffre d'affaires", monthlyRevenue, "#F59E0B", "CA", revEvol)}
  ${kpi("Benefice brut", monthlyGrossProfit, "#22c55e", "Benef.", profitEvol)}
  ${kpi("Depenses (COGS)", monthlyCogs, "#ef4444", "Dep.")}
  ${kpi("Valeur du stock", stockValue, "#3B82F6", "Stock")}
  ${kpi("Marge", monthlyMarginPercent.toFixed(1) + "%", "#A78BFA", "Marge")}
  ${kpi("Nb ventes", String(monthlySalesCount), "#fff", "Ventes")}
</div>

<div style="margin-bottom:12px;color:#A78BFA;font-size:13px;font-weight:700">Vue d'ensemble de la boutique</div>
<div class="kpi-grid">
  ${kpi("Valeur estimee boutique", estimatedResellValue, "#F59E0B", "Boutique")}
  ${kpi("Benefice estime", totalPotentialProfit, "#22c55e", "Potentiel")}
  ${kpi("Produits en stock", String((products as any[]).reduce((s, p) => s + safeNum(p?.quantity), 0)), "#3B82F6", "Total stock")}
  ${kpi("References produits", String(totalProductsCount), "#A78BFA", "References")}
</div>
<div class="chart-row">
  <div class="chart-card">
    <div class="chart-title">Evolution du CA</div>
    <div class="chart-wrap"><canvas id="revenueChart"></canvas></div>
  </div>
  <div class="chart-card">
    <div class="chart-title">Top produits (CA)</div>
    <div class="chart-wrap"><canvas id="productsChart"></canvas></div>
  </div>
</div>
${topProducts.length > 0 ? '<div class="table-card"><div class="chart-title" style="margin-bottom:12px">Produits les plus vendus</div><table><tr><th>Produit</th><th class="text-right">Qte</th><th class="text-right">CA</th></tr>' + topProducts.map(p => '<tr><td>' + escapeHtml(p.name) + '</td><td class="text-right">' + p.qty + '</td><td class="text-right text-gold">' + fmtCFA(p.revenue) + '</td></tr>').join("") + '</table></div>' : ''}
${stockItems.length > 0 ? '<div class="chart-card" style="margin-bottom:20px"><div class="chart-title">Etat du stock</div><div class="chart-wrap"><canvas id="stockChart"></canvas></div></div>' : ''}
<div class="qr-section">
  ${qrDataUri ? '<img src="' + qrDataUri + '" width="100" height="100" alt="QR Code">' : ''}
  <div class="qr-info">
    <h3>Verification d'authenticite</h3>
    <p>Ce rapport est signe numeriquement par VocoShop. Scannez le QR code pour confirmer son authenticite.</p>
    <p style="margin-top:8px"><a href="${verifyUrl}" target="_blank" style="color:#A78BFA">${verifyUrl}</a></p>
    <p style="margin-top:4px;color:#4B5563;font-size:10px">Rapport genere le ${now.toLocaleDateString("fr")} · ID: ${token.slice(0,16)}...</p>
  </div>
</div>
<div class="footer">
  VocoShop — Vendez. Gerer. Grandissez.<br>
  Rapport genere automatiquement. Inalterable sur le serveur.
</div>
</div>
<script>
const currentMonth = "${queryMonth || defaultMonth}";
const availMonths = ${JSON.stringify(availableMonths)};
function setPeriod(m) {
  let u = new URL(window.location);
  if(m==='all'){u.searchParams.set('month','all')}else{u.searchParams.set('month',m)}
  u.searchParams.delete('from');u.searchParams.delete('to');
  window.location=u.toString();
}
function setRange(r) {
  let u = new URL(window.location);
  const n = new Date();
  let from, to;
  if(r==='3m'){const d=new Date(n.getFullYear(),n.getMonth()-2,1);from=d.toISOString().slice(0,10);to=n.toISOString().slice(0,10)}
  else if(r==='6m'){const d=new Date(n.getFullYear(),n.getMonth()-5,1);from=d.toISOString().slice(0,10);to=n.toISOString().slice(0,10)}
  else if(r==='12m'){const d=new Date(n.getFullYear(),n.getMonth()-11,1);from=d.toISOString().slice(0,10);to=n.toISOString().slice(0,10)}
  u.searchParams.set('from',from);u.searchParams.set('to',to);u.searchParams.delete('month');
  window.location=u.toString();
}
function prevMonth(){const i=availMonths.indexOf(currentMonth);if(i>=0&&i<availMonths.length-1)setPeriod(availMonths[i+1])}
function nextMonth(){const i=availMonths.indexOf(currentMonth);if(i>0)setPeriod(availMonths[i-1])}
function navigateMonth(m){setPeriod(m)}
function navigateCompare(m){
  let u=new URL(window.location);
  if(m)u.searchParams.set('compare',m);else u.searchParams.delete('compare');
  window.location=u.toString();
}
function downloadCSV(){
  const rows=[];
  rows.push(["Boutique","${merchantName.replace(/"/g,'""')}"]);
  ${ownerName ? `rows.push(["Proprietaire","${ownerName.replace(/"/g,'""')}"]);` : ''}
  rows.push(["ID","${shopId.replace(/"/g,'""')}"]);
  rows.push(["Periode","${periodLabel.replace(/"/g,'""')}"]);
  rows.push(["Genere le","${now.toLocaleDateString('fr')}"]);
  rows.push([]);
  rows.push(["Date","CA (FCFA)","Benefice (FCFA)","COGS (FCFA)","Ventes"]);
  ${JSON.stringify((reports as any[]).map(r => [r.date?.slice(0,10)||"", safeNum(r?.totalRevenue), safeNum(r?.grossProfit), safeNum(r?.cogs), safeNum(r?.totalSales)]))}.forEach(r=>rows.push(r));
  rows.push([]);
  rows.push(["CA total","${merchantName.replace(/"/g,'""')}","","","Total"]);
  rows.push(["","","","","${monthlyRevenue}"]);
  let csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(",")).join("\\n");
  const blob=new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download="bilan_${merchantName.replace(/[^a-zA-Z0-9]/g,'_')}_${(selectedMonth || defaultMonth).replace(/\s/g,'_')}.csv";a.click();
}
document.addEventListener('DOMContentLoaded',function(){
  Chart.defaults.color='#8B83A8';Chart.defaults.borderColor='rgba(255,255,255,.05)';
  new Chart(document.getElementById('revenueChart'),{
    type:'line',
    data:{
      labels:${JSON.stringify(chartLabels)},
      datasets:[
        {label:'CA ${periodLabel}',data:${JSON.stringify(chartRevenue)},borderColor:'#F59E0B',backgroundColor:'rgba(245,158,11,.1)',fill:true,tension:.3},
        {label:'Benefice',data:${JSON.stringify(chartProfit)},borderColor:'#22c55e',backgroundColor:'rgba(34,197,94,.1)',fill:true,tension:.3}${compareReports.length > 0 ? ',{label:"CA '+MONTH_NAMES[parseInt(compareMonth!.slice(5,7))-1]+'",data:'+JSON.stringify(chartCompareRevenue)+',borderColor:"#A78BFA",borderDash:[5,5],tension:.3}' : ''}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:11}}}},scales:{y:{ticks:{callback:v=>(v/1000).toFixed(0)+'k'}}}}
  });
  new Chart(document.getElementById('productsChart'),{
    type:'bar',
    data:{labels:${JSON.stringify(topProducts.map(p=>p.name.slice(0,15)))},datasets:[{label:'CA (FCFA)',data:${JSON.stringify(topProducts.map(p=>p.revenue))},backgroundColor:'#A78BFA',borderRadius:6}]},
    options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>(v/1000).toFixed(0)+'k'}}}}
  });
  ${stockItems.length > 0 ? 'new Chart(document.getElementById("stockChart"),{type:"bar",data:{labels:' + JSON.stringify(stockLabels) + ',datasets:[{label:"Qte en stock",data:' + JSON.stringify(stockItems.map(p=>safeNum(p?.quantity))) + ',backgroundColor:"#3B82F6",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});' : ''}
});
<\/script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    return res.status(200).send(html);
  } catch (err) {
    console.error("viewSharedReport:", err);
    return res.status(500).send("Erreur serveur.");
  }
};

export const downloadSharedReportPdf = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.id || "").trim();

    if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).send("Lien invalide.");

    const link: any = await SharedReportLink.findOne({
      token,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!link) return res.status(404).send("Lien invalide ou expiré.");

    const storeId = String(link.storeId || "").trim();
    const month = String(link.month || "").trim();
    if (!storeId || !month) return res.status(404).send("Lien invalide.");

    const store = await Store.findById(storeId).select("storeName ownerName").lean();
    const merchantName = String((store as any)?.storeName || link.storeName || "");
    const ownerName = String((store as any)?.ownerName || "");

    let from: string;
    let to: string;
    try {
      const r = monthToRange(month);
      from = r.from;
      to = r.to;
    } catch {
      return res.status(404).send("Lien invalide.");
    }

    try {
      await SharedReportLink.updateOne(
        { _id: link._id },
        { $inc: { downloadsCount: 1 }, $set: { lastDownloadedAt: new Date() } }
      );
    } catch {}

    const reports = await DailyReport.find({
      storeId,
      date: { $gte: from, $lte: to },
    })
      .sort({ date: 1 })
      .lean();

    const monthlyRevenue = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalRevenue), 0);
    const monthlyCogs = (reports as any[]).reduce((s, r) => s + safeNum(r?.cogs), 0);
    const monthlyGrossProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.grossProfit), 0);
    const monthlyNetProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.netProfit), 0);
    const monthlySalesCount = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalSales), 0);

    const monthlyMarginPercent =
      monthlyRevenue > 0 ? clamp((monthlyGrossProfit / monthlyRevenue) * 100, 0, 100) : 0;

    const rows = (reports as any[]).map((r) => ({
      date: String(r?.date || "").slice(0, 10),
      totalRevenue: safeNum(r?.totalRevenue),
      cogs: safeNum(r?.cogs),
      grossProfit: safeNum(r?.grossProfit),
      netProfit: safeNum(r?.netProfit),
      totalSales: safeNum(r?.totalSales),
    }));

    const fileName = safeFileName(`vocoshop_bilan_${month}_${from}_au_${to}`) || `vocoshop_bilan_${month}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const base = getPublicBaseUrl(req);
    const verifyUrl = `${base}/api/public/report/verify/${encodeURIComponent(token)}`;

    const doc = buildSharedReportPdf({
      month,
      from,
      to,
      expiresAt: String(link.expiresAt || ""),
      verifyUrl,
      dataHash: String(link.dataHash || ""),
      merchantName,
      ownerName,
      shopId: storeId,
      kpis: {
        monthlyRevenue,
        monthlyCogs,
        monthlyGrossProfit,
        monthlyNetProfit,
        monthlySalesCount,
        monthlyMarginPercent,
      },
      rows,
    });

    doc.pipe(res);
    doc.end();
  } catch (err) {
    console.error("? downloadSharedReportPdf:", err);
    return res.status(500).send("Erreur serveur.");
  }
};

/* =======================================================
8?? VÉRIFICATION D'AUTHENTICITÉ (PUBLIC)
GET /api/public/report/verify/:token
====================================================== */
export const verifySharedReport = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = String(req.params.id || "").trim();

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(200).json({ valid: false, error: "Token invalide." });
  }

  const link: any = await SharedReportLink.findOne({ token }).lean();

  if (!link) {
    return res.status(200).json({ valid: false, error: "Lien introuvable ou supprimé." });
  }

  const expired = new Date(link.expiresAt) < new Date();
  const active = link.isActive === true && !expired;

  let blockchainAnchor = null;
  try {
    const anchors = await getAnchorsForHash(link.dataHash || "");
    if (anchors.length > 0) {
      blockchainAnchor = {
        type: anchors[0].anchorType,
        chainHash: anchors[0].dataHash,
        previousHash: anchors[0].previousHash,
        txHash: anchors[0].txHash,
        blockNumber: anchors[0].blockNumber,
        chainId: anchors[0].chainId,
        explorerUrl: anchors[0].explorerUrl,
        anchoredAt: anchors[0].createdAt,
      };
    }
  } catch {}

  const verification = {
    valid: active,
    token,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    isActive: link.isActive,
    isExpired: expired,
    storeName: link.storeName || "",
    month: link.month,
    dataHash: link.dataHash || "",
    viewsCount: link.viewsCount || 0,
    downloadsCount: link.downloadsCount || 0,
    lastViewedAt: link.lastViewedAt || null,
    lastDownloadedAt: link.lastDownloadedAt || null,
    blockchainAnchor,
  };

  if (!active) {
    return res.status(200).json({
      ...verification,
      error: expired ? "Ce lien a expiré." : "Ce lien a été révoqué par le propriétaire.",
    });
  }

  return res.status(200).json(verification);
});

/* =======================================================
9?? PARTAGE  RÉVOQUER (privé)
POST /report/share/:id/revoke
====================================================== */
export const revokeShareLink = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const { id } = req.params;

  const link = await SharedReportLink.findOneAndUpdate(
    { _id: id, storeId },
    { $set: { isActive: false } },
    { new: true }
  ).lean();

  if (!link) return next(new NotFoundError("Lien introuvable"));

  return res.json({ message: "Lien révoqué", linkId: id });
});
