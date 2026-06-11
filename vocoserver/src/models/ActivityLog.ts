// models/ActivityLog.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IActivityLog extends Document {
  agentCode: string;
  storeId?: string;
  storeName?: string;
  type: "store_created" | "store_onboarded" | "subscription_activated" | "subscription_expired" | "commission_earned" | "withdrawal_requested" | "withdrawal_approved" | "auto_renewal";
  message: string;
  icon: string;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    agentCode: { type: String, required: true, index: true },
    storeId: { type: String, default: null },
    storeName: { type: String, default: "" },
    type: {
      type: String,
      enum: ["store_created", "store_onboarded", "subscription_activated", "subscription_expired", "commission_earned", "withdrawal_requested", "withdrawal_approved", "auto_renewal"],
      required: true,
    },
    message: { type: String, required: true },
    icon: { type: String, required: true },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
ActivityLogSchema.index({ agentCode: 1, createdAt: -1 });

const ActivityLog = mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
export default ActivityLog;
