import mongoose, { Schema, Document } from "mongoose";

export interface IStockLot extends Document {
storeId: string;
productId: mongoose.Types.ObjectId;

lotNumber?: string; // ex: "LOT-2026-001"
expirationDate?: Date | null; // optionnel selon produit
quantity: number;

createdAt?: Date;
updatedAt?: Date;
}

const StockLotSchema = new Schema<IStockLot>(
{
storeId: { type: String, required: true, index: true },

productId: {
type: Schema.Types.ObjectId,
ref: "Product",
required: true,
index: true,
},

lotNumber: { type: String, default: "", trim: true },

expirationDate: { type: Date, default: null },

quantity: { type: Number, default: 0 },
},
{ timestamps: true }
);

// Index utile pour trier par date rapidement
StockLotSchema.index({ storeId: 1, productId: 1, expirationDate: 1 });

export default mongoose.model<IStockLot>("StockLot", StockLotSchema);
