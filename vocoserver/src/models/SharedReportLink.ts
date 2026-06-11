import mongoose, { Schema, Document } from "mongoose";

export interface ISharedReportLink extends Document {
storeId: string;
month: string; // YYYY-MM
token: string; // lien sécurisé
isActive: boolean;
expiresAt: Date;
dataHash: string; // SHA-256 integrity hash
viewsCount: number;
lastViewedAt: Date | null;
downloadsCount: number;
lastDownloadedAt: Date | null;
storeName: string;
createdAt: Date;
}

const SharedReportLinkSchema = new Schema<ISharedReportLink>(
{
storeId: { type: String, required: true, index: true },

month: {
type: String, // ex: 2026-01
required: true,
index: true,
},

token: {
type: String,
required: true,
unique: true,
index: true,
},

isActive: {
type: Boolean,
default: true,
},

expiresAt: {
type: Date,
required: true,
},

dataHash: { type: String, default: "" },
viewsCount: { type: Number, default: 0 },
lastViewedAt: { type: Date, default: null },
downloadsCount: { type: Number, default: 0 },
lastDownloadedAt: { type: Date, default: null },
storeName: { type: String, default: "" },
},
{ timestamps: true }
);

// ⏱️ auto-expiration Mongo
SharedReportLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<ISharedReportLink>(
"SharedReportLink",
SharedReportLinkSchema
);
