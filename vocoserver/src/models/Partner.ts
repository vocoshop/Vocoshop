import mongoose, { Schema, Document } from "mongoose";

export interface IPartner extends Document {
  name: string;
  type: string;
  email: string;
  phone: string;
  min: number;
  max: number;
  responseTime: string;
  rate: string;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, default: "Microfinance" },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "" },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    responseTime: { type: String, default: "" },
    rate: { type: String, default: "" },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PartnerSchema.index({ active: 1, order: 1 });

export default mongoose.model<IPartner>("Partner", PartnerSchema);
