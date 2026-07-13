// controllers/salesController.ts
import { Request, Response, NextFunction } from "express";
import Product from "../models/Product";
import Sale from "../models/Sales";
import DailyReport from "../models/DailyReport";
import Store from "../models/Store";
import { getStoreId } from "../utils/storeId";
import { getBusinessDate, safeNum as n, isValidObjectId } from "../utils/helpers";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError } from "../utils/AppError";

/* =====================================================
HELPERS
===================================================== */


async function touchStoreActivity(storeId: string) {
try {
if (!storeId) return;
await Store.updateOne(
{ _id: storeId },
{ $set: { lastActiveAt: new Date() }, $setOnInsert: { installedAt: new Date() } }
).exec();
} catch (e) {
// silencieux: ne bloque jamais une vente
console.log("⚠️ touchStoreActivity failed:", (e as any)?.message || e);
}
}

/* =====================================================
AJOUT VENTE SIMPLE (prix achat figé)
===================================================== */
export const addSale = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
const { productId, quantity, isVoiced } = req.body;

if (!storeId) return next(new ValidationError("storeId manquant"));

const qty = n(quantity);
if (!productId || !isValidObjectId(productId) || qty <= 0) {
return next(new ValidationError("Données invalides"));
}

const product: any = await Product.findOne({ _id: productId, storeId });
if (!product) return next(new NotFoundError("Produit"));

if (n(product.quantity) < qty) {
return next(new ValidationError("Stock insuffisant"));
}

const businessDate = getBusinessDate();

const sellPrice = n(product.sellPrice);
const purchasePriceAtSale = n(product.purchasePrice);

const sale = await Sale.create({
storeId,
productId,
productName: product.name,
quantity: qty,
unitPrice: sellPrice,
totalAmount: qty * sellPrice,
purchasePriceAtSale,
businessDate,

isVoiced: !!isVoiced,
isReverted: false,
});

product.quantity = n(product.quantity) - qty;
await product.save();
await touchStoreActivity(storeId);

return res.json({ message: "Vente enregistrée", sale });
});

/* =====================================================
VENTES PANIER (prix achat figé)
===================================================== */
export const addCartSales = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
const { items } = req.body;

if (!storeId || !Array.isArray(items) || items.length === 0) {
return next(new ValidationError("Panier invalide"));
}

let totalAmount = 0;
const businessDate = getBusinessDate();

for (const item of items) {
const qty = n(item?.quantity);
const productId = item?.productId;

if (!productId || !isValidObjectId(productId) || qty <= 0) {
return next(new ValidationError("Panier invalide"));
}

const product: any = await Product.findOne({ _id: productId, storeId });
if (!product || n(product.quantity) < qty) {
return next(new ValidationError("Stock insuffisant"));
}

const sellPrice = n(product.sellPrice);
const purchasePriceAtSale = n(product.purchasePrice);

await Sale.create({
storeId,
productId: String(product._id),
productName: product.name,
quantity: qty,
unitPrice: sellPrice,
totalAmount: qty * sellPrice,
purchasePriceAtSale,
businessDate,
});

product.quantity = n(product.quantity) - qty;
await product.save();

totalAmount += qty * sellPrice;
}

await touchStoreActivity(storeId);

return res.json({ message: "Ventes enregistrées", totalAmount });
});

/* =====================================================
REVERT SALE (Voice UNDO)
===================================================== */

export const revertSale = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = (req as any).user?.storeId;

if (!storeId) {
return next(new ValidationError("Store invalide"));
}

const sale: any = await Sale.findOne({
storeId,
isVoiced: true,
isReverted: false,
}).sort({ createdAt: -1 });

if (!sale) {
return next(new NotFoundError("Aucune vente vocale récente"));
}

const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

if (sale.createdAt.getTime() < twoMinutesAgo) {
return next(new ValidationError("Délai dépassé pour annulation"));
}

sale.isReverted = true;
await sale.save();

const product: any = await Product.findOne({
_id: sale.productId,
storeId,
});

if (product) {
product.quantity = Number(product.quantity || 0) + Number(sale.quantity || 0);
await product.save();
}

return res.json({
message: "Vente vocale annulée avec succès",
});

});

/* =====================================================
VENTES DU JOUR (AVANT CLÔTURE)
===================================================== */
export const getTodaySales = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = getStoreId(req);
  if (!storeId) return next(new ValidationError("storeId manquant"));

  const date = getBusinessDate();

  let sales: any[] = await Sale.find({ storeId, businessDate: date }).lean();

  // Si pas de vente aujourd'hui, chercher le jour le plus récent
  if (!sales.length) {
    const lastPending = await Sale.findOne({ storeId })
      .sort({ businessDate: -1 })
      .select("businessDate")
      .lean();
    const fallbackDate = (lastPending as any)?.businessDate;
    if (fallbackDate && fallbackDate !== date) {
      sales = await Sale.find({ storeId, businessDate: fallbackDate }).lean();
    }
  }

  const totalRevenue = sales.reduce((sum, s) => sum + n(s.totalAmount), 0);
  const effectiveDate = sales[0]?.businessDate || date;

  return res.json({
    date: effectiveDate,
    totalSales: sales.length,
totalRevenue,
sales,
});
});

