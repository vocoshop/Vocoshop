import mongoose, { Schema, Document } from "mongoose";
import { DocumentType } from "../blockchain/types";

export interface IDocumentCertification extends Document {
  storeId: string;
  documentType: DocumentType;
  contentHash: string;
  contentPreview: string;
  metadata: Record<string, unknown>;
  chainHash: string;
  previousHash: string | null;
  anchorType: "database" | "blockchain";
  txHash: string | null;
  blockNumber: number | null;
  chainId: string | null;
  explorerUrl: string | null;
  createdAt: Date;
}

const DocumentCertificationSchema = new Schema<IDocumentCertification>(
  {
    storeId: { type: String, required: true, index: true },
    documentType: {
      type: String,
      enum: [
        "invoice", "sales_report", "activity_report", "payment_history",
        "subscription_report", "supplier_contract", "microfinance_contract",
        "payment_proof", "merchant_certificate", "confidence_score",
        "delivery_proof", "transaction_history",
      ],
      required: true,
    },
    contentHash: { type: String, required: true, index: true },
    contentPreview: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    chainHash: { type: String, required: true, unique: true },
    previousHash: { type: String, default: null },
    anchorType: { type: String, enum: ["database", "blockchain"], default: "database" },
    txHash: { type: String, default: null },
    blockNumber: { type: Number, default: null },
    chainId: { type: String, default: null },
    explorerUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DocumentCertificationSchema.index({ storeId: 1, documentType: 1 });
DocumentCertificationSchema.index({ createdAt: -1 });

export default mongoose.model<IDocumentCertification>(
  "DocumentCertification",
  DocumentCertificationSchema
);
