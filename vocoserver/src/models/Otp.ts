import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
phone: string;
code: string;
purpose?: string;
expiresAt?: Date;
}

const OTPschema = new Schema<IOtp>(
{
phone: { type: String, required: true },
code: { type: String, required: true },
purpose: { type: String, default: null },
expiresAt: { type: Date, default: null },
},
{ timestamps: true }
);

export default mongoose.model<IOtp>("OTP", OTPschema);
