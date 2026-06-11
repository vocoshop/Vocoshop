import mongoose, { Schema, Document } from "mongoose";

export interface ICommission extends Document {
  agentCode: string;
  storeId: mongoose.Types.ObjectId;
  storeName: string;
  amount: number;
  month: number;
  year: number;
  status: "pending" | "paid" | "cancelled";
  paidAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const CommissionSchema = new Schema<ICommission>(
  {
    agentCode: { type: String, required: true, index: true, trim: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    storeName: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, default: 800 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CommissionSchema.index({ agentCode: 1, storeId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model<ICommission>("Commission", CommissionSchema);
