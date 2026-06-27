import mongoose, { Schema, Document } from "mongoose";

export interface ICallProxy extends Document {
  storeId: string;
  agentCode: string;
  agentName: string;
  callerPhone: string;
  agentPhone: string;
  status: "requested" | "ringing" | "connected" | "completed" | "failed";
  vonageCallUuid: string;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

const CallProxySchema = new Schema<ICallProxy>(
  {
    storeId: { type: String, required: true, index: true },
    agentCode: { type: String, required: true },
    agentName: { type: String, default: "" },
    callerPhone: { type: String, default: "" },
    agentPhone: { type: String, default: "" },
    status: {
      type: String,
      enum: ["requested", "ringing", "connected", "completed", "failed"],
      default: "requested",
    },
    vonageCallUuid: { type: String, default: "" },
    duration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<ICallProxy>("CallProxy", CallProxySchema);
