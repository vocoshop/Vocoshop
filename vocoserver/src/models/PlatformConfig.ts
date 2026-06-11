import mongoose, { Schema, Document } from "mongoose";

export interface IPlatformConfig extends Document {
  key: string;
  value: any;
  type: "string" | "number" | "boolean" | "json";
  category: "general" | "pricing" | "payment" | "referral" | "security" | "webhooks";
  label: string;
  description?: string;
  updatedAt: Date;
}

const PlatformConfigSchema = new Schema<IPlatformConfig>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    type: {
      type: String,
      enum: ["string", "number", "boolean", "json"],
      default: "string",
    },
    category: {
      type: String,
      enum: ["general", "pricing", "payment", "referral", "security", "webhooks"],
      default: "general",
    },
    label: { type: String, required: true },
    description: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<IPlatformConfig>("PlatformConfig", PlatformConfigSchema);