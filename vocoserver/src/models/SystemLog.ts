import mongoose, { Schema, Document } from "mongoose";

export type LogLevel = "error" | "warning" | "info" | "security" | "performance" | "webhook";

export interface ISystemLog extends Document {
  level: LogLevel;
  source: string;
  message: string;
  details?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  stack?: string;
  createdAt: Date;
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    level: {
      type: String,
      enum: ["error", "warning", "info", "security", "performance", "webhook"],
      required: true,
      index: true,
    },
    source: { type: String, required: true, default: "server" },
    message: { type: String, required: true },
    details: { type: String, default: null },
    method: { type: String, default: null },
    path: { type: String, default: null },
    statusCode: { type: Number, default: null },
    durationMs: { type: Number, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    stack: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SystemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
SystemLogSchema.index({ level: 1, createdAt: -1 });
SystemLogSchema.index({ source: 1, createdAt: -1 });
SystemLogSchema.index({ statusCode: 1, createdAt: -1 });

export default mongoose.model<ISystemLog>("SystemLog", SystemLogSchema);
