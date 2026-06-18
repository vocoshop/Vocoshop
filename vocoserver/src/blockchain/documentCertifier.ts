import crypto from "crypto";
import { anchorReport, getProofChain } from "../services/blockchainAnchorService";
import DocumentCertification from "../models/DocumentCertification";
import { CertificationRequest, CertificationResult, DocumentType, VerificationResult } from "./types";

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function computeChainHash(contentHash: string, previousHash: string | null): string {
  return crypto
    .createHash("sha256")
    .update(contentHash + (previousHash || "genesis"))
    .digest("hex");
}

async function getPreviousCertificationHash(storeId: string): Promise<string | null> {
  try {
    const last = await DocumentCertification.findOne({ storeId: String(storeId) })
      .sort({ createdAt: -1 })
      .lean();
    return last ? last.chainHash : null;
  } catch {
    return null;
  }
}

export async function certifyDocument(
  request: CertificationRequest
): Promise<CertificationResult> {
  const { storeId, documentType, content, metadata } = request;

  const contentHash = hashContent(content);

  // contentPreview hashé pour éviter d'exposer le contenu en clair dans MongoDB
  const contentPreview = crypto.createHash("sha256").update(content.slice(0, 200)).digest("hex").slice(0, 16);

  const previousHash = await getPreviousCertificationHash(storeId);

  const anchorResult = await anchorReport({
    dataHash: contentHash,
    storeId,
    month: new Date().toISOString().slice(0, 7),
  });

  const chainHash = computeChainHash(contentHash, previousHash);

  const doc = await DocumentCertification.create({
    storeId,
    documentType,
    contentHash,
    contentPreview,
    metadata: metadata || {},
    chainHash,
    previousHash,
    anchorType: anchorResult.type,
    txHash: anchorResult.txHash,
    blockNumber: anchorResult.blockNumber,
    chainId: anchorResult.chainId,
    explorerUrl: anchorResult.explorerUrl,
  });

  return {
    id: doc._id.toString(),
    documentType,
    contentHash,
    chainHash,
    previousHash,
    anchorType: anchorResult.type,
    txHash: anchorResult.txHash,
    blockNumber: anchorResult.blockNumber,
    chainId: anchorResult.chainId,
    explorerUrl: anchorResult.explorerUrl,
    chainLabel: anchorResult.chainLabel,
    storeId,
    createdAt: doc.createdAt,
  };
}

export async function verifyDocument(
  documentId: string,
  content?: string
): Promise<VerificationResult> {
  const doc = await DocumentCertification.findById(documentId).lean();
  if (!doc) {
    return {
      isValid: false,
      document: null,
      chain: null,
      integrityCheck: {
        computedHash: "",
        storedHash: "",
        matches: false,
      },
      chainIntegrity: {
        isLinked: false,
        expectedPreviousHash: null,
        actualPreviousHash: null,
      },
    };
  }

  const computedHash = content ? hashContent(content) : doc.contentHash;

  const integrityMatches = computedHash === doc.contentHash;

  let chainIntegrity = {
    isLinked: true,
    expectedPreviousHash: null as string | null,
    actualPreviousHash: null as string | null,
  };

  if (doc.previousHash) {
    const prevDoc = await DocumentCertification.findOne({
      chainHash: doc.previousHash,
    }).lean();
    chainIntegrity = {
      isLinked: !!prevDoc,
      expectedPreviousHash: doc.previousHash,
      actualPreviousHash: prevDoc?.chainHash || null,
    };
  }

  const expectedChainHash = computeChainHash(doc.contentHash, doc.previousHash);
  const chainHashMatches = expectedChainHash === doc.chainHash;

  const isValid = integrityMatches && chainHashMatches && chainIntegrity.isLinked;

  return {
    isValid,
    document: {
      id: doc._id.toString(),
      documentType: doc.documentType as DocumentType,
      storeId: doc.storeId,
      createdAt: doc.createdAt,
    },
    chain: {
      chainHash: doc.chainHash,
      previousHash: doc.previousHash,
      anchorType: doc.anchorType,
      txHash: doc.txHash,
      blockNumber: doc.blockNumber,
    },
    integrityCheck: {
      computedHash,
      storedHash: doc.contentHash,
      matches: integrityMatches,
    },
    chainIntegrity,
  };
}

export async function verifyDocumentByHash(
  contentHash: string,
  content?: string
): Promise<VerificationResult | null> {
  const doc = await DocumentCertification.findOne({ contentHash })
    .sort({ createdAt: -1 })
    .lean();
  if (!doc) return null;
  return verifyDocument(doc._id.toString(), content);
}

export async function getStoreCertifications(
  storeId: string,
  documentType?: DocumentType,
  limit = 20,
  offset = 0
): Promise<{ certifications: CertificationResult[]; total: number }> {
  const filter: Record<string, unknown> = { storeId: String(storeId) };
  if (documentType) filter.documentType = String(documentType);

  const [docs, total] = await Promise.all([
    DocumentCertification.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    DocumentCertification.countDocuments(filter),
  ]);

  const certifications = docs.map((doc) => ({
    id: doc._id.toString(),
    documentType: doc.documentType as DocumentType,
    contentHash: doc.contentHash,
    chainHash: doc.chainHash,
    previousHash: doc.previousHash,
    anchorType: doc.anchorType as "database" | "blockchain",
    txHash: doc.txHash,
    blockNumber: doc.blockNumber,
    chainId: doc.chainId,
    explorerUrl: doc.explorerUrl,
    chainLabel: null as string | null,
    storeId: doc.storeId,
    createdAt: doc.createdAt,
  }));

  return { certifications, total };
}

export { getProofChain };
