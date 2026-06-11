// models/DailyReport.ts
import mongoose, { Schema, Document } from "mongoose";

/* -------------------------------------------------------
INTERFACES
------------------------------------------------------- */
export interface IDailyReport extends Document {
storeId: string;
date: string; // YYYY-MM-DD (date métier)

// 🔢 VENTES
totalSales: number; // nombre total de ventes (tickets)
totalRevenue: number; // chiffre d’affaires total (CA)

// 💰 PROFIT (clé micro-finance)
cogs: number; // Cost Of Goods Sold (coût d’achat des produits vendus)
grossProfit: number; // CA - COGS
netProfit: number; // pour l’instant = grossProfit (plus tard - charges)

// 📊 MARGE (source de vérité)
marginPercent: number; // (grossProfit / totalRevenue) * 100 ; si CA=0 => 0

// 🧾 DÉTAIL DES VENTES (agrégées)
sales: {
productId?: string;
productName: string;
quantity: number;
unitPrice: number; // vente unitaire
purchasePrice: number; // achat unitaire (clé finance)
totalAmount: number; // quantity * unitPrice
lineProfit: number; // (unitPrice - purchasePrice) * quantity
}[];

createdAt: Date;
updatedAt: Date;
}

/* -------------------------------------------------------
SCHEMA
------------------------------------------------------- */
const DailyReportSchema = new Schema<IDailyReport>(
{
storeId: { type: String, required: true, index: true },

date: {
type: String, // ex: "2026-01-25"
required: true,
index: true,
},

// ======================
// VENTES
// ======================
totalSales: { type: Number, required: true, default: 0, min: 0 },
totalRevenue: { type: Number, required: true, default: 0, min: 0 },

// ======================
// PROFIT (FINANCE)
// ======================
cogs: { type: Number, required: true, default: 0, min: 0 },
grossProfit: { type: Number, required: true, default: 0 },
netProfit: { type: Number, required: true, default: 0 },

// ======================
// MARGE
// ======================
marginPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },

// ======================
// DÉTAIL DES VENTES
// ======================
sales: [
{
productId: { type: String },
productName: { type: String, required: true },

quantity: { type: Number, required: true, default: 0, min: 0 },
unitPrice: { type: Number, required: true, default: 0, min: 0 },
purchasePrice: { type: Number, required: true, default: 0, min: 0 },

totalAmount: { type: Number, required: true, default: 0, min: 0 },
lineProfit: { type: Number, required: true, default: 0 },
},
],
},
{ timestamps: true }
);

/* -------------------------------------------------------
MIDDLEWARE (source de vérité)
- Recalcule marge à chaque save/update
------------------------------------------------------- */
function clamp(n: number, min: number, max: number) {
return Math.max(min, Math.min(max, n));
}

DailyReportSchema.pre("save", function (next) {
const doc: any = this;

const revenue = Number(doc.totalRevenue) || 0;
const gross = Number(doc.grossProfit) || 0;

const margin = revenue > 0 ? (gross / revenue) * 100 : 0;

// borne 0..100 (si tu veux autoriser >100, enlève clamp)
doc.marginPercent = clamp(Number.isFinite(margin) ? margin : 0, 0, 100);

next();
});

// IMPORTANT: findOneAndUpdate ne déclenche pas "save", donc on recalc ici aussi
DailyReportSchema.pre("findOneAndUpdate", function (next) {
const update: any = this.getUpdate() || {};
const $set = update.$set || update;

const revenue = Number($set.totalRevenue ?? 0) || 0;
const gross = Number($set.grossProfit ?? 0) || 0;

const margin = revenue > 0 ? (gross / revenue) * 100 : 0;
const computed = clamp(Number.isFinite(margin) ? margin : 0, 0, 100);

// inject dans $set
if (update.$set) update.$set.marginPercent = computed;
else update.marginPercent = computed;

this.setUpdate(update);
next();
});

/* -------------------------------------------------------
INDEXES
------------------------------------------------------- */
DailyReportSchema.index({ storeId: 1, date: 1 }, { unique: true });
DailyReportSchema.index({ storeId: 1, date: -1 });
DailyReportSchema.index({ storeId: 1, createdAt: -1 });

/* -------------------------------------------------------
MODEL
------------------------------------------------------- */
const DailyReport = mongoose.model<IDailyReport>("DailyReport", DailyReportSchema);
export default DailyReport;
