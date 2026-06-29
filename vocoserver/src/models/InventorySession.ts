import mongoose, { Schema, Document } from "mongoose";

export interface IInventoryLine {
productId: mongoose.Types.ObjectId;
countedQuantity: number;
productName?: string;
category?: string;
countedBy?: mongoose.Types.ObjectId;
countedByName?: string;
}

export interface IInventorySession extends Document {
storeId: string;
employeeId: string;
status: "draft" | "validated" | "applied"; // ✅ AJOUT
lines: IInventoryLine[];
createdAt: Date;
completedAt?: Date; // quand l’employé valide
appliedAt?: Date; // ✅ quand le patron applique au stock
}

const InventoryLineSchema = new Schema<IInventoryLine>({
productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
countedQuantity: { type: Number, required: true },
productName: { type: String },
category: { type: String },
countedBy: { type: Schema.Types.ObjectId, ref: "User" },
countedByName: { type: String },
});

const InventorySessionSchema = new Schema<IInventorySession>(
{
storeId: { type: String, required: true },
employeeId: { type: String, required: true },

// ✅ AJOUT DE "applied"
status: {
type: String,
enum: ["draft", "validated", "applied"],
default: "draft",
},

lines: [InventoryLineSchema],

completedAt: { type: Date }, // validé par employé
appliedAt: { type: Date }, // ✔ appliqué au stock
},
{ timestamps: true }
);

export default mongoose.model<IInventorySession>(
"InventorySession",
InventorySessionSchema
);
