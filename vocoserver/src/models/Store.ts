// models/Store.ts

import mongoose, { Schema, Document } from "mongoose";

/* =====================================================
🧠 INTERFACE
===================================================== */

export interface IStore extends Document {
phone: string;

storeName?: string;
city?: string;
agentCode?: string;

ownerName?: string;
ownerPhone?: string;

deviceId?: string;
deviceLastChangedAt?: Date | null;
deviceChangeCount: number;

passwordHash?: string | null;

shopId: string;

/* =========================
📦 ABONNEMENT
========================= */
plan: string;
subscriptionStatus: string;

paidUntil?: Date | null;
graceUntil?: Date | null;
trialEnd?: Date | null;

autoRenew: boolean;
billingCycleCount: number;
lastPaymentId?: string | null;

/* =========================
🎯 REFERRAL ENGINE
========================= */
referralCode: string;
referredCount: number;
paidReferrals: number;

referralCodeUsed?: string;
referralRewarded: boolean;

/* =========================
📊 ACTIVITÉ
========================= */
installedAt?: Date;
lastActiveAt?: Date;
loginCount: number;

isOnboarded: boolean;

createdAt?: Date;
updatedAt?: Date;
}

/* =====================================================
🛠 HELPERS
===================================================== */

function generateShopId(): string {
const code = Math.random().toString(16).slice(2, 8).toUpperCase();
return `VOC-${code}`;
}

/* =====================================================
📦 SCHEMA
===================================================== */

const StoreSchema = new Schema<IStore>(
{
/* =========================
📱 IDENTITÉ
========================= */

phone: {
type: String,
required: true,
unique: true,
trim: true,
index: true,
},

storeName: { type: String, trim: true },
city: { type: String, default: "", trim: true },
agentCode: { type: String, default: "", trim: true },

ownerName: { type: String, trim: true },
ownerPhone: { type: String, trim: true },

/* =========================
📱 DEVICE CONTROL
========================= */

deviceId: { type: String, trim: true },
deviceLastChangedAt: { type: Date, default: null },
deviceChangeCount: { type: Number, default: 0 },

passwordHash: { type: String, default: null },

shopId: {
type: String,
required: true,
unique: true,
index: true,
},

/* =====================================================
🔥 ABONNEMENT (STATE MACHINE)
===================================================== */

plan: {
type: String,
default: "Essai gratuit",
},

subscriptionStatus: {
type: String,
default: "trial",
index: true,
},

paidUntil: {
type: Date,
default: null,
index: true,
},

graceUntil: {
type: Date,
default: null,
},

trialEnd: {
type: Date,
default: null,
},

autoRenew: {
type: Boolean,
default: true,
},

billingCycleCount: {
type: Number,
default: 0,
},

lastPaymentId: {
type: String,
default: null,
},

/* =====================================================
🎯 REFERRAL ENGINE
===================================================== */

referralCode: {
type: String,
required: true,
unique: true,
index: true,
},

referredCount: {
type: Number,
default: 0,
},

paidReferrals: {
type: Number,
default: 0,
},

referralCodeUsed: {
type: String,
default: "",
index: true,
},

referralRewarded: {
type: Boolean,
default: false,
index: true,
},

/* =====================================================
📊 ACTIVITÉ
===================================================== */

installedAt: { type: Date, default: null },
lastActiveAt: { type: Date, default: null },
loginCount: { type: Number, default: 0 },

isOnboarded: {
type: Boolean,
default: false,
},
},
{
timestamps: true,
}
);

/* =====================================================
🔄 AUTO GENERATION shopId + referralCode
===================================================== */

StoreSchema.pre("validate", function (next) {
const doc = this as any;

if (!doc.shopId) {
doc.shopId = generateShopId();
}

if (!doc.referralCode) {
doc.referralCode = doc.shopId;
}

next();
});

/* =====================================================
📆 DEFAULT installedAt
===================================================== */

StoreSchema.pre("save", function (next) {
const doc = this as any;

if (!doc.installedAt) {
doc.installedAt = doc.createdAt || new Date();
}

next();
});

/* =====================================================
🚀 MODEL
===================================================== */

export default mongoose.model<IStore>("Store", StoreSchema);
