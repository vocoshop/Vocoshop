// models/SharedReport.ts
import mongoose, { Schema, Document } from "mongoose";

export type SharedReportType = "month";

export interface ISharedReport extends Document {
storeId: string;

type: SharedReportType; // "month"
from: string; // YYYY-MM-DD
to: string; // YYYY-MM-DD

// Snapshot immuable (la “preuve”)
snapshot: any;

// sécurité / gouvernance
createdByUserId?: string;
createdAt: Date;
expiresAt: Date;
revokedAt?: Date | null;

// audit
viewsCount: number;
lastViewedAt?: Date | null;
}

const SharedReportSchema = new Schema<ISharedReport>(
{
storeId: { type: String, required: true, index: true },

type: { type: String, required: true, enum: ["month"], index: true },
from: { type: String, required: true, index: true },
to: { type: String, required: true, index: true },

snapshot: { type: Schema.Types.Mixed, required: true },

createdByUserId: { type: String },

expiresAt: { type: Date, required: true, index: true },
revokedAt: { type: Date, default: null, index: true },

viewsCount: { type: Number, required: true, default: 0 },
lastViewedAt: { type: Date, default: null },
},
{ timestamps: true }
);

SharedReportSchema.index({ storeId: 1, type: 1, from: 1, to: 1, expiresAt: -1 });
SharedReportSchema.index({ expiresAt: 1 });

const SharedReport = mongoose.model<ISharedReport>("SharedReport", SharedReportSchema);
export default SharedReport;
