// src/controllers/inventoryController.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import mongoose from "mongoose";
import Product from "../models/Product";
import InventoryHistory from "../models/InventoryHistory";
import Order from "../models/Order";
import { getStoreId } from "../utils/storeId";

/* -------------------------------------------------------
HELPERS
------------------------------------------------------- */
function parseDate(v: any): Date | null {
if (!v) return null;
if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
if (typeof v === "string") {
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d;
}
return null;
}

function getNearestFutureExpiry(dates: any[]): Date | null {
if (!Array.isArray(dates) || dates.length === 0) return null;
const now = Date.now();
const future = dates
  .map((d) => new Date(d))
  .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > now)
  .sort((a, b) => a.getTime() - b.getTime());
return future.length > 0 ? future[0] : null;
}

async function applyStockToSentOrders(params: {
storeId: string;
productId: string;
qtyAdded: number;
}): Promise<{ applied: number; remaining: number; touchedOrders: number }> {
const { storeId, productId, qtyAdded } = params;
const sentOrders = await Order.find({
  storeId,
  status: "sent",
  "items.productId": productId,
}).sort({ createdAt: 1 });

let remaining = qtyAdded;
let applied = 0;
let touchedOrders = 0;

for (const order of sentOrders) {
  if (remaining <= 0) break;
  for (const item of order.items as any[]) {
    if (String(item.productId) === String(productId)) {
      const needed = (item.quantity || 0) - (item.receivedQuantity || 0);
      if (needed > 0) {
        const toApply = Math.min(needed, remaining);
        item.receivedQuantity = (item.receivedQuantity || 0) + toApply;
        remaining -= toApply;
        applied += toApply;
        touchedOrders++;
      }
    }
  }
  if (touchedOrders > 0) {
    const allReceived = (order.items as any[]).every(
      (it: any) => (it.receivedQuantity || 0) >= (it.quantity || 0)
    );
    order.status = allReceived ? "received" : ("partial" as any);
    await order.save();
  }
}

return { applied, remaining, touchedOrders };
}

export const addStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const { productId, quantity, expirationDate } = req.body as {
productId?: string;
quantity?: number;
expirationDate?: string;
};

if (!productId || !mongoose.Types.ObjectId.isValid(productId) || quantity == null) {
return next(new ValidationError("productId et quantity nécessaires"));
}

const product: any = await Product.findOne({
_id: productId,
storeId,
});

if (!product) {
return next(new NotFoundError("Produit introuvable"));
}

const qty = Number(quantity);
if (Number.isNaN(qty) || qty <= 0) {
return next(new ValidationError("quantity invalide"));
}

/* =====================================================
1️⃣ MISE À JOUR STOCK PRODUIT
===================================================== */
product.quantity = (product.quantity || 0) + qty;

const parsed = parseDate(expirationDate);
if (parsed) {
if (!Array.isArray(product.expirationDates)) {
product.expirationDates = [];
}
product.expirationDates.push(parsed);
}

await product.save();

/* =====================================================
2️⃣ HISTORIQUE STOCK
===================================================== */
await InventoryHistory.create({
storeId,
productId,
type: "addition",
quantity: qty,
});

/* =====================================================
3️⃣ HYBRIDE : APPLIQUER AUX COMMANDES "sent"
===================================================== */
const result = await applyStockToSentOrders({
storeId,
productId,
qtyAdded: qty,
});

return res.json({
message: "Stock ajouté",
product,
hybrid: {
appliedToOrders: result?.applied ?? 0,
remainingNotApplied: result?.remaining ?? 0,
touchedOrders: result?.touchedOrders ?? 0,
},
});

});

/* -------------------------------------------------------
🟥 RETRAIT DE STOCK
POST /api/inventory/remove
------------------------------------------------------- */
export const removeStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const { productId, quantity } = req.body as {
productId?: string;
quantity?: number;
};

if (!productId || !mongoose.Types.ObjectId.isValid(productId) || quantity == null) {
return next(new ValidationError("productId et quantity nécessaires"));
}

const product: any = await Product.findOne({ _id: productId, storeId });
if (!product) return next(new NotFoundError("Produit introuvable"));

const qty = Number(quantity);
if (Number.isNaN(qty) || qty <= 0) {
return next(new ValidationError("quantity invalide"));
}

if ((product.quantity || 0) < qty) {
return next(new ValidationError("Stock insuffisant"));
}

product.quantity = (product.quantity || 0) - qty;
await product.save();

await InventoryHistory.create({
storeId,
productId,
type: "withdrawal",
quantity: qty,
});

return res.json({ message: "Stock retiré", product });
});

/* -------------------------------------------------------
📉 STOCK FAIBLE
GET /api/inventory/low-stock
------------------------------------------------------- */
export const getLowStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const products: any[] = await Product.find({
storeId,
$expr: { $lte: ["$quantity", "$alertLevel"] },
}).lean();

return res.json(products);
});

/* -------------------------------------------------------
🕓 HISTORIQUE
GET /api/inventory/history
------------------------------------------------------- */
export const listHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const history = await InventoryHistory.find({ storeId })
.populate("productId", "name barcode")
.sort({ createdAt: -1 });

return res.json(history);
});

/* -------------------------------------------------------
📦 DIAGNOSTIC SANTÉ DU STOCK
GET /api/inventory/diagnostic
------------------------------------------------------- */
export const getStockDiagnostic = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const products: any[] = await Product.find({ storeId }).lean();

const lowStock = products.filter((p) => (p.quantity ?? 0) <= (p.alertLevel ?? 3));

const soonExpired = products.filter((p) => {
const nearest = getNearestFutureExpiry(p.expirationDates);
if (!nearest) return false;

const diffDays = (nearest.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
return diffDays >= 0 && diffDays <= 15;
});

return res.json({
lowStock,
soonExpired,
lowStockCount: lowStock.length,
soonExpiredCount: soonExpired.length,
});
});

/* -------------------------------------------------------
🧠 RECOMMANDATIONS STRATÉGIQUES
GET /api/inventory/recommendations
------------------------------------------------------- */
export const getRecommendations = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const products: any[] = await Product.find({ storeId }).lean();
const recommendations: any[] = [];

for (const p of products) {
// Stock faible
if ((p.quantity ?? 0) <= (p.alertLevel ?? 3)) {
recommendations.push({
title: `Stock faible : ${p.name}`,
description: "Réapprovisionnez ce produit.",
priority: "high",
});
}

// Expiration proche
const nearest = getNearestFutureExpiry(p.expirationDates);
if (nearest) {
const daysLeft = (nearest.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

if (daysLeft <= 20) {
recommendations.push({
title: `Expiration proche : ${p.name}`,
description: `Expire dans ~${Math.max(0, Math.round(daysLeft))} jours`,
priority: "high",
});
}
}
}

return res.json({ recommendations });
});
