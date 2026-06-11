import mongoose, { Schema, Document } from "mongoose";

export interface IReply {
  author: string;
  message: string;
  isAdmin: boolean;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  storeId?: mongoose.Types.ObjectId;
  agentCode?: string;
  storeName: string;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  replies: IReply[];
  createdAt: Date;
  updatedAt: Date;
}

const ReplySchema = new Schema<IReply>(
  {
    author: { type: String, required: true },
    message: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: "Store", index: true },
    agentCode: { type: String, default: null, index: true },
    storeName: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    replies: [ReplySchema],
  },
  { timestamps: true }
);

SupportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });

export default mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
