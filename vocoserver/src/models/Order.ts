// src/models/Order.ts
import mongoose, { Schema, Document } from "mongoose";

export type OrderStatus = "draft" | "sent" | "received";

/* =====================================================
📦 ORDER ITEM
===================================================== */
export interface IOrderItem {
productId: mongoose.Types.ObjectId;
name: string; // snapshot produit
quantity: number;
unitPrice?: number; // prix fournisseur

// Suivi réception
receivedQty?: number; // quantité reçue via stock
}

/* =====================================================
📄 ORDER
===================================================== */
export interface IOrder extends Document {
storeId: string;

supplierId?: mongoose.Types.ObjectId;
supplierName?: string;
supplier?: string; // legacy

status: OrderStatus;

items: IOrderItem[];

totalEstimated?: number;
createdBy?: string;

sentAt?: Date | null;
receivedAt?: Date | null;

createdAt?: Date;
updatedAt?: Date;
}

/* =====================================================
📦 ITEM SCHEMA
===================================================== */
const OrderItemSchema = new Schema<IOrderItem>(
{
productId: {
type: Schema.Types.ObjectId,
ref: "Product",
required: true,
},

name: {
type: String,
required: true,
trim: true,
},

quantity: {
type: Number,
required: true,
min: 1,
},

unitPrice: {
type: Number,
default: 0,
min: 0,
},

receivedQty: {
type: Number,
default: 0,
min: 0,
},
},
{ _id: false }
);

/* =====================================================
📄 ORDER SCHEMA
===================================================== */
const OrderSchema = new Schema<IOrder>(
{
storeId: {
type: String,
required: true,
index: true,
},

supplierId: {
type: Schema.Types.ObjectId,
ref: "Supplier",
index: true,
},

supplierName: {
type: String,
trim: true,
},

supplier: {
type: String,
trim: true,
},

status: {
type: String,
enum: ["draft", "sent", "received"],
default: "draft",
index: true,
},

items: {
type: [OrderItemSchema],
default: [],
},

totalEstimated: {
type: Number,
default: 0,
min: 0,
},

createdBy: {
type: String,
},

sentAt: {
type: Date,
default: null,
index: true,
},

receivedAt: {
type: Date,
default: null,
index: true,
},
},
{ timestamps: true }
);

/* =====================================================
🧮 HELPERS
===================================================== */
function clampReceivedQty(items: any[]) {
for (const it of items) {
const qty = Number(it.quantity) || 0;
const rcv = Number(it.receivedQty) || 0;

if (rcv < 0) it.receivedQty = 0;
else if (rcv > qty) it.receivedQty = qty;
else it.receivedQty = rcv;
}
}

function computeTotalEstimated(items: any[]) {
return (items || []).reduce((sum: number, it: any) => {
const qty = Number(it.quantity) || 0;
const price = Number(it.unitPrice) || 0;
return sum + qty * price;
}, 0);
}

/* =====================================================
🔄 PRE SAVE
===================================================== */
OrderSchema.pre("save", function (next) {
const items = Array.isArray((this as any).items)
? (this as any).items
: [];

clampReceivedQty(items);

(this as any).totalEstimated = computeTotalEstimated(items);

next();
});

/* =====================================================
📌 INDEXES
===================================================== */
OrderSchema.index({ storeId: 1, status: 1 });
OrderSchema.index({ storeId: 1, createdAt: -1 });
OrderSchema.index({ storeId: 1, sentAt: -1 });
OrderSchema.index({ storeId: 1, receivedAt: -1 });
OrderSchema.index({ storeId: 1, supplierId: 1, createdAt: -1 });
OrderSchema.index({ storeId: 1, "items.productId": 1, status: 1 });

export default mongoose.model<IOrder>("Order", OrderSchema);
