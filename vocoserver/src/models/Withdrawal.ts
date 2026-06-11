import mongoose, { Schema, Document } from "mongoose";

export interface IWithdrawal extends Document {
  agentCode: string;
  agentId: mongoose.Types.ObjectId;
  agentName: string;
  amount: number;
  phone: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const WithdrawalSchema = new Schema<IWithdrawal>(
  {
    agentCode: { type: String, required: true, index: true, trim: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
    agentName: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 1000 },
    phone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNote: { type: String, default: "" },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

WithdrawalSchema.index({ agentCode: 1, status: 1 });
WithdrawalSchema.index({ createdAt: -1 });

export default mongoose.model<IWithdrawal>("Withdrawal", WithdrawalSchema);
