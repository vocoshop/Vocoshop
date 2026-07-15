// models/Product.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPurchaseConfig {
  name: string;          // "Casier", "Carton"
  quantity: number;      // 24, 12
  purchasePrice: number; // 12000, 6000
}

export interface ISellConfig {
  name: string;          // "Bouteille", "Pack", "Casier"
  quantity: number;      // 1, 6, 24
  sellPrice: number;     // 700, 4500, 16000
}

export interface IProduct extends Document {
  storeId: string;
  name: string;
  category?: string;

  // 💰 Prix de vente unitaire (dans l'unité de base)
  sellPrice: number;

  // 🧾 Prix d'achat unitaire (dans l'unité de base)
  purchasePrice: number;

  quantity: number;
  alertLevel: number;
  barcode?: string;

  // ✅ Plusieurs dates d'expiration possibles
  expirationDates: Date[];

  // 🧠 Marge générée (sellPrice – purchasePrice)
  profitMargin?: number;

  // 📐 Unité de base (bouteille, kg, L, pièce)
  baseUnit?: string;

  // 📐 Unité de mesure (legacy)
  unit?: string;

  // 🎙️ Alias vocaux
  aliases: string[];

  // 📦 Conditionnements d'achat
  purchaseConfigs: IPurchaseConfig[];

  // 🛒 Modes de vente
  sellConfigs: ISellConfig[];

// 🏭 Fournisseur associé
supplierId?: Types.ObjectId;

// 📸 Photo du produit
imageUrl?: string;

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
* 📐 Unité de mesure
*/
unit: { type: String, default: "pièce", trim: true },

    /**
     * 📐 Unité de base (bouteille, kg, L, pièce)
     */
    baseUnit: { type: String, default: "", trim: true },

    /**
     * 🎙️ Alias vocaux
     */
    aliases: {
      type: [String],
      default: [],
    },

    /**
     * 📦 Conditionnements d'achat
     * Ex: [{ name: "Casier", quantity: 24, purchasePrice: 12000 }]
     */
    purchaseConfigs: {
      type: [{
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        purchasePrice: { type: Number, required: true, min: 0 },
      }],
      default: [],
    },

    /**
     * 🛒 Modes de vente
     * Ex: [{ name: "Bouteille", quantity: 1, sellPrice: 700 }]
     */
    sellConfigs: {
      type: [{
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        sellPrice: { type: Number, required: true, min: 0 },
      }],
      default: [],
    },

    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },

    imageUrl: { type: String, default: "" },
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
  if (!this.baseUnit && this.unit) this.baseUnit = this.unit;
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
