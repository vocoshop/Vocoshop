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

export default mongoose.model<IStockHistory>(
"StockHistory",
StockHistorySchema
);
