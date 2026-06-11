// models/CallProxy.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ICallProxy extends Document {
  storeId: string;
  agentCode: string;
  agentName: string;
  status: "requested" | "connected" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const CallProxySchema = new Schema<ICallProxy>(
  {
    storeId: { type: String, required: true, index: true },
    agentCode: { type: String, required: true },
    agentName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["requested", "connected", "completed", "failed"],
      default: "requested",
    },
  },
  { timestamps: true }
);

export default mongoose.model<ICallProxy>("CallProxy", CallProxySchema);
