import mongoose, { Schema, Document } from "mongoose";

export interface IProductAlias extends Document {
  storeId: string;
  productId: string;
  rawText: string;
  normalizedName: string;
  frequency: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductAliasSchema = new Schema<IProductAlias>(
  {
    storeId: { type: String, required: true, index: true },
    productId: { type: String, required: true },
    rawText: { type: String, required: true },
    normalizedName: { type: String, required: true },
    frequency: { type: Number, default: 1 },
    lastUsed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ProductAliasSchema.index({ storeId: 1, rawText: 1 }, { unique: true });
ProductAliasSchema.index({ storeId: 1, normalizedName: 1 });

export default mongoose.model<IProductAlias>("ProductAlias", ProductAliasSchema);
