// controllers/storeAnalysisController.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import Store from "../models/Store";
import Sale from "../models/Sales";
import DailyReport from "../models/DailyReport";
import { getStoreId } from "../utils/storeId";

/* =====================================================
Helpers dates (YYYY-MM-DD)
===================================================== */
function isYMD(s: any) {
return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function startOfDay(d: Date) {
return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toYMD(d: Date) {
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
}

function clampDate(d: Date, min: Date, max: Date) {
let x = d;
if (x < min) x = min;
if (x > max) x = max;
return x;
}

function diffDays(a: Date, b: Date) {
const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number) {
const x = new Date(d);
x.setDate(x.getDate() + n);
return startOfDay(x);
}

function dayNameFR(dayNum1to7: number) {
// Mongo $dayOfWeek: 1=Dimanche ... 7=Samedi
switch (dayNum1to7) {
case 1:
return "Dimanche";
case 2:
return "Lundi";
case 3:
return "Mardi";
case 4:
return "Mercredi";
case 5:
return "Jeudi";
case 6:
return "Vendredi";
case 7:
return "Samedi";
default:
return "—";
}
}

type DailyPoint = { date: string; totalSales: number; totalItems: number; countSales: number };

function sumReportItems(rep: any): number {
if (!rep || !Array.isArray(rep.sales)) return 0;
return rep.sales.reduce((sum: number, s: any) => sum + Number(s?.quantity || 0), 0);
}

/* =====================================================
GET /api/store/analysis?from=YYYY-MM-DD&to=YYYY-MM-DD
V2 ROBUSTE:
- Aujourd’hui non clôturé -> Sales
- Jours clôturés -> DailyReport
===================================================== */
export const getStoreAnalysis = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

// anti-cache (utile en dev)
res.setHeader("Cache-Control", "no-store");
res.setHeader("Pragma", "no-cache");

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

// bornes (min=createdAt boutique, max=today)
const store = await Store.findById(storeId).select("createdAt").lean();
if (!store) return next(new NotFoundError("Boutique introuvable"));

const today = startOfDay(new Date());
const createdAt = store?.createdAt ? startOfDay(new Date(store.createdAt)) : today;

const minAllowed = createdAt;
const maxAllowed = today;

const qFrom = req.query.from;
const qTo = req.query.to;

const rawFrom = isYMD(qFrom) ? new Date(String(qFrom)) : today;
const rawTo = isYMD(qTo) ? new Date(String(qTo)) : today;

const fromDate = clampDate(startOfDay(rawFrom), minAllowed, maxAllowed);
const toDate = clampDate(startOfDay(rawTo), minAllowed, maxAllowed);

if (fromDate > toDate) {
return next(new ValidationError("Période invalide (from > to)"));
}

const fromYMD = toYMD(fromDate);
const toYMDStr = toYMD(toDate);
const daysInPeriod = Math.max(1, diffDays(toDate, fromDate) + 1);

/* =====================================================
1) Sources de données (clôturé vs non clôturé)
===================================================== */

// A) DailyReports (clôturés)
const reports = await DailyReport.find({
storeId,
date: { $gte: fromYMD, $lte: toYMDStr },
}).lean();

const reportByDate = new Map<string, any>();
for (const r of reports) reportByDate.set(String((r as any).date), r);

// B) Sales agrégées (non clôturé)
const salesAggByDay = await Sale.aggregate([
{ $match: { storeId, businessDate: { $gte: fromYMD, $lte: toYMDStr } } },
{
$group: {
_id: "$businessDate",
totalSales: { $sum: "$totalAmount" },
totalItems: { $sum: "$quantity" },
countSales: { $sum: 1 },
},
},
{ $sort: { _id: 1 } },
]);

const salesByDate = new Map<string, DailyPoint>();
for (const x of salesAggByDay) {
salesByDate.set(String(x._id), {
date: String(x._id),
totalSales: Number(x.totalSales || 0),
totalItems: Number(x.totalItems || 0),
countSales: Number(x.countSales || 0),
});
}

/* =====================================================
2) Série journalière (DailyReport prioritaire)
===================================================== */
const dailySeries: DailyPoint[] = [];

for (let i = 0; i < daysInPeriod; i++) {
const d = addDays(fromDate, i);
const ymd = toYMD(d);

const rep = reportByDate.get(ymd);
if (rep) {
dailySeries.push({
date: ymd,
totalSales: Number((rep as any).totalRevenue || 0),
totalItems: sumReportItems(rep),
countSales: Number((rep as any).totalSales || 0),
});
continue;
}

const sday = salesByDate.get(ymd);
if (sday) {
dailySeries.push({
date: ymd,
totalSales: Number(sday.totalSales || 0),
totalItems: Number(sday.totalItems || 0),
countSales: Number(sday.countSales || 0),
});
} else {
dailySeries.push({ date: ymd, totalSales: 0, totalItems: 0, countSales: 0 });
}
}

/* =====================================================
3) Summary
===================================================== */
const totalSalesAmount = dailySeries.reduce((sum, d) => sum + Number(d.totalSales || 0), 0);
const totalItemsSold = dailySeries.reduce((sum, d) => sum + Number(d.totalItems || 0), 0);
const totalTransactions = dailySeries.reduce((sum, d) => sum + Number(d.countSales || 0), 0);
const avgDailySales = Math.round(totalSalesAmount / Math.max(1, daysInPeriod));

/* =====================================================
4) Produits (top + slow)
⚠️ DailyReport.sales n'a pas productId chez toi => group par productName
===================================================== */

// 4a) Top depuis DailyReport (clôturé)
const topFromReports = await DailyReport.aggregate([
{ $match: { storeId, date: { $gte: fromYMD, $lte: toYMDStr } } },
{ $unwind: "$sales" },
{
$group: {
_id: { name: "$sales.productName" }, // ⚠️ DailyReport sans productId
quantity: { $sum: "$sales.quantity" },
amount: { $sum: "$sales.totalAmount" },
lastDate: { $max: "$date" },
},
},
{ $sort: { quantity: -1 } },
{ $limit: 30 },
]);

// 4b) Top depuis Sales (non clôturé)
const topFromSales = await Sale.aggregate([
{ $match: { storeId, businessDate: { $gte: fromYMD, $lte: toYMDStr } } },
{
$group: {
_id: { productId: "$productId", name: "$productName" },
quantity: { $sum: "$quantity" },
amount: { $sum: "$totalAmount" },
lastDate: { $max: "$businessDate" },
},
},
{ $sort: { quantity: -1 } },
{ $limit: 30 },
]);

/* =====================================================
Merge JS (clé = productId + name)
===================================================== */

type ProductAgg = {
productId: string;
name: string;
quantity: number;
amount: number;
lastBusinessDate: string;
};

const productMap = new Map<string, ProductAgg>();

const pushProduct = (p: any) => {
const productId = p?._id?.productId ? String(p._id.productId) : "";
const name = String(p?._id?.name || "");
if (!name) return;

const key = `${productId}__${name}`;

const prev: ProductAgg =
productMap.get(key) ?? {
productId,
name,
quantity: 0,
amount: 0,
lastBusinessDate: "",
};

const qty = Number(p?.quantity || 0);
const amt = Number(p?.amount || 0);
const d = String(p?.lastDate || "");

const next: ProductAgg = {
...prev,
quantity: prev.quantity + qty,
amount: prev.amount + amt,
lastBusinessDate:
!prev.lastBusinessDate || d > prev.lastBusinessDate
? d
: prev.lastBusinessDate,
};

productMap.set(key, next);
};

// merge effectif
topFromReports.forEach(pushProduct);
topFromSales.forEach(pushProduct);

// tri final
const productsMerged = Array.from(productMap.values()).sort(
(a, b) => b.quantity - a.quantity
);

// Top produits (UI)
const topProducts = productsMerged.slice(0, 8);

/* =====================================================
Produits lents (heuristique simple & lisible)
===================================================== */

const slowProducts = productsMerged
.slice()
.sort((a, b) => a.quantity - b.quantity)
.slice(0, 15)
.map((p) => {
const avgPerDay = Number(p.quantity || 0) / Math.max(1, daysInPeriod);
const lastSoldDate = p.lastBusinessDate
? new Date(p.lastBusinessDate)
: null;

const daysSinceLastSale = lastSoldDate
? diffDays(toDate, startOfDay(lastSoldDate))
: null;

const isSlow =
avgPerDay < 3 ||
(typeof daysSinceLastSale === "number" && daysSinceLastSale >= 10);

return {
productId: p.productId,
name: p.name,
quantity: p.quantity,
avgPerDay: Number(avgPerDay.toFixed(2)),
daysSinceLastSale,
isSlow,
};
})
.filter((p) => p.isSlow)
.slice(0, 8);

/* =====================================================
5) Best / Worst day (basé sur dailySeries)
===================================================== */
const dowMap = new Map<number, number>(); // 0..6 JS
for (const d of dailySeries) {
const dt = new Date(d.date);
const jsDow = dt.getDay(); // 0=Dim
dowMap.set(jsDow, (dowMap.get(jsDow) || 0) + Number(d.totalSales || 0));
}

const dowArr = Array.from(dowMap.entries())
.map(([jsDow, totalSales]) => {
const mongoDow = jsDow === 0 ? 1 : jsDow + 1;
return { mongoDow, totalSales };
})
.sort((a, b) => b.totalSales - a.totalSales);

const bestDay = dowArr[0]
? { name: dayNameFR(dowArr[0].mongoDow), totalSales: dowArr[0].totalSales }
: { name: "—", totalSales: 0 };

const worstDay =
dowArr.length > 0
? (() => {
const last = dowArr[dowArr.length - 1];
return { name: dayNameFR(last.mongoDow), totalSales: last.totalSales };
})()
: { name: "—", totalSales: 0 };

/* =====================================================
6) Insights (égalité top + limite 3)
===================================================== */
const insights: string[] = [];

if (totalSalesAmount === 0) {
insights.push(
"Aucune vente sur cette période. Commence par enregistrer des ventes pour débloquer l’analyse."
);
} else {
// top égalités
if (topProducts.length > 0) {
const maxQty = topProducts[0].quantity;
const bests = topProducts.filter((p) => p.quantity === maxQty).slice(0, 3);

if (bests.length === 1) {
insights.push(`Tu vends bien "${bests[0].name}". Pense à en remettre pour éviter la rupture.`);
} else {
const names = bests.map((p) => `"${p.name}"`).join(" et ");
insights.push(`Tes tops produits (égalité) : ${names}. Pense à en remettre pour éviter la rupture.`);
}
}

if (slowProducts?.[0]?.name) {
insights.push(`"${slowProducts[0].name}" sort peu. Vérifie le prix, la visibilité ou propose une promo.`);
}

if (bestDay.name !== "—") {
insights.push(`Jour fort : ${bestDay.name}. Jour faible : ${worstDay.name}.`);
}
}

/* =====================================================
Response
===================================================== */
return res.status(200).json({
period: { from: fromYMD, to: toYMDStr, days: daysInPeriod },
summary: {
totalSales: Math.round(totalSalesAmount), // CA
totalItemsSold,
totalTransactions,
avgDailySales,
},
series: { daily: dailySeries },
topProducts,
slowProducts,
days: { bestDay, worstDay },
insights,
});
});
