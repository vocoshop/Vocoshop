// src/controllers/orderController.ts
import { Request, Response } from "express";
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
    productName: String(it.productName).trim(),
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

export const createOrder = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

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
} catch (err) {
console.error("❌ createOrder error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
📦 LIST ORDERS (AVEC PAGINATION)
===================================================== */
export const getOrders = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

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
} catch (err) {
console.error("❌ getOrders error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
📄 GET ONE ORDER
===================================================== */
export const getOrderById = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
if (!isValidObjectId(id)) return res.status(400).json({ error: "ID commande invalide" });

const order = await Order.findOne({ _id: id, storeId }).lean();
if (!order)
return res.status(404).json({ error: "Commande introuvable" });

return res.json(order);
} catch (err) {
console.error("❌ getOrderById error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
✏️ UPDATE ORDER (DRAFT ONLY)
===================================================== */
export const updateOrder = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
if (!isValidObjectId(id)) return res.status(400).json({ error: "ID commande invalide" });
const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return res.status(404).json({ error: "Commande introuvable" });

if (order.status !== "draft") {
return res.status(400).json({
error: "Commande non modifiable (déjà envoyée)",
});
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
} catch (err) {
console.error("❌ updateOrder error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
✅ CONFIRM ORDER (DRAFT → SENT)
===================================================== */
export const confirmOrder = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
if (!isValidObjectId(id)) return res.status(400).json({ error: "ID commande invalide" });
const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return res.status(404).json({ error: "Commande introuvable" });

if (order.status !== "draft") {
return res.status(400).json({
error: "Commande déjà confirmée",
});
}

if (!order.items || order.items.length === 0) {
return res.status(400).json({
error: "Impossible de confirmer une commande vide",
});
}

order.status = "sent";
order.sentAt = new Date();
order.receivedAt = null;

await order.save();
return res.json(order);
} catch (err) {
console.error("❌ confirmOrder error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
🗑 DELETE ORDER (DRAFT ONLY)
===================================================== */
export const deleteOrder = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
if (!isValidObjectId(id)) return res.status(400).json({ error: "ID commande invalide" });
const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return res.status(404).json({ error: "Commande introuvable" });

if (order.status !== "draft") {
return res.status(400).json({
error: "Impossible de supprimer une commande confirmée",
});
}

await order.deleteOne();

return res.json({ message: "Commande supprimée" });

} catch (err) {
console.error("❌ deleteOrder error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};


/* =====================================================
✅ MARK RECEIVED (MANUAL)
===================================================== */
export const markOrderReceived = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
if (!isValidObjectId(id)) return res.status(400).json({ error: "ID commande invalide" });

const order: any = await Order.findOne({ _id: id, storeId });

if (!order)
return res.status(404).json({ error: "Commande introuvable" });

if (order.status !== "sent") {
return res.status(400).json({
error:
"Seules les commandes envoyées peuvent être marquées reçues",
});
}

// réception complète forcée
order.items.forEach((it: any) => {
it.receivedQty = it.quantity;
});

order.status = "received";
order.receivedAt = new Date();

await order.save();

return res.json(order);

} catch (err) {
console.error("❌ markOrderReceived error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};