import mongoose, { Schema, Document } from "mongoose";

export interface IVoiceLog extends Document {
  storeId: string;
  userId?: string;

  originalAudioPath?: string;

  // Transcription brute
  rawText: string;
  transcriptionModel: string;
  confidence: number;

  // Après analyse et correction
  correctedText?: string;
  matchedProductId?: string;
  matchedProductName?: string;
  action?: string;
  quantity?: number;

  // fuzzy matching info
  fuzzyScore?: number;
  fuzzyMethod?: string;

  // Résultat final
  userConfirmed: boolean;
  executed: boolean;
  executionResult?: string;

  // Apprentissage
  wasCorrected: boolean;
  correctionLearned: boolean;

  createdAt?: Date;
}

const VoiceLogSchema = new Schema<IVoiceLog>(
  {
    storeId: { type: String, required: true, index: true },
    userId: { type: String, default: "" },

    originalAudioPath: { type: String, default: "" },

    rawText: { type: String, required: true },
    transcriptionModel: { type: String, default: "whisper-1" },
    confidence: { type: Number, default: 0 },

    correctedText: { type: String, default: "" },
    matchedProductId: { type: String, default: "" },
    matchedProductName: { type: String, default: "" },
    action: { type: String, default: "" },
    quantity: { type: Number, default: 0 },

    fuzzyScore: { type: Number, default: 0 },
    fuzzyMethod: { type: String, default: "" },

    userConfirmed: { type: Boolean, default: false },
    executed: { type: Boolean, default: false },
    executionResult: { type: String, default: "" },

    wasCorrected: { type: Boolean, default: false },
    correctionLearned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

VoiceLogSchema.index({ storeId: 1, createdAt: -1 });
VoiceLogSchema.index({ matchedProductId: 1 });

export default mongoose.model<IVoiceLog>("VoiceLog", VoiceLogSchema);
