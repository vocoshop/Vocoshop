import mongoose, { Schema, Document } from "mongoose";

export interface ISubscription extends Document {
storeId: mongoose.Types.ObjectId;

// plan unique pour Vocoshop
plan: "STANDARD";

// état abonnement
status: "trial" | "active" | "expired";

// dates
trialStart?: Date;
trialEnd?: Date;

currentPeriodStart?: Date;
currentPeriodEnd?: Date;

// 🔥 extension automatique si faible usage
extensionGranted?: boolean;

// 🔥 parrainage
referralCount: number; // nombre de filleuls validés
referralRewarded: number; // nombre de mois offerts déjà donnés

// timestamps
createdAt: Date;
updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
{
storeId: {
type: Schema.Types.ObjectId,
ref: "Store",
required: true,
unique: true, // 1 seule subscription par boutique
index: true,
},

plan: {
type: String,
enum: ["STANDARD"],
default: "STANDARD",
},

status: {
type: String,
enum: ["trial", "active", "expired"],
default: "trial",
index: true,
},

trialStart: {
type: Date,
default: Date.now,
},

trialEnd: {
type: Date,
required: true,
},

currentPeriodStart: Date,
currentPeriodEnd: Date,

extensionGranted: {
type: Boolean,
default: false,
},

referralCount: {
type: Number,
default: 0,
},

referralRewarded: {
type: Number,
default: 0,
},
},
{
timestamps: true,
}
);

export default mongoose.model<ISubscription>(
"Subscription",
SubscriptionSchema
);
