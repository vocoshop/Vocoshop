import mongoose, { Schema, Document } from "mongoose";

export interface IBlockchainProof extends Document {
  dataHash: string; // SHA-256 du rapport (hash chaîné = sha256(contentHash + previousHash))
  contentHash: string; // SHA-256 du contenu original (pour recherche directe)
  previousHash: string | null; // hash de l'ancre précédente (chaîne)
  anchorType: "database" | "blockchain";
  txHash: string | null;
  blockNumber: number | null;
  chainId: string | null;
  explorerUrl: string | null;
  storeId: string;
  month: string;
  createdAt: Date;
}

const BlockchainProofSchema = new Schema<IBlockchainProof>(
  {
    dataHash: { type: String, required: true, unique: true, index: true },
    contentHash: { type: String, required: true, index: true },
    previousHash: { type: String, default: null },
    anchorType: { type: String, enum: ["database", "blockchain"], default: "database" },
    txHash: { type: String, default: null },
    blockNumber: { type: Number, default: null },
    chainId: { type: String, default: null },
    explorerUrl: { type: String, default: null },
    storeId: { type: String, required: true, index: true },
    month: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BlockchainProofSchema.index({ createdAt: -1 });
BlockchainProofSchema.index({ storeId: 1, month: -1 });

export default mongoose.model<IBlockchainProof>("BlockchainProof", BlockchainProofSchema);
