import mongoose, { Schema, Document } from "mongoose";

export interface IInventory extends Document {
productId: string;
storeId: string;
type: "add" | "remove";
quantity: number;
date: Date;
}

const InventorySchema = new Schema<IInventory>({
productId: { type: String, required: true },
storeId: { type: String, required: true },
type: { type: String, enum: ["add", "remove"], required: true },
quantity: { type: Number, required: true },
date: { type: Date, default: Date.now },
});

export default mongoose.model<IInventory>("Inventory", InventorySchema);
