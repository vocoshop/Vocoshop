import mongoose, { Schema, Document } from "mongoose";

export interface IVerificationRequest extends Document {
  partnerId: string;
  partnerName: string;
  storeId: string;
  documentId?: string;
  documentType?: string;
  action: "verify_document" | "verify_score" | "request_report";
  ip: string;
  success: boolean;
  createdAt: Date;
}

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    partnerId: { type: String, required: true, index: true },
    partnerName: { type: String, required: true },
    storeId: { type: String, required: true, index: true },
    documentId: { type: String, default: null },
    documentType: { type: String, default: null },
    action: {
      type: String,
      enum: ["verify_document", "verify_score", "request_report"],
      required: true,
    },
    ip: { type: String, default: "" },
    success: { type: Boolean, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

VerificationRequestSchema.index({ partnerId: 1, createdAt: -1 });
VerificationRequestSchema.index({ storeId: 1, action: 1 });

export default mongoose.model<IVerificationRequest>(
  "VerificationRequest",
  VerificationRequestSchema
);
