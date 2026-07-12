import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStoreInvitation extends Document {
  storeId: Types.ObjectId;
  phone: string;
  ownerName: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

const StoreInvitationSchema = new Schema<IStoreInvitation>({
  storeId: { type: Schema.Types.ObjectId, ref: "Store", required: true, index: true },
  phone: { type: String, required: true, trim: true, index: true },
  ownerName: { type: String, default: "", trim: true },
  token: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "expired", "cancelled"],
    default: "pending",
    index: true,
  },
  invitedBy: { type: String, default: "" },
  expiresAt: { type: Date, required: true, index: true },
  acceptedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model<IStoreInvitation>("StoreInvitation", StoreInvitationSchema);
