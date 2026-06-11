import mongoose, { Schema, Document } from "mongoose";

/* =====================================================
🧾 INTERFACE
===================================================== */
export interface INotification extends Document {
storeId: mongoose.Types.ObjectId;

title: string;
message: string;

type:
| "stock_low"
| "product_expiring"
| "subscription"
| "referral_bonus"
| "free_day"
| "system";

isRead: boolean;
uniqueKey?: string | null;

createdAt?: Date;
updatedAt?: Date;
}

/* =====================================================
🔥 SCHEMA
===================================================== */

const NotificationSchema = new Schema<INotification>(
{
storeId: {
type: Schema.Types.ObjectId,
ref: "Store",
required: true,
index: true,
},

title: {
type: String,
required: true,
trim: true,
},

message: {
type: String,
required: true,
trim: true,
},

type: {
type: String,
enum: [
"stock_low",
"product_expiring",
"subscription",
"referral_bonus",
"free_day",
"system",
],
default: "system",
index: true,
},

isRead: {
  type: Boolean,
  default: false,
  index: true,
},

uniqueKey: {
  type: String,
  default: null,
  index: true,
},
},
{ timestamps: true }
);

export default mongoose.model<INotification>(
"Notification",
NotificationSchema
);
