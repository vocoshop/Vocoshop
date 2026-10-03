import mongoose from "mongoose";

/**
=====================================================
📄 MODEL FACTURE — VOCOSHOP V2 PRODUCTION READY
✔ Compatible collection "factures"
✔ Numéro unique
✔ Gestion périodes facturation
✔ Historique paiements
✔ Prêt pour PDF SaaS pro
=====================================================
*/

const invoiceSchema = new mongoose.Schema({

/* =====================================================
🏪 BOUTIQUE
===================================================== */
storeId: {
type: mongoose.Schema.Types.ObjectId,
ref: "Store",
required: true,
index: true
},

/* =====================================================
🔢 NUMÉRO FACTURE UNIQUE
===================================================== */
invoiceNumber: {
type: String,
required: true,
unique: true,
index: true
},

/* =====================================================
📦 PLAN FACTURÉ
===================================================== */
plan: {
type: String,
default: "PRO"
},

/* =====================================================
💰 MONTANT
===================================================== */
amount: {
type: Number,
required: true,
default: 0
},

/* =====================================================
💱 DEVISE
===================================================== */
currency: {
type: String,
default: "XAF"
},

/* =====================================================
🗓 PÉRIODE FACTURATION (IMPORTANT SaaS)
===================================================== */
billingPeriodStart: {
type: Date,
required: true,
index: true
},

billingPeriodEnd: {
type: Date,
required: true,
index: true
},

/* =====================================================
💳 INFOS PAIEMENT
===================================================== */
paidAt: {
type: Date,
default: Date.now
},

transactionId: {
type: String,
default: null,
index: true
}

}, {
  timestamps: true // createdAt + updatedAt auto
});

/* =====================================================
🔍 INDEX FACTURES
===================================================== */

/* Liste des paiements : tri paidAt décroissant */
invoiceSchema.index({ paidAt: -1, _id: -1 });
/* Factures d'une boutique */
invoiceSchema.index({ storeId: 1, paidAt: -1 });
/* Agrégat revenus mensuels (paidAt + fallback createdAt) */
invoiceSchema.index({ createdAt: -1 });


/**
🔥 IMPORTANT
Force mongoose à utiliser la collection existante :
➡️ "factures"
*/
export default mongoose.model(
"Invoice",
invoiceSchema,
"factures"
);
