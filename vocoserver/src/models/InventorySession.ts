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
status: "draft" | "validated" | "applied";
lines: IInventoryLine[];
createdAt: Date;
completedAt?: Date;
appliedAt?: Date;
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

/* =====================================================
🔍 INDEX SESSIONS INVENTAIRE
===================================================== */

/* Sessions d'une boutique, du plus récent au plus ancien */
InventorySessionSchema.index({ storeId: 1, createdAt: -1 });
/* Session courante d'un employé (statut draft/validated) */
InventorySessionSchema.index({ storeId: 1, employeeId: 1, createdAt: -1 });
/* Statut + date d'application (nettoyage des sessions appliquées) */
InventorySessionSchema.index({ storeId: 1, status: 1, appliedAt: -1 });

export default mongoose.model<IInventorySession>(
  "InventorySession",
  InventorySessionSchema
);
