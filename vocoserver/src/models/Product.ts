// models/Product.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProduct extends Document {
storeId: string;
name: string;
category?: string;

// 💰 Prix de vente (champ officiel)
sellPrice: number;

// 🧾 Prix d'achat (utile pour marge)
purchasePrice: number;

quantity: number;
alertLevel: number;
barcode?: string;

// ✅ Plusieurs dates d'expiration possibles (V1 sans gestion de lot)
expirationDates: Date[];

// 🧠 Marge générée (sellPrice – purchasePrice)
profitMargin?: number;

// 🎙️ Alias vocaux pour la reconnaissance (prononciations alternatives, abréviations)
aliases: string[];

// 📊 Popularité (commandes vocales + ventes) pour tri intelligent


// 🏭 Fournisseur associé
supplierId?: Types.ObjectId;

createdAt?: Date;
updatedAt?: Date;
}

const ProductSchema = new Schema<IProduct>(
{
storeId: { type: String, required: true, index: true },

name: { type: String, required: true, trim: true },

category: { type: String, default: "" },

/**
* 💰 Prix de vente officiel
*/
sellPrice: { type: Number, default: 0 },

/**
* 🧾 Prix d'achat
*/
purchasePrice: { type: Number, default: 0 },

quantity: { type: Number, default: 0 },

alertLevel: { type: Number, default: 3 },

barcode: { type: String, trim: true, sparse: true },

/**
* ⏳ Dates d’expiration (accumulées)
* Exemple : [2025-01-10, 2025-01-25, 2025-02-03]
*/
expirationDates: {
type: [Date],
default: [],
},

/**
* 🧠 Marge bénéficiaire
*/
profitMargin: { type: Number, default: 0 },

/**
* 🎙️ Alias vocaux — prononciations alternatives, abréviations, fautes courantes
*/
aliases: {
type: [String],
default: [],
},

/**
* 📊 Popularité vocale
*/


supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
},
{ timestamps: true }
);

/* -------------------------------------------------------------
🔄 AUTO-CALCUL DE LA MARGE À LA SAUVEGARDE
------------------------------------------------------------- */
ProductSchema.pre("save", function (next) {
const sell = this.sellPrice ?? 0;
const purchase = this.purchasePrice ?? 0;
this.profitMargin = sell - purchase;
next();
});

/* -------------------------------------------------------------
🔄 AUTO-CALCUL DE LA MARGE SUR UPDATE MONGODB
------------------------------------------------------------- */
ProductSchema.pre("findOneAndUpdate", function (next) {
const update: any = this.getUpdate() || {};
const sell = update.sellPrice ?? update.$set?.sellPrice;
const purchase = update.purchasePrice ?? update.$set?.purchasePrice;

if (sell !== undefined || purchase !== undefined) {
const newSell = sell ?? 0;
const newPurchase = purchase ?? 0;

update.$set = update.$set || {};
update.$set.profitMargin = newSell - newPurchase;
}

next();
});

/* -------------------------------------------------------------
📌 INDEX
------------------------------------------------------------- */
ProductSchema.index({ storeId: 1, name: 1 });
ProductSchema.index({ storeId: 1, barcode: 1 }, { unique: true, sparse: true });

export default mongoose.model<IProduct>("Product", ProductSchema);
