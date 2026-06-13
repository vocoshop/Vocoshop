import mongoose, { Schema, Document } from "mongoose";

export interface ICommunicationLog extends Document {
  channel: "sms" | "whatsapp";
  recipients: string;
  recipientCount: number;
  subject?: string;
  message: string;
  sent: number;
  failed: number;
  errorDetails?: string[];
  status: "sent" | "partial" | "failed";
  sentBy?: string;
  city?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const CommunicationLogSchema = new Schema<ICommunicationLog>(
  {
    channel: {
      type: String,
      enum: ["sms", "whatsapp"],
      required: true,
      index: true,
    },
    recipients: {
      type: String,
      required: true,
    },
    recipientCount: {
      type: Number,
      required: true,
    },
    subject: {
      type: String,
      default: "",
    },
    message: {
      type: String,
      required: true,
    },
    sent: {
      type: Number,
      required: true,
    },
    failed: {
      type: Number,
      default: 0,
    },
    errorDetails: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["sent", "partial", "failed"],
      default: "sent",
    },
    sentBy: {
      type: String,
      default: "admin",
    },
    city: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

CommunicationLogSchema.index({ createdAt: -1 });

export default mongoose.model<ICommunicationLog>(
  "CommunicationLog",
  CommunicationLogSchema
);
