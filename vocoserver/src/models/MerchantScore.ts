import mongoose, { Schema, Document } from "mongoose";

export interface IScoreComponent {
  name: string;
  label: string;
  value: number;
  weight: number;
  score: number;
  maxScore: number;
}

export interface IMerchantScore extends Document {
  storeId: string;
  overallScore: number;
  components: IScoreComponent[];
  periodStart: Date;
  periodEnd: Date;
  transactionCount: number;
  averageMonthlyTransactions: number;
  accountAgeDays: number;
  subscriptionRegularity: number;
  stockManagementScore: number;
  revenueStability: number;
  chainHash: string;
  previousHash: string | null;
  anchorType: "database" | "blockchain";
  txHash: string | null;
  blockNumber: number | null;
  chainId: string | null;
  explorerUrl: string | null;
  createdAt: Date;
}

const ScoreComponentSchema = new Schema<IScoreComponent>(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: Number, required: true },
    weight: { type: Number, required: true },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
  },
  { _id: false }
);

const MerchantScoreSchema = new Schema<IMerchantScore>(
  {
    storeId: { type: String, required: true, index: true },
    overallScore: { type: Number, required: true, min: 0, max: 1000 },
    components: { type: [ScoreComponentSchema], default: [] },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    transactionCount: { type: Number, default: 0 },
    averageMonthlyTransactions: { type: Number, default: 0 },
    accountAgeDays: { type: Number, default: 0 },
    subscriptionRegularity: { type: Number, default: 0 },
    stockManagementScore: { type: Number, default: 0 },
    revenueStability: { type: Number, default: 0 },
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

MerchantScoreSchema.index({ storeId: 1, createdAt: -1 });
MerchantScoreSchema.index({ overallScore: -1 });

export default mongoose.model<IMerchantScore>("MerchantScore", MerchantScoreSchema);
