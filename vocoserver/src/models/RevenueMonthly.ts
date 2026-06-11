import mongoose from "mongoose";

/**
=====================================================
📊 REVENUE MONTHLY MODEL — VOCOSHOP ANALYTICS V2
✔ MRR tracking
✔ Growth ready
✔ Churn ready
✔ Investisseur grade
=====================================================
*/

const revenueMonthlySchema = new mongoose.Schema(
{
/* =====================================================
📅 MOIS FORMAT YYYY-MM
===================================================== */
month: {
type: String,
required: true,
unique: true,
index: true,
match: /^\d{4}-\d{2}$/,
},

/* =====================================================
💰 TOTAL REVENUE
===================================================== */
totalRevenue: {
type: Number,
default: 0,
},

/* =====================================================
🔁 TOTAL PAIEMENTS
===================================================== */
subscriptionCount: {
type: Number,
default: 0,
},

/* =====================================================
🆕 NOUVEAUX CLIENTS
===================================================== */
newSubscriptions: {
type: Number,
default: 0,
},

/* =====================================================
🔄 RENOUVELLEMENTS
===================================================== */
renewals: {
type: Number,
default: 0,
},

/* =====================================================
📉 CHURN (préparation future)
===================================================== */
churnCount: {
type: Number,
default: 0,
},

/* =====================================================
📈 REVENU MOYEN PAR CLIENT (optionnel)
===================================================== */
averageRevenue: {
type: Number,
default: 0,
},
},
{
timestamps: true,
}
);

/* =====================================================
🔥 AUTO CALCUL averageRevenue
===================================================== */
revenueMonthlySchema.pre("save", function (next) {
if (this.subscriptionCount > 0) {
this.averageRevenue =
this.totalRevenue / this.subscriptionCount;
} else {
this.averageRevenue = 0;
}
next();
});

export default mongoose.model(
"RevenueMonthly",
revenueMonthlySchema,
"revenue_monthly"
);
