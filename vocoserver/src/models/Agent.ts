// models/Agent.ts
import mongoose, { Schema, Document } from "mongoose";
import { normalizePhone } from "../utils/phone";

export interface IAgent extends Document {
name: string;
firstName?: string;
lastName?: string;
phone: string;
country?: string;
city?: string;
region?: string;
gender?: string;
birthDate?: Date;
code: string;
codeNumber: number;
codeSuffix: string;
photoUrl?: string;
idType?: string;
idNumber?: string;
idPhotoPath?: string;
selfiePhotoPath?: string;
isApproved: boolean;
passwordHash?: string | null;
authCodeHash?: string | null;
authCodeIssuedAt?: Date | null;
mustChangePassword: boolean;
isActive: boolean;
lastLoginAt?: Date | null;
createdAt?: Date;
updatedAt?: Date;
}

function normalizeSuffix(s: string) {
const x = String(s || "").trim().toUpperCase();
return x.slice(0, 1);
}

function buildCode(n: number, suffix: string) {
return `AG-${n}-${normalizeSuffix(suffix)}`;
}

const AgentSchema = new Schema<IAgent>(
{
name: { type: String, required: true, trim: true },
firstName: { type: String, default: "", trim: true },
lastName: { type: String, default: "", trim: true },
phone: { type: String, required: true, unique: true, trim: true, index: true },

code: { type: String, required: true, unique: true, trim: true, index: true },
codeNumber: { type: Number, required: true, unique: true, index: true },
codeSuffix: { type: String, required: true, trim: true },

photoUrl: { type: String, default: "", trim: true },

country: { type: String, default: "", trim: true },
city: { type: String, default: "", trim: true },
region: { type: String, default: "", trim: true },

gender: { type: String, default: "", trim: true },
birthDate: { type: Date },

idType: { type: String, default: "", trim: true },
idNumber: { type: String, default: "", trim: true },
idPhotoPath: { type: String, default: "", trim: true },
selfiePhotoPath: { type: String, default: "", trim: true },

isApproved: { type: Boolean, default: false },

// ✅ 1ère connexion: passwordHash = null
passwordHash: { type: String, default: null },

// ✅ authCode temporaire (hashé)
authCodeHash: { type: String, default: null },
authCodeIssuedAt: { type: Date, default: null },

mustChangePassword: { type: Boolean, default: true },
isActive: { type: Boolean, default: true },

lastLoginAt: { type: Date, default: null },
},
{ timestamps: true }
);

// Normalisation + cohérence code
AgentSchema.pre("validate", function (next) {
const doc = this as any;

if (doc.phone) doc.phone = normalizePhone(doc.phone);
if (doc.codeSuffix) doc.codeSuffix = normalizeSuffix(doc.codeSuffix);

// si on a codeNumber + suffix -> construit code final
if (doc.codeNumber && doc.codeSuffix) {
doc.code = buildCode(doc.codeNumber, doc.codeSuffix);
}

// cohérence: si mustChangePassword true, on accepte passwordHash null
// si mustChangePassword false, passwordHash doit exister (check côté controller)
next();
});

export default mongoose.model<IAgent>("Agent", AgentSchema);