/* =====================================================
CLÔTURE JOURNÉE (PROFIT RÉEL - FIABLE)
- utilise purchasePriceAtSale (figé) -> historique stable
===================================================== */
export const closeDaySales = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

  const date = getBusinessDate();

  // 1) ventes en attente (du jour — ou jour le plus récent si pas de vente aujourd'hui)
  let newSales: any[] = await Sale.find({ storeId, businessDate: date }).lean();

  if (!newSales.length) {
    // Chercher le jour le plus récent avec des ventes en attente
    const lastPending = await Sale.findOne({ storeId })
      .sort({ businessDate: -1 })
      .select("businessDate")
      .lean();
    const fallbackDate = (lastPending as any)?.businessDate;
    if (fallbackDate && fallbackDate !== date) {
      newSales = await Sale.find({ storeId, businessDate: fallbackDate }).lean();
    }
  }

  if (!newSales.length) {
    return next(new ValidationError("Aucune nouvelle vente à clôturer"));
  }

  // Utiliser la date des ventes trouvées (pas forcément getBusinessDate)
  const effectiveDate = newSales[0]?.businessDate || date;

  // 2) bilan existant (si déjà clôturé)
  const existing: any = await DailyReport.findOne({ storeId, date: effectiveDate }).lean();

// 3) merge lignes produits (clé = productId + unitPrice + purchasePrice)
type Line = {
productId?: string;
productName: string;
unitPrice: number;
purchasePrice: number;
quantity: number;
totalAmount: number;
lineProfit: number;
};

const map = new Map<string, Line>();

const addLine = (
productId: string | undefined,
productName: string,
unitPrice: any,
purchasePrice: any,
quantity: any
) => {
const u = n(unitPrice);
const b = n(purchasePrice);
const q = n(quantity);

const key = `${productId || productName}__${u}__${b}`;
const prev = map.get(key);

if (!prev) {
map.set(key, {
productId,
productName: String(productName || "Produit"),
unitPrice: u,
purchasePrice: b,
quantity: q,
totalAmount: q * u,
lineProfit: (u - b) * q,
});
} else {
prev.quantity += q;
prev.totalAmount = prev.quantity * u;
prev.lineProfit = (u - b) * prev.quantity;
map.set(key, prev);
}
};

// 3a) inject ancien bilan (déjà agrégé)
(existing?.sales ?? []).forEach((s: any) => {
addLine(
s.productId ? String(s.productId) : undefined,
s.productName,
s.unitPrice,
s.purchasePrice,
s.quantity
);
});

// 3b) inject nouvelles ventes (prix achat figé dans Sale)
newSales.forEach((s: any) => {
addLine(
s.productId ? String(s.productId) : undefined,
s.productName,
s.unitPrice,
s.purchasePriceAtSale ?? 0, // ✅ source fiable
s.quantity
);
});

const mergedSales = Array.from(map.values());

// 4) recalcul totals FINANCE (microfinance)
const totalRevenue = mergedSales.reduce((sum, l) => sum + n(l.totalAmount), 0);
const cogs = mergedSales.reduce((sum, l) => sum + n(l.purchasePrice) * n(l.quantity), 0);
const grossProfit = totalRevenue - cogs;
const netProfit = grossProfit; // plus tard: - charges

// tickets = cumul ancien + nouveaux tickets
const previousTickets = n(existing?.totalSales);
const totalSales = previousTickets + newSales.length;

  // 5) upsert DailyReport (fields finance)
  const report = await DailyReport.findOneAndUpdate(
    { storeId, date: effectiveDate },
    {
      storeId,
      date: effectiveDate,
      totalSales,
      totalRevenue,
      cogs,
      grossProfit,
      netProfit,
      sales: mergedSales.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        purchasePrice: l.purchasePrice,
        totalAmount: l.totalAmount,
        lineProfit: l.lineProfit,
      })),
    },
    { upsert: true, new: true }
  ).lean();

  // 6) supprimer ventes "en attente"
  await Sale.deleteMany({ storeId, businessDate: effectiveDate });

  await touchStoreActivity(storeId);

  // Récupérer infos boutique pour le message de partage
  const storeInfo = await Store.findById(storeId).select("storeName ownerName ownerPhone").lean();

  return res.json({
    message: "Journée clôturée (profit réel calculé)",
    report,
    userName: req.user?.name || "",
    userRole: req.user?.role || "",
    storeName: storeInfo?.storeName || "",
    ownerName: storeInfo?.ownerName || "",
  });
});

/* =====================================================
HISTORIQUE
===================================================== */
export const getDailyReports = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "7"), 10) || 7, 1), 50);
const skip = (page - 1) * limit;

const [reports, total] = await Promise.all([
DailyReport.find({ storeId }).sort({ date: -1 }).skip(skip).limit(limit).lean(),
DailyReport.countDocuments({ storeId }),
]);

return res.json({
page,
limit,
total,
hasMore: skip + reports.length < total,
reports,
});
});

/* =====================================================
RAPPORT DU JOUR (APRÈS CLÔTURE)
===================================================== */
export const getTodayReport = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const date = getBusinessDate();
const report = await DailyReport.findOne({ storeId, date });

return res.json(report ?? null);
});

/* =====================================================
DÉTAIL D’UN BILAN
GET /sales/reports/:id
===================================================== */
export const getReportById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const { id } = req.params;
const report = await DailyReport.findOne({ _id: id, storeId });

if (!report) return next(new NotFoundError("Bilan introuvable"));

return res.json(report);
});
