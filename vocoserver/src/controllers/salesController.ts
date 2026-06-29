// controllers/salesController.ts
import { Request, Response } from "express";
import Product from "../models/Product";
import Sale from "../models/Sales";
import DailyReport from "../models/DailyReport";
import Store from "../models/Store";
import { getStoreId } from "../utils/storeId";
import { getBusinessDate, safeNum as n, isValidObjectId } from "../utils/helpers";

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
export const addSale = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
const { productId, quantity, isVoiced } = req.body;

if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const qty = n(quantity);
if (!productId || !isValidObjectId(productId) || qty <= 0) {
return res.status(400).json({ error: "Données invalides" });
}

const product: any = await Product.findOne({ _id: productId, storeId });
if (!product) return res.status(404).json({ error: "Produit introuvable" });

if (n(product.quantity) < qty) {
return res.status(400).json({ error: "Stock insuffisant" });
}

const businessDate = getBusinessDate();

const sellPrice = n(product.sellPrice);
const purchasePriceAtSale = n(product.purchasePrice); // ✅ figé à la vente

const sale = await Sale.create({
storeId,
productId,
productName: product.name,
quantity: qty,
unitPrice: sellPrice,
totalAmount: qty * sellPrice,
purchasePriceAtSale, // ✅ AJOUT (clé microfinance)
businessDate,

isVoiced: !!isVoiced, // pour différencier vente classique vs vente vocale (UNDO plus tard)
isReverted: false, // pour marquer une vente comme annulée (historique stable)
});

product.quantity = n(product.quantity) - qty;
await product.save();
await touchStoreActivity(storeId);

return res.json({ message: "Vente enregistrée", sale });
} catch (err) {
console.error("❌ addSale:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
VENTES PANIER (prix achat figé)
===================================================== */
export const addCartSales = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
const { items } = req.body;

if (!storeId || !Array.isArray(items) || items.length === 0) {
return res.status(400).json({ error: "Panier invalide" });
}

let totalAmount = 0;
const businessDate = getBusinessDate();

for (const item of items) {
const qty = n(item?.quantity);
const productId = item?.productId;

if (!productId || !isValidObjectId(productId) || qty <= 0) {
return res.status(400).json({ error: "Panier invalide" });
}

const product: any = await Product.findOne({ _id: productId, storeId });
if (!product || n(product.quantity) < qty) {
return res.status(400).json({ error: "Stock insuffisant" });
}

const sellPrice = n(product.sellPrice);
const purchasePriceAtSale = n(product.purchasePrice); // ✅ figé

await Sale.create({
storeId,
productId: String(product._id),
productName: product.name,
quantity: qty,
unitPrice: sellPrice,
totalAmount: qty * sellPrice,
purchasePriceAtSale, // ✅ AJOUT
businessDate,
});

product.quantity = n(product.quantity) - qty;
await product.save();

totalAmount += qty * sellPrice;
}

await touchStoreActivity(storeId);

return res.json({ message: "Ventes enregistrées", totalAmount });
} catch (err) {
console.error("❌ addCartSales:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
REVERT SALE (Voice UNDO)
===================================================== */

export const revertSale = async (req: Request, res: Response) => {
try {
const storeId = (req as any).user?.storeId;

if (!storeId) {
return res.status(400).json({ error: "Store invalide" });
}

// 🔎 Cherche la dernière vente vocale non annulée
const sale: any = await Sale.findOne({
storeId,
isVoiced: true,
isReverted: false,
}).sort({ createdAt: -1 });

if (!sale) {
return res.status(404).json({ error: "Aucune vente vocale récente" });
}

// ⏳ Sécurité temporelle (2 minutes max)
const twoMinutesAgo = Date.now() - 2 * 60 * 1000;

if (sale.createdAt.getTime() < twoMinutesAgo) {
return res.status(400).json({
error: "Délai dépassé pour annulation",
});
}

// 🔁 Marque annulée (audit propre)
sale.isReverted = true;
await sale.save();

// 🔄 Recréditer le stock
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

} catch (err) {
console.error("❌ revertSale error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
VENTES DU JOUR (AVANT CLÔTURE)
===================================================== */
export const getTodaySales = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const date = getBusinessDate();

const sales: any[] = await Sale.find({ storeId, businessDate: date }).lean();
const totalRevenue = sales.reduce((sum, s) => sum + n(s.totalAmount), 0);

return res.json({
date,
totalSales: sales.length,
totalRevenue,
sales,
});
} catch (err) {
console.error("❌ getTodaySales:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
CLÔTURE JOURNÉE (PROFIT RÉEL - FIABLE)
- utilise purchasePriceAtSale (figé) -> historique stable
===================================================== */
export const closeDaySales = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

  const date = getBusinessDate();

  // 0) store owner phone pour notification automatique
  const storeInfo = await Store.findOne({ shopId: storeId }).select("ownerPhone").lean();
  const ownerPhone = storeInfo?.ownerPhone || "";

  // 1) ventes en attente (du jour)
const newSales: any[] = await Sale.find({ storeId, businessDate: date }).lean();
if (!newSales.length) {
return res.status(400).json({ error: "Aucune nouvelle vente à clôturer" });
}

// 2) bilan existant (si déjà clôturé)
const existing: any = await DailyReport.findOne({ storeId, date }).lean();

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
{ storeId, date },
{
storeId,
date,
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

// 6) supprimer ventes “en attente”
await Sale.deleteMany({ storeId, businessDate: date });

await touchStoreActivity(storeId);

  return res.json({ message: "Journée clôturée (profit réel calculé)", report, userName: req.user?.name || "", userRole: req.user?.role || "" });
} catch (err) {
console.error("❌ closeDaySales:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
HISTORIQUE
===================================================== */
export const getDailyReports = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

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
} catch (err) {
console.error("❌ getDailyReports:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
RAPPORT DU JOUR (APRÈS CLÔTURE)
===================================================== */
export const getTodayReport = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const date = getBusinessDate();
const report = await DailyReport.findOne({ storeId, date });

return res.json(report ?? null);
} catch (err) {
console.error("❌ getTodayReport:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
DÉTAIL D’UN BILAN
GET /sales/reports/:id
===================================================== */
export const getReportById = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
const report = await DailyReport.findOne({ _id: id, storeId });

if (!report) return res.status(404).json({ error: "Bilan introuvable" });

return res.json(report);
} catch (err) {
console.error("❌ getReportById:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
