import mongoose, { Schema, Document } from "mongoose";

export interface IFundingDemande extends Document {
  storeId: string;
  userId: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  objective: string;
  phone: string;
  address: string;
  comment: string;
  status: "pending" | "info_required" | "accepted" | "rejected" | "closed";
  emailSent: boolean;
  dashboardUrl: string;
  shareToken: string;
  consentGiven: boolean;
  consentDate: Date;
  adminComment: string;
  createdAt: Date;
  updatedAt: Date;
}

const FundingDemandeSchema = new Schema<IFundingDemande>(
  {
    storeId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    partnerId: { type: String, default: "" },
    partnerName: { type: String, default: "" },
    amount: { type: Number, required: true },
    objective: { type: String, default: "" },
    phone: { type: String, required: true },
    address: { type: String, default: "" },
    comment: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "info_required", "accepted", "rejected", "closed"],
      default: "pending",
    },
    emailSent: { type: Boolean, default: false },
    dashboardUrl: { type: String, default: "" },
    shareToken: { type: String, default: "" },
    consentGiven: { type: Boolean, default: false },
    consentDate: { type: Date },
    adminComment: { type: String, default: "" },
  },
  { timestamps: true }
);

FundingDemandeSchema.index({ storeId: 1, createdAt: -1 });

export default mongoose.model<IFundingDemande>("FundingDemande", FundingDemandeSchema);
