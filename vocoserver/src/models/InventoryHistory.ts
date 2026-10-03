import mongoose from "mongoose";

const InventoryHistorySchema = new mongoose.Schema(
{
storeId: { type: String, required: true },
productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },

// "addition", "withdrawal", "inventory_end"
type: { type: String, required: true },

quantity: { type: Number, default: 0 },
},
{
timestamps: true, // <-- créé createdAt automatiquement
}
);

/* =====================================================
🔍 INDEX HISTORIQUE INVENTAIRE
===================================================== */

/* Flux d'inventaire d'une boutique, du plus récent au plus ancien */
InventoryHistorySchema.index({ storeId: 1, createdAt: -1 });

export default mongoose.model("InventoryHistory", InventoryHistorySchema);
