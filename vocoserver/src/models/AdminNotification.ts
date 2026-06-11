import mongoose, { Schema, Document } from "mongoose";

export interface IAdminNotification extends Document {
  title: string;
  message: string;
  type: "push" | "sms" | "email";
  targetType: "all_agents" | "all_stores" | "specific_agent" | "specific_store" | "by_city";
  targetId?: string;
  targetCity?: string;
  status: "sent" | "scheduled" | "failed";
  scheduledAt?: Date;
  sentAt?: Date;
  createdBy: string;
  stats: { total: number; read: number; failed: number };
}

const AdminNotificationSchema = new Schema<IAdminNotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["push", "sms", "email"],
      default: "push",
    },
    targetType: {
      type: String,
      enum: ["all_agents", "all_stores", "specific_agent", "specific_store", "by_city"],
      required: true,
    },
    targetId: { type: String, default: null },
    targetCity: { type: String, default: null },
    status: {
      type: String,
      enum: ["sent", "scheduled", "failed"],
      default: "sent",
    },
    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: "admin" },
    stats: {
      total: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

AdminNotificationSchema.index({ status: 1, sentAt: -1 });
AdminNotificationSchema.index({ createdAt: -1 });

export default mongoose.model<IAdminNotification>("AdminNotification", AdminNotificationSchema);
