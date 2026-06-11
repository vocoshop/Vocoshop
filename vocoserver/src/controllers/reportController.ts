// controllers/reportController.ts
import { Request, Response } from "express";
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
======================================================= */
function buildSharedReportPdf(params: {
  month: string;
  from: string;
  to: string;
  expiresAt: string;
  verifyUrl?: string;
  dataHash?: string;
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

  const addFooter = (doc: PDFKit.PDFDocument) => {
    const fy = doc.page.height - 30;
    doc.fontSize(7).fillColor("#999");
    doc.text("Vocoshop — Document officiel authentifié par empreinte numérique", left, fy, { width: pageW - left * 2, align: "center" });
    if (verifyUrl) {
      doc.fontSize(6).fillColor("#aaa");
      doc.text(`Vérification : ${verifyUrl}`, left, fy + 10, { width: pageW - left * 2, align: "center" });
    }
  };

  doc.fontSize(7).fillColor("#22c55e");
  doc.text("✅ DOCUMENT OFFICIEL VOCOshop — Authentifié numériquement", left, 25, { width: pageW - left * 2, align: "center" });
  doc.moveDown(0.3);

  doc.fontSize(18).font("Helvetica-Bold").fillColor("#000").text("Bilan sécurisé (lecture seule)", left, 40);
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").fillColor("#333");
  doc.text(`Période : ${from} → ${to}`, left);
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
      doc.fontSize(7).fillColor("#22c55e").text("✅ DOCUMENT OFFICIEL VOCOshop (suite)", left, 25, { width: pageW - left * 2, align: "center" });
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

  doc.fontSize(7).fillColor("#22c55e").text("✅ DOCUMENT OFFICIEL VOCOshop", left, 25, { width: pageW - left * 2, align: "center" });

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
  doc.text(`Période : ${from} → ${to}`, left + 10);
  doc.text(`Mois : ${month}`, left + 10);
  doc.text(`Généré le : ${new Date().toISOString().slice(0, 10)}`, left + 10);
  doc.text(`Expire le : ${String(expiresAt).slice(0, 10)}`, left + 10);
  if (dataHash) {
    doc.text(`Empreinte SHA-256 : ${dataHash}`, left + 10);
  }
  doc.moveDown(0.5);

  doc.fontSize(7).fillColor("#888");
  doc.text("Vocoshop — Plateforme de gestion de boutiques agréée.", left);

  addFooter(doc);

  return doc;
}

/* =======================================================
1️⃣ KPI (STOCK + VENTES mois si from/to)
GET /report/kpis?from=YYYY-MM-DD&to=YYYY-MM-DD
======================================================= */
export const getReportKpis = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

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
  } catch (err) {
    console.error("❌ getReportKpis", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =======================================================
2️⃣ INVENTORY DIFFS
GET /report/inventory-diffs
======================================================= */
export const getInventoryDiffs = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

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
  } catch (err) {
    console.error("❌ getInventoryDiffs error:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =======================================================
3️⃣ AUJOURD'HUI – BILAN DU JOUR
GET /report/today
======================================================= */
export const getTodayReport = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

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
  } catch (err) {
    console.error("❌ getTodayReport", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =======================================================
4️⃣ CLÔTURE DE JOURNÉE (Sale -> DailyReport) — PROFIT RÉEL
POST /report/close-day
======================================================= */
export const closeDayReport = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

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
  } catch (err) {
    console.error("❌ closeDayReport", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =======================================================
5️⃣ HISTORIQUE DES BILANS
GET /report/history?from=YYYY-MM-DD&to=YYYY-MM-DD
======================================================= */
export const getReportHistory = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

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
  } catch (err) {
    console.error("❌ getReportHistory error:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =======================================================
6️⃣ PARTAGE — CRÉER LIEN (privé)
POST /report/share/month
======================================================= */
export const createMonthlyShareLink = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

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
      return res.status(400).json({
        error: "Paramètres invalides. Utilise month (YYYY-MM) ou from/to (YYYY-MM-DD).",
      });
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
  } catch (err) {
    console.error("❌ createMonthlyShareLink:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =======================================================
7️⃣ PARTAGE — DASHBOARD COMPLÈTE POUR MICROFINANCE
GET /api/public/report/share/:id
GET /api/public/report/share/:id?month=YYYY-MM
======================================================= */
export const viewSharedReport = async (req: Request, res: Response) => {
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
    const defaultMonth = String(link.month || "").trim();
    if (!storeId) return res.status(404).send("Lien invalide.");

    const selectedMonth = (isISOMonth(req.query.month) ? req.query.month : defaultMonth) as string;
    if (!selectedMonth) return res.status(404).send("Lien invalide.");

    let from: string;
    let to: string;
    try {
      const r = monthToRange(selectedMonth);
      from = r.from;
      to = r.to;
    } catch {
      return res.status(404).send("Lien invalide.");
    }

    try {
      await SharedReportLink.updateOne(
        { _id: link._id },
        { $inc: { viewsCount: 1 }, $set: { lastViewedAt: new Date() } }
      );
    } catch {}

    const [store, reports, products, stockHistory] = await Promise.all([
      Store.findOne({ shopId: storeId }).lean(),
      DailyReport.find({ storeId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(),
      Product.find({ storeId }).sort({ quantity: -1 }).limit(20).lean(),
      StockHistory.find({ storeId }).sort({ appliedAt: -1 }).limit(30).lean(),
    ]);

    const merchantName = escapeHtml(String((store as any)?.storeName || link.storeName || "Commerce"));
    const merchantCity = escapeHtml(String((store as any)?.city || ""));
    const merchantPhone = escapeHtml(String((store as any)?.phone || ""));
    const shopId = escapeHtml(String(storeId));
    const createdAtStr = (store as any)?.createdAt
      ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date((store as any).createdAt))
      : "N/A";
    const lastActiveStr = (store as any)?.lastActiveAt
      ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date((store as any).lastActiveAt))
      : "N/A";

    const monthlyRevenue = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalRevenue), 0);
    const monthlyCogs = (reports as any[]).reduce((s, r) => s + safeNum(r?.cogs), 0);
    const monthlyGrossProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.grossProfit), 0);
    const monthlyNetProfit = (reports as any[]).reduce((s, r) => s + safeNum(r?.netProfit), 0);
    const monthlySalesCount = (reports as any[]).reduce((s, r) => s + safeNum(r?.totalSales), 0);
    const monthlyMarginPercent = monthlyRevenue > 0 ? clamp((monthlyGrossProfit / monthlyRevenue) * 100, 0, 100) : 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const createdAtDate = (store as any)?.createdAt ? new Date((store as any).createdAt) : now;
    const monthsActive = Math.max(1, Math.floor((now.getTime() - createdAtDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));

    const [totalSalesCount, recentSalesCount, totalScansCount, recentScansCount, totalProductsCount, recentStockMovesCount] = await Promise.all([
      Sale.countDocuments({ storeId }),
      Sale.countDocuments({ storeId, createdAt: { $gte: thirtyDaysAgo } }),
      OcrScan.countDocuments({ storeId }),
      OcrScan.countDocuments({ storeId, createdAt: { $gte: thirtyDaysAgo } }),
      Product.countDocuments({ storeId }),
      StockHistory.countDocuments({ storeId, createdAt: { $gte: ninetyDaysAgo } }),
    ]);

    const uniqueSaleDays = await Sale.distinct("businessDate", { storeId, createdAt: { $gte: thirtyDaysAgo } });
    const activeDays = Array.isArray(uniqueSaleDays) ? uniqueSaleDays.length : 0;

    const dayScore = Math.min(30, (activeDays / 30) * 20 + (recentScansCount / 30) * 10);
    const hasProducts = totalProductsCount > 0 ? 5 : 0;
    const scansWithReview = await OcrScan.countDocuments({ storeId, needsReview: true });
    const reviewRate = totalScansCount > 0 ? scansWithReview / totalScansCount : 0;
    const qualityNoReview = Math.max(0, 10 - reviewRate * 20);
    const dataScore = Math.min(20, hasProducts + qualityNoReview + (totalSalesCount > 10 ? 5 : totalSalesCount > 0 ? 2 : 0));
    const ancienneteScore = Math.min(15, monthsActive * 2);
    const stabilityScore = Math.min(15, activeDays >= 20 ? 15 : activeDays >= 10 ? 10 : activeDays >= 5 ? 6 : activeDays >= 1 ? 3 : 0);
    const stockScoreVal = Math.min(10, (recentStockMovesCount > 0 ? 5 : 0) + (totalProductsCount >= 5 ? 5 : totalProductsCount >= 1 ? 3 : 0));
    const totalScore = Math.min(100, Math.max(0, Math.round(dayScore + dataScore + ancienneteScore + stabilityScore + stockScoreVal)));

    const scoreColor = totalScore >= 70 ? "#22c55e" : totalScore >= 40 ? "#eab308" : "#ef4444";
    const scoreLabel = totalScore >= 70 ? "Excellent" : totalScore >= 50 ? "Bon" : totalScore >= 30 ? "Moyen" : "Faible";

    const availableMonthsRaw = await DailyReport.distinct("date", { storeId });
    const availableMonthsSet = new Set<string>();
    (availableMonthsRaw as string[]).forEach(d => { if (d) availableMonthsSet.add(d.slice(0, 7)); });
    const availableMonths = Array.from(availableMonthsSet).sort().reverse();

    const monthOptions = availableMonths.map(m => {
      const selected = m === selectedMonth ? "selected" : "";
      return `<option value="${escapeHtml(m)}" ${selected}>${escapeHtml(m)}</option>`;
    }).join("");

    const values = (reports as any[]).map((r) => safeNum(r?.totalRevenue));
    const maxVal = Math.max(...values, 1);
    const w = 720;
    const h = 100;
    const pad = 6;
    const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    const points = values.map((v: number, i: number) => {
      const x = pad + i * step;
      const y = pad + (h - pad * 2) * (1 - v / maxVal);
      return `${x},${y}`;
    }).join(" ");

    const areaPoints = values.length > 0
      ? `${pad},${h - pad} ${points} ${pad + (values.length - 1) * step},${h - pad}`
      : "";

    const rows = (reports as any[]).map((r) => {
      const rev = safeNum(r?.totalRevenue);
      const gp = safeNum(r?.grossProfit);
      const margin = rev > 0 ? clamp((gp / rev) * 100, 0, 100) : 0;
      return `<tr>
        <td>${escapeHtml(r?.date)}</td>
        <td>${formatMoney(rev)}</td>
        <td>${formatMoney(safeNum(r?.cogs))}</td>
        <td>${formatMoney(safeNum(r?.netProfit))}</td>
        <td>${Math.round(margin * 10) / 10}%</td>
        <td>${safeNum(r?.totalSales)}</td>
      </tr>`;
    }).join("");

    const productRows = (products as any[]).map((p) => {
      const qty = safeNum(p?.quantity);
      const sell = safeNum(p?.sellPrice);
      const buy = safeNum(p?.purchasePrice);
      const stockVal = qty * buy;
      return `<tr>
        <td>${escapeHtml(p?.name)}</td>
        <td>${escapeHtml(p?.category || "—")}</td>
        <td>${qty}</td>
        <td>${formatMoney(sell)}</td>
        <td>${formatMoney(buy)}</td>
        <td>${formatMoney(stockVal)}</td>
      </tr>`;
    }).join("");

    const stockRows = (stockHistory as any[]).map((h) => {
      const diff = safeNum(h?.diff);
      const sign = diff > 0 ? "+" : "";
      const diffColor = diff > 0 ? "#22c55e" : diff < 0 ? "#ef4444" : "#A8A3C2";
      const dateStr = h?.appliedAt ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(h.appliedAt)) : "—";
      return `<tr>
        <td>${dateStr}</td>
        <td>${escapeHtml(h?.productName || "—")}</td>
        <td style="color:${diffColor};font-weight:700">${sign}${diff}</td>
        <td>${safeNum(h?.previousQuantity)}</td>
        <td>${safeNum(h?.newQuantity)}</td>
      </tr>`;
    }).join("");

    const totalStockValue = (products as any[]).reduce((s, p) => s + safeNum(p?.quantity) * safeNum(p?.purchasePrice), 0);
    const totalStockResell = (products as any[]).reduce((s, p) => s + safeNum(p?.quantity) * safeNum(p?.sellPrice), 0);
    const totalStockProfit = totalStockResell - totalStockValue;

    const pdfUrlRelative = `/api/public/report/share/${encodeURIComponent(token)}/pdf`;
    const pdfUrlAbsolute = `${getPublicBaseUrl(req)}${pdfUrlRelative}`;
    const verifyUrl = `${getPublicBaseUrl(req)}/api/public/report/verify/${encodeURIComponent(token)}`;

    const verifyRows = (reports as any[]).map(r => ({
      date: String(r.date || "").slice(0, 10),
      revenue: safeNum(r?.totalRevenue),
      cogs: safeNum(r?.cogs),
      profit: safeNum(r?.netProfit || r?.grossProfit),
      sales: safeNum(r?.totalSales),
    }));
    const currentHash = computeDataHash({
      revenue: monthlyRevenue, cogs: monthlyCogs,
      grossProfit: monthlyGrossProfit, netProfit: monthlyNetProfit,
      salesCount: monthlySalesCount, marginPercent: monthlyMarginPercent,
      from, to, rows: verifyRows,
    });
    const hashValid = currentHash === link.dataHash;

    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Dashboard Vocoshop — ${merchantName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#0A0617;color:#E8E4F0;line-height:1.5}
.wrap{max-width:1040px;margin:0 auto;padding:20px 16px}
.top-bar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}
.brand{font-size:13px;font-weight:700;color:#A78BFA;letter-spacing:1px;text-transform:uppercase}
.expires-badge{font-size:11px;color:#71717a;background:rgba(255,255,255,.04);padding:4px 10px;border-radius:8px}
.card{background:#18122B;border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:16px;margin-top:14px}
.card-green{border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.04)}
.card-purple{border-color:rgba(139,92,246,.25);background:rgba(139,92,246,.04)}
.section-title{font-size:11px;font-weight:800;color:#A78BFA;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px}
.row{display:flex;gap:12px;flex-wrap:wrap}
.col{flex:1;min-width:160px}
.kpi-box{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:10px;padding:12px}
.kpi-label{font-size:11px;font-weight:700;color:#8B83A8;text-transform:uppercase;letter-spacing:.5px}
.kpi-value{font-size:22px;font-weight:900;margin-top:4px;color:#fff}
.kpi-sub{font-size:11px;color:#6B6589;margin-top:2px}
.muted{color:#8B83A8}
.text-sm{font-size:12px}
.text-xs{font-size:11px}
.fw-800{font-weight:800}
.mt-8{margin-top:8px}
.mt-12{margin-top:12px}
.mt-16{margin-top:16px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:8px 10px;font-size:11px;font-weight:700;color:#8B83A8;border-bottom:1px solid rgba(255,255,255,.08);text-transform:uppercase;letter-spacing:.5px}
td{padding:8px 10px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.04)}
tr:hover td{background:rgba(255,255,255,.02)}
.score-ring{width:120px;height:120px;position:relative;display:flex;align-items:center;justify-content:center}
.score-ring svg{position:absolute;top:0;left:0;transform:rotate(-90deg)}
.score-ring .score-num{font-size:32px;font-weight:900;z-index:1}
.score-ring .score-max{font-size:12px;color:#8B83A8;z-index:1;margin-top:30px}
.score-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:6px}
.score-bar-fill{height:100%;border-radius:3px;transition:width .3s}
.badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700}
.badge-green{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.2)}
.badge-yellow{background:rgba(234,179,8,.15);color:#eab308;border:1px solid rgba(234,179,8,.2)}
.badge-red{background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
.badge-purple{background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.2)}
.seal{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700}
.seal-valid{background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.25)}
.seal-invalid{background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
.btn{display:inline-flex;gap:6px;align-items:center;justify-content:center;padding:8px 14px;border-radius:10px;text-decoration:none;font-weight:800;font-size:12px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.3);color:#fff;transition:background .2s}
.btn:hover{background:rgba(167,139,250,.25)}
.btn-outline{background:transparent;border:1px solid rgba(255,255,255,.15);color:#CFC7E8}
.btn-outline:hover{background:rgba(255,255,255,.06)}
select{background:#1e1736;border:1px solid rgba(255,255,255,.1);color:#E8E4F0;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
select:focus{outline:1px solid #A78BFA}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}
.info-label{font-size:11px;color:#6B6589;font-weight:600}
.info-value{font-size:13px;color:#E8E4F0;font-weight:600}
.footer{margin-top:20px;padding:14px 0;border-top:1px solid rgba(255,255,255,.06);text-align:center;font-size:11px;color:#4A4464}
.footer a{color:#7C6FBA;text-decoration:none}
@media(max-width:640px){
.info-grid{grid-template-columns:1fr}
.kpi-value{font-size:18px}
.score-ring{width:100px;height:100px}
.score-ring .score-num{font-size:26px}
}
</style>
</head>
<body>
<div class="wrap">

<div class="top-bar">
<div class="brand">Vocoshop</div>
<div class="expires-badge">Expire le ${escapeHtml(String(link.expiresAt).slice(0,10))}</div>
</div>

<div class="card card-green" style="padding:10px 14px">
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
<div style="display:flex;align-items:center;gap:8px">
<div class="seal ${hashValid ? 'seal-valid' : 'seal-invalid'}">${hashValid ? '✓' : '!!'} ${hashValid ? 'Document officiel Vocoshop' : 'Document non vérifié'}</div>
<div class="text-xs muted">SHA-256 authentifié</div>
</div>
<a href="${escapeHtml(verifyUrl)}" target="_blank" style="color:#a78bfa;font-size:12px;text-decoration:none">Vérifier l'authenticité →</a>
</div>
</div>

<div class="card" style="padding:14px 16px">
<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
<div>
<h1 style="font-size:20px;font-weight:900;margin:0;color:#fff">${merchantName}</h1>
<div class="text-sm muted mt-8">
ID : ${shopId}${merchantCity ? ' · ' + merchantCity : ''}${merchantPhone ? ' · ' + merchantPhone : ''}
</div>
<div class="text-xs muted mt-8">
Membre depuis ${createdAtStr} · Dernière activité : ${lastActiveStr}
</div>
</div>
<div style="display:flex;gap:6px;flex-wrap:wrap">
<a class="btn" href="${pdfUrlAbsolute}" download>Télécharger PDF</a>
<a class="btn btn-outline" href="${escapeHtml(verifyUrl)}" target="_blank">Vérifier</a>
</div>
</div>
</div>

<div class="row" style="align-items:stretch">
<div class="card" style="flex:0 0 180px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:160px">
<div class="score-ring">
<svg width="120" height="120" viewBox="0 0 120 120">
<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="8"/>
<circle cx="60" cy="60" r="52" fill="none" stroke="${scoreColor}" stroke-width="8"
stroke-dasharray="${(totalScore / 100) * 327} 327" stroke-linecap="round"/>
</svg>
<div class="score-num" style="color:${scoreColor}">${totalScore}</div>
<div class="score-max">/100</div>
</div>
<div class="badge badge-${totalScore >= 70 ? 'green' : totalScore >= 40 ? 'yellow' : 'red'}" style="margin-top:8px">${scoreLabel}</div>
</div>
<div class="card" style="flex:1">
<div class="section-title">Détail du score</div>
${[
{s: dayScore, max: 30, label: "Régularité d'utilisation"},
{s: dataScore, max: 20, label: "Qualité des données"},
{s: ancienneteScore, max: 15, label: "Ancienneté"},
{s: stabilityScore, max: 15, label: "Stabilité commerciale"},
{s: stockScoreVal, max: 10, label: "Gestion du stock"},
].map(item => {
const pct = item.max > 0 ? (item.s / item.max) * 100 : 0;
const barColor = pct >= 70 ? "#22c55e" : pct >= 40 ? "#eab308" : "#ef4444";
return `<div style="margin-bottom:8px">
<div style="display:flex;justify-content:space-between;align-items:center">
<span class="text-xs muted">${escapeHtml(item.label)}</span>
<span class="text-xs fw-800">${Math.round(item.s)}/${item.max}</span>
</div>
<div class="score-bar"><div class="score-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>
</div>`;
}).join("")}
</div>
</div>

<div class="row" style="align-items:baseline;justify-content:space-between;margin-top:14px">
<div class="section-title" style="margin-bottom:0">Revenus du mois</div>
<div>
${availableMonths.length > 0 ? `<select onchange="window.location.href='?month='+this.value">${monthOptions}</select>` : ""}
</div>
</div>

<div class="row mt-8">
<div class="col"><div class="kpi-box">
<div class="kpi-label">Chiffre d'affaires</div>
<div class="kpi-value">${formatMoney(monthlyRevenue)}</div>
<div class="kpi-sub">FCFA</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Profit brut</div>
<div class="kpi-value">${formatMoney(monthlyGrossProfit)}</div>
<div class="kpi-sub">FCFA</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Marge</div>
<div class="kpi-value">${Math.round(monthlyMarginPercent * 10) / 10}%</div>
<div class="kpi-sub">brut/CA</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Ventes</div>
<div class="kpi-value">${monthlySalesCount}</div>
<div class="kpi-sub">tickets</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Profit net</div>
<div class="kpi-value">${formatMoney(monthlyNetProfit)}</div>
<div class="kpi-sub">FCFA</div>
</div></div>
</div>

<div class="row mt-8">
<div class="col"><div class="kpi-box">
<div class="kpi-label">COGS</div>
<div class="kpi-value text-sm">${formatMoney(monthlyCogs)} FCFA</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Jours actifs</div>
<div class="kpi-value text-sm">${activeDays} / 30</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Scans OCR</div>
<div class="kpi-value text-sm">${totalScansCount}</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Ventes totales</div>
<div class="kpi-value text-sm">${totalSalesCount}</div>
</div></div>
<div class="col"><div class="kpi-box">
<div class="kpi-label">Ancienneté</div>
<div class="kpi-value text-sm">${monthsActive} mois</div>
</div></div>
</div>

<div class="card mt-12">
<div class="section-title">Évolution du chiffre d'affaires</div>
${values.length > 0 ? `
<svg width="100%" viewBox="0 0 ${w} ${h}" style="margin-top:8px">
<defs>
<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="rgba(167,139,250,.25)"/>
<stop offset="100%" stop-color="rgba(167,139,250,.02)"/>
</linearGradient>
</defs>
<polygon fill="url(#areaGrad)" points="${areaPoints}"/>
<polyline fill="none" stroke="rgba(167,139,250,.9)" stroke-width="2.5" points="${points}"/>
${values.map((v: number, i: number) => {
const x = pad + i * step;
const y = pad + (h - pad * 2) * (1 - v / maxVal);
return `<circle cx="${x}" cy="${y}" r="3" fill="#A78BFA"/>`;
}).join("")}
</svg>
` : '<div class="muted text-sm" style="padding:20px 0;text-align:center">Aucune donnée pour cette période</div>'}
</div>

<div class="card mt-12">
<div class="section-title">Détails par jour</div>
${rows ? `
<div style="overflow-x:auto">
<table>
<thead><tr><th>Date</th><th>CA</th><th>COGS</th><th>Profit</th><th>Marge</th><th>Ventes</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</div>
` : '<div class="muted text-sm" style="padding:20px 0;text-align:center">Aucune donnée journalière</div>'}
</div>

<div class="card mt-12">
<div class="section-title">Stock</div>
<div class="info-grid mt-8">
<div><div class="info-label">Produits</div><div class="info-value">${totalProductsCount}</div></div>
<div><div class="info-label">Articles en stock</div><div class="info-value">${(products as any[]).reduce((s, p) => s + safeNum(p?.quantity), 0)}</div></div>
<div><div class="info-label">Valeur d'achat</div><div class="info-value">${formatMoney(totalStockValue)} FCFA</div></div>
<div><div class="info-label">Valeur de revente</div><div class="info-value">${formatMoney(totalStockResell)} FCFA</div></div>
<div><div class="info-label">Marge potentielle</div><div class="info-value" style="color:#22c55e">${formatMoney(totalStockProfit)} FCFA</div></div>
<div><div class="info-label">Mouvements (90j)</div><div class="info-value">${recentStockMovesCount}</div></div>
</div>
</div>

${productRows ? `
<div class="card mt-12">
<div class="section-title">Produits (${totalProductsCount})</div>
<div style="overflow-x:auto">
<table>
<thead><tr><th>Nom</th><th>Catégorie</th><th>Qté</th><th>Prix vente</th><th>Prix achat</th><th>Valeur stock</th></tr></thead>
<tbody>${productRows}</tbody>
</table>
</div>
</div>
` : ""}

${stockRows ? `
<div class="card mt-12">
<div class="section-title">Mouvements de stock récents</div>
<div style="overflow-x:auto">
<table>
<thead><tr><th>Date</th><th>Produit</th><th>Variation</th><th>Avant</th><th>Après</th></tr></thead>
<tbody>${stockRows}</tbody>
</table>
</div>
</div>
` : ""}

<div class="card card-purple mt-12" style="padding:10px 14px">
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
<div style="display:flex;align-items:center;gap:6px">
<div class="badge badge-purple">Blockchain</div>
<div class="text-xs muted">Empreinte SHA-256</div>
</div>
<div class="text-xs muted">Chaîne : ${(link.dataHash || "").slice(0, 24)}...</div>
</div>
</div>

<div class="footer">
<div>Vocoshop — Document officiel · Lien sécurisé révocable et expirant</div>
<div class="mt-8">
<a href="${escapeHtml(verifyUrl)}" target="_blank">Vérifier l'authenticité</a>
 · Généré le ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Brazzaville", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(now)}
</div>
</div>

</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (err) {
    console.error("❌ viewSharedReport:", err);
    return res.status(500).send("Erreur serveur.");
  }
};

/* =======================================================
7B️⃣ PARTAGE — PDF (PUBLIC)
GET /api/public/report/share/:id/pdf
======================================================= */
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
    console.error("❌ downloadSharedReportPdf:", err);
    return res.status(500).send("Erreur serveur.");
  }
};

/* =======================================================
8️⃣ VÉRIFICATION D'AUTHENTICITÉ (PUBLIC)
GET /api/public/report/verify/:token
======================================================= */
export const verifySharedReport = async (req: Request, res: Response) => {
  try {
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
  } catch (err) {
    console.error("❌ verifySharedReport:", err);
    return res.status(500).json({ valid: false, error: "Erreur serveur" });
  }
};

/* =======================================================
9️⃣ PARTAGE — RÉVOQUER (privé)
POST /report/share/:id/revoke
======================================================= */
export const revokeShareLink = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

    const { id } = req.params;

    const link = await SharedReportLink.findOneAndUpdate(
      { _id: id, storeId },
      { $set: { isActive: false } },
      { new: true }
    ).lean();

    if (!link) return res.status(404).json({ error: "Lien introuvable" });

    return res.json({ message: "Lien révoqué", linkId: id });
  } catch (err) {
    console.error("❌ revokeShareLink:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};
