import mongoose, { Schema, Document } from "mongoose";

export interface ISupplier extends Document {
storeId: string;

name: string;
phone?: string;
phone2?: string;
whatsapp?: string;
email?: string;
address?: string;
city?: string;
category?: string;
logo?: string;

note?: string;
rating?: number;
isOnline?: boolean;
isFavorite?: boolean;
creditLimit?: number;
creditUsed?: number;
lastOrderAt?: Date | null;

createdAt?: Date;
updatedAt?: Date;
}

const SupplierSchema = new Schema<ISupplier>(
{
storeId: { type: String, required: true, index: true },

name: { type: String, required: true, trim: true },

phone: { type: String, trim: true },
phone2: { type: String, trim: true },
whatsapp: { type: String, trim: true },

email: { type: String, trim: true, lowercase: true },
address: { type: String, trim: true },
city: { type: String, trim: true },
category: { type: String, trim: true },
logo: { type: String, trim: true },

note: { type: String, trim: true },
rating: { type: Number, default: 0, min: 0, max: 5 },

isOnline: { type: Boolean, default: false },
isFavorite: { type: Boolean, default: false },

creditLimit: { type: Number, default: 0 },
creditUsed: { type: Number, default: 0 },

lastOrderAt: { type: Date, default: null },
},
{ timestamps: true }
);

SupplierSchema.index({ storeId: 1, name: 1 });

export default mongoose.model<ISupplier>("Supplier", SupplierSchema);
