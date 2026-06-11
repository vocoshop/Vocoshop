import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document {
key: string;
seq: number;
}

const CounterSchema = new Schema<ICounter>(
{
key: { type: String, required: true, unique: true, index: true, trim: true },
seq: { type: Number, default: 1000 },
},
{ timestamps: true }
);

export default mongoose.model<ICounter>("Counter", CounterSchema);
