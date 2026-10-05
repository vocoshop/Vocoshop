import mongoose from "mongoose";
import crypto from "crypto";

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
},

/* =====================================================
🔐 JETON PUBLIC (CAPABILITY URL)
=====================================================
➡️ invoiceNumber reste lisible par lhumain (VOC-2026-482913)
➡️ publicToken est le secret non devinable du QR code
➡️Sans ce jeton, /api/invoices/public/:n refuse de répondre
➡️Généré automatiquement (aucun appelant à modifier)
*/
publicToken: {
type: String,
default: () => crypto.randomBytes(24).toString("hex"),
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
