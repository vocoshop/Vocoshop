import mongoose, { Schema, Document } from "mongoose";

export interface IStockHistory extends Document {
storeId: string;
sessionId: string;

productId: string;
productName: string;
category?: string;

previousQuantity: number; // 🔥 remplacé
newQuantity: number; // 🔥 remplacé
diff: number;

appliedAt: Date;
validatedBy: string | null;
}

const StockHistorySchema = new Schema<IStockHistory>(
{
storeId: { type: String, required: true },
sessionId: { type: String, required: true },

productId: { type: String, required: true },
productName: { type: String, required: true },
category: { type: String },

previousQuantity: { type: Number, required: true }, // 🔥 CORRECTION
newQuantity: { type: Number, required: true }, // 🔥 CORRECTION
diff: { type: Number, required: true },

appliedAt: { type: Date, required: true },
validatedBy: { type: String, default: null },
},
{
timestamps: true,
}
);

/* =====================================================
🔍 INDEX HISTORIQUE STOCK
===================================================== */

/* Historique d'une boutique, du plus récent au plus ancien */
StockHistorySchema.index({ storeId: 1, appliedAt: -1 });
/* Historique d'une session d'inventaire */
StockHistorySchema.index({ sessionId: 1, storeId: 1 });
/* Regroupements par produit sur une fenêtre de dates */
StockHistorySchema.index({ storeId: 1, productId: 1, appliedAt: -1 });

export default mongoose.model<IStockHistory>(
  "StockHistory",
  StockHistorySchema
);
