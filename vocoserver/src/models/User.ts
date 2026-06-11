// models/User.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
phone: string;
phoneOriginal?: string | null;
password?: string | null;

store: Types.ObjectId;

role: "owner" | "admin" | "employee" | "inventorist";
name?: string;

isActive: boolean;

permissions: any;

deviceId?: string | null;
lastLoginAt?: Date | null;

deletedAt?: Date | null;

createdAt?: Date;
updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
{
phone: { type: String, required: true, unique: true, trim: true },
phoneOriginal: { type: String, default: null },

password: { type: String, required: false, default: null },

store: { type: Schema.Types.ObjectId, ref: "Store", required: false, default: null, index: true },

role: {
type: String,
enum: ["owner", "admin", "employee", "inventorist"],
default: "owner",
},

name: { type: String, required: false, trim: true },

isActive: { type: Boolean, default: true, index: true },

permissions: { type: Schema.Types.Mixed, default: {} },

deviceId: { type: String, default: null },
lastLoginAt: { type: Date, default: null },

deletedAt: { type: Date, default: null, index: true },
},
{ timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
