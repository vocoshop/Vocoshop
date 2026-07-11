import mongoose, { Schema, Document } from "mongoose";

export interface IOcrLine {
  text: string;
  productName?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  confidence: number;
  type: "sale" | "stock_in" | "expense" | "debt" | "unknown";
  corrected: boolean;
}

export interface IOcrScan extends Document {
  storeId: string;
  images: string[];
  rawText: string;
  lines: IOcrLine[];
  globalConfidence: number;
  needsReview: boolean;
  validatedByUser: boolean;
  status: "pending" | "validated" | "imported" | "rejected";
  correctionFeedback: Record<string, string>;
  detectedDate?: string;
  businessDate?: string;
  pageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const OcrLineSchema = new Schema<IOcrLine>(
  {
    text: { type: String, required: true },
    productName: { type: String, default: undefined },
    productId: { type: String, default: undefined },
    quantity: { type: Number, default: undefined },
    unitPrice: { type: Number, default: undefined },
    total: { type: Number, default: undefined },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    type: {
      type: String,
      enum: ["sale", "stock_in", "expense", "debt", "unknown"],
      default: "unknown",
    },
    corrected: { type: Boolean, default: false },
  },
  { _id: false }
);

const OcrScanSchema = new Schema<IOcrScan>(
  {
    storeId: { type: String, required: true, index: true },
    images: [{ type: String }],
    rawText: { type: String, default: "" },
    lines: { type: [OcrLineSchema], default: [] },
    globalConfidence: { type: Number, default: 0 },
    needsReview: { type: Boolean, default: false },
    validatedByUser: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "validated", "imported", "rejected"],
      default: "pending",
    },
    correctionFeedback: { type: Schema.Types.Mixed, default: {} },
    detectedDate: { type: String, default: undefined },
    businessDate: { type: String, default: undefined },
    pageCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

OcrScanSchema.index({ storeId: 1, createdAt: -1 });
OcrScanSchema.index({ status: 1 });

export default mongoose.model<IOcrScan>("OcrScan", OcrScanSchema);
