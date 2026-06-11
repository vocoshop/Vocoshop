import mongoose, { Schema, Document } from "mongoose";

export interface IVoiceLearning extends Document {
  storeId: string;

  // La façon dont l'utilisateur prononce
  spokenPhrase: string;

  // Le produit réel correspondant
  productId: string;
  productName: string;

  // Force de l'apprentissage (incrémenté à chaque correction)
  weight: number;

  // Dernière utilisation
  lastUsed?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

const VoiceLearningSchema = new Schema<IVoiceLearning>(
  {
    storeId: { type: String, required: true, index: true },

    spokenPhrase: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    productId: { type: String, required: true },
    productName: { type: String, required: true },

    weight: { type: Number, default: 1 },

    lastUsed: { type: Date, default: null },
  },
  { timestamps: true }
);

VoiceLearningSchema.index({ storeId: 1, spokenPhrase: 1 }, { unique: true });

export default mongoose.model<IVoiceLearning>("VoiceLearning", VoiceLearningSchema);
