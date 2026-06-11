// models/Sales.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ISale extends Document {
storeId: string;

productId: string; // Product._id en string
productName: string;

quantity: number;

unitPrice: number; // prix de vente unitaire (au moment de la vente)
purchasePriceAtSale: number; // prix d’achat figé (au moment de la vente)

totalAmount: number; // quantity * unitPrice

businessDate: string; // YYYY-MM-DD (date métier)

// ✅ NOUVEAUX CHAMPS VOICE
isVoiced: boolean;
isReverted: boolean;

createdAt?: Date;
updatedAt?: Date;
}

const SaleSchema = new Schema<ISale>(
{
storeId: { type: String, required: true, index: true },

productId: {
type: String,
required: true,
ref: "Product",
index: true,
},

productName: { type: String, required: true, trim: true },

quantity: { type: Number, required: true, min: 1 },

unitPrice: { type: Number, required: true, min: 0 },

purchasePriceAtSale: {
type: Number,
required: true,
default: 0,
min: 0,
},

totalAmount: { type: Number, required: true, min: 0 },

businessDate: { type: String, required: true, index: true },

// =====================================================
// 🔊 VOICE FLAGS (PRO AUDIT SAFE)
// =====================================================
isVoiced: {
type: Boolean,
default: false,
index: true,
},

isReverted: {
type: Boolean,
default: false,
index: true,
},
},
{ timestamps: true }
);

/* ----------------------------------------------------
INDEXES
---------------------------------------------------- */

// Liste du jour + tri
SaleSchema.index({ storeId: 1, businessDate: 1, createdAt: -1 });

// Historique récent
SaleSchema.index({ storeId: 1, createdAt: -1 });

// 🔊 Index optimisé pour UNDO rapide
SaleSchema.index({ storeId: 1, isVoiced: 1, isReverted: 1, createdAt: -1 });

export default mongoose.model<ISale>("Sale", SaleSchema);
