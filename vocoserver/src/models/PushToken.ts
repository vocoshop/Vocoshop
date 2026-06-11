import mongoose, { Schema, Document } from "mongoose";

export interface IPushToken extends Document {
  storeId: mongoose.Types.ObjectId;
  token: string;
  platform: "android" | "ios" | "web";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PushTokenSchema = new Schema<IPushToken>(
  {
    storeId: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["android", "ios", "web"],
      default: "android",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

PushTokenSchema.index({ token: 1 }, { unique: true });
PushTokenSchema.index({ storeId: 1, isActive: 1 });

export default mongoose.model<IPushToken>("PushToken", PushTokenSchema);