// src/controllers/orderController.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import mongoose from "mongoose";
import Order from "../models/Order";
import Supplier from "../models/Supplier";
import { getStoreId } from "../utils/storeId";

/* -------------------------------------------------------
HELPERS
------------------------------------------------------- */
function safeNumber(v: any, fallback = 0): number {
const n = Number(v);
return Number.isFinite(n) ? n : fallback;
}

function cleanStr(v: any): string {
return typeof v === "string" ? v.trim() : "";
}

function isValidObjectId(id: string): boolean {
return /^[0-9a-fA-F]{24}$/.test(id);
}

function sanitizeItems(items: any[]): any[] {
if (!Array.isArray(items)) return [];
return items
  .filter((it: any) => it && it.productName && it.quantity > 0)
  .map((it: any) => ({
    name: String(it.productName).trim(),
    quantity: Math.max(1, Number(it.quantity) || 1),
    unitPrice: Math.max(0, Number(it.unitPrice) || 0),
    productId: it.productId || null,
  }));
}

async function resolveSupplier(
storeId: string,
supplierId?: string
): Promise<{ supplierId: string | null; supplierName: string }> {
if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) return { supplierId: null, supplierName: "" };
const supplier = await Supplier.findOne({ _id: supplierId, storeId }).lean();
if (!supplier) return { supplierId: null, supplierName: "" };
return { supplierId: String(supplier._id), supplierName: supplier.name || "" };
}

export const createOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId)
return next(new ValidationError("storeId manquant"));

const { items, note, totalEstimated, supplierId } = req.body;

const cleanItems = sanitizeItems(items);
const supplierSnapshot = await resolveSupplier(
storeId,
supplierId
);

const order = await Order.create({
storeId,
items: cleanItems,
note: note ?? "",
status: "draft",
supplierId: supplierSnapshot.supplierId,
supplierName: supplierSnapshot.supplierName,
totalEstimated: safeNumber(totalEstimated, 0),
});

return res.status(201).json(order);
});

/* =====================================================
📦 LIST ORDERS (AVEC PAGINATION)
===================================================== */
export const getOrders = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId)
return next(new ValidationError("storeId manquant"));

const filter: any = { storeId };

const status = cleanStr(req.query?.status);
if (status && ["draft", "sent", "received"].includes(status)) {
filter.status = status;
}

const supplierId = cleanStr(req.query?.supplierId);
if (supplierId && isValidObjectId(supplierId)) {
filter.supplierId = supplierId;
}

// Pagination
const page = Math.max(Number(req.query.page) || 1, 1);
const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

const total = await Order.countDocuments(filter);

const orders = await Order.find(filter)
.sort({ createdAt: -1 })
.skip((page - 1) * limit)
.limit(limit)
.lean();

return res.json({
page,
limit,
total,
totalPages: Math.ceil(total / limit),
orders,
});
});

/* =====================================================
📄 GET ONE ORDER
===================================================== */
export const getOrderById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId)
return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID commande invalide"));

const order = await Order.findOne({ _id: id, storeId }).lean();
if (!order)
return next(new NotFoundError("Commande introuvable"));

return res.json(order);
});

/* =====================================================
✏️ UPDATE ORDER (DRAFT ONLY)
===================================================== */
export const updateOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId)
return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID commande invalide"));
const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return next(new NotFoundError("Commande introuvable"));

if (order.status !== "draft") {
return next(new ValidationError("Commande non modifiable (déjà envoyée)"));
}

const { items, note, totalEstimated, supplierId } =
req.body;

if (items !== undefined)
order.items = sanitizeItems(items);

if (note !== undefined) order.note = note;

if (totalEstimated !== undefined) {
order.totalEstimated = safeNumber(totalEstimated, 0);
}

if (supplierId !== undefined) {
const supplierSnapshot = await resolveSupplier(
storeId,
supplierId
);
order.supplierId = supplierSnapshot.supplierId;
order.supplierName = supplierSnapshot.supplierName;
}

await order.save();
return res.json(order);
});

/* =====================================================
✅ CONFIRM ORDER (DRAFT → SENT)
===================================================== */
export const confirmOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId)
return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID commande invalide"));
const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return next(new NotFoundError("Commande introuvable"));

if (order.status !== "draft") {
return next(new ValidationError("Commande déjà confirmée"));
}

if (!order.items || order.items.length === 0) {
return next(new ValidationError("Impossible de confirmer une commande vide"));
}

order.status = "sent";
order.sentAt = new Date();
order.receivedAt = null;

await order.save();
return res.json(order);
});

/* =====================================================
🗑 DELETE ORDER (DRAFT ONLY)
===================================================== */
export const deleteOrder = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId)
return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID commande invalide"));
const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return next(new NotFoundError("Commande introuvable"));

if (order.status !== "draft") {
return next(new ValidationError("Impossible de supprimer une commande confirmée"));
}

await order.deleteOne();

return res.json({ message: "Commande supprimée" });

});

/* =====================================================
✅ MARK RECEIVED (MANUAL)
===================================================== */
export const markOrderReceived = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId)
return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID commande invalide"));

const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return next(new NotFoundError("Commande introuvable"));

if (order.status !== "sent") {
return next(new ValidationError("Seules les commandes envoyées peuvent être marquées reçues"));
}

// réception complète forcée
order.items.forEach((it: any) => {
it.receivedQty = it.quantity;
});

order.status = "received";
order.receivedAt = new Date();

await order.save();

return res.json(order);

});
