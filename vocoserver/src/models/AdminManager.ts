import mongoose, { Schema, Document } from "mongoose";

export interface IAdminManager extends Document {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
  photoUrl?: string;
  assignedRegions: string[];
  assignedCities: string[];
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const AdminManagerSchema = new Schema<IAdminManager>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    photoUrl: { type: String, default: null },
    assignedRegions: [{ type: String, trim: true }],
    assignedCities: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AdminManagerSchema.index({ assignedRegions: 1 });
AdminManagerSchema.index({ assignedCities: 1 });

const AdminManager = mongoose.model<IAdminManager>("AdminManager", AdminManagerSchema);
export default AdminManager;
