// controllers/storeKpisController.ts
import { Request, Response } from "express";
import Product from "../models/Product";
import { getStoreId } from "../utils/storeId";

/**
* KPIs boutique (V1)
* - Ne calcule PAS encore le bénéfice (profit) -> on le fera quand purchasePrice sera rempli.
* - Tout est filtré par storeId depuis req.user (storeAuth)
*/
export const getStoreKpis = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req as any);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

// 1) Produits
const totalProducts = await Product.countDocuments({ storeId });

// 2) Stock total + Valeur estimée (en 1 seule aggregation)
const agg = await Product.aggregate([
{ $match: { storeId } },
{
$group: {
_id: null,
totalStockQty: { $sum: { $ifNull: ["$quantity", 0] } },
estimatedStockValue: {
$sum: {
$multiply: [
{ $ifNull: ["$quantity", 0] },
{ $ifNull: ["$sellPrice", 0] },
],
},
},
},
},
]);

const totalStockQty = agg?.[0]?.totalStockQty ?? 0;
const estimatedStockValue = agg?.[0]?.estimatedStockValue ?? 0;

// 3) Stock faible : quantity <= alertLevel
const lowStockCount = await Product.countDocuments({
storeId,
$expr: { $lte: ["$quantity", "$alertLevel"] },
});

// 4) Bientôt expirés (au moins une date dans X jours)
const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const limitDate = new Date(today);
limitDate.setDate(today.getDate() + days);

const expiringCount = await Product.countDocuments({
storeId,
expirationDates: { $elemMatch: { $gte: today, $lte: limitDate } },
});

return res.json({
totalProducts,
totalStockQty,
estimatedStockValue, // ✅ valeur estimée (vente)
lowStockCount,
expiringCount,
daysWindow: days,
});
} catch (err) {
console.error("❌ getStoreKpis:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
