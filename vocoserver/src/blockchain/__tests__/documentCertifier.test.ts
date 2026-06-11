import crypto from "crypto";

jest.mock("../../models/DocumentCertification", () => {
  const leanDoc = jest.fn().mockResolvedValue(null);
  const findById = jest.fn(() => ({ lean: leanDoc }));
  const findOne = jest.fn(() => ({
    sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
    lean: jest.fn().mockResolvedValue(null),
  }));
  const find = jest.fn(() => ({ sort: jest.fn(() => ({ skip: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })) })) }));
  const countDocuments = jest.fn().mockResolvedValue(0);
  const create = jest.fn().mockImplementation((data: any) => Promise.resolve({
    _id: "doc_1",
    ...data,
    createdAt: new Date(),
  }));
  return { findById, findOne, find, countDocuments, create, __leanDoc: leanDoc };
});

jest.mock("../../models/BlockchainProof", () => {
  const findOne = jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })) }));
  const find = jest.fn(() => ({ sort: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })) }));
  const create = jest.fn().mockResolvedValue({});
  return { findOne, find, create };
});

jest.mock("ethers", () => ({}), { virtual: true });

jest.mock("../../services/blockchainAnchorService", () => {
  const actual = jest.requireActual("../../services/blockchainAnchorService");
  actual.anchorOnBlockchain = jest.fn().mockResolvedValue({
    txHash: null, blockNumber: null, chainId: null, explorerUrl: null,
  });
  return actual;
});

import {
  certifyDocument,
  verifyDocument,
  getStoreCertifications,
} from "../documentCertifier";

const DocumentCertification = jest.requireMock("../../models/DocumentCertification") as any;

describe("documentCertifier", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("certifyDocument", () => {
    it("devrait certifier un document avec succès", async () => {
      const result = await certifyDocument({
        storeId: "store_1",
        documentType: "sales_report",
        content: JSON.stringify({ total: 15000, items: 50 }),
        metadata: { period: "2026-05" },
      });

      expect(result).toBeDefined();
      expect(result.storeId).toBe("store_1");
      expect(result.documentType).toBe("sales_report");
      expect(result.contentHash).toBeTruthy();
      expect(result.chainHash).toBeTruthy();
      expect(result.id).toBe("doc_1");
      expect(DocumentCertification.create).toHaveBeenCalled();
    });

    it("devrait chaîner avec le document précédent du même store", async () => {
      DocumentCertification.findOne.mockImplementationOnce(() => ({
        sort: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue({
            _id: "prev_doc",
            chainHash: "prev_chain_hash_123",
          }),
        })),
      }));

      const result = await certifyDocument({
        storeId: "store_1",
        documentType: "invoice",
        content: "FACTURE-001",
      });

      expect(result.previousHash).toBe("prev_chain_hash_123");
    });

    it("devrait gérer les contenus longs pour l aperçu", async () => {
      const longContent = "A".repeat(500);
      const result = await certifyDocument({
        storeId: "store_2",
        documentType: "activity_report",
        content: longContent,
      });

      expect(result.contentHash).toBe(
        crypto.createHash("sha256").update(longContent, "utf8").digest("hex")
      );
    });
  });

  describe("verifyDocument", () => {
    beforeEach(() => {
      DocumentCertification.__leanDoc.mockReset();
    });

    it("devrait retourner non valide si document inexistant", async () => {
      DocumentCertification.__leanDoc.mockResolvedValue(null);

      const result = await verifyDocument("inexistant");
      expect(result.isValid).toBe(false);
      expect(result.document).toBeNull();
    });

    it("devrait vérifier un document valide", async () => {
      const content = '{"total":15000}';
      const contentHash = crypto.createHash("sha256").update(content, "utf8").digest("hex");
      const chainHash = crypto.createHash("sha256").update(contentHash + "genesis").digest("hex");

      DocumentCertification.__leanDoc.mockResolvedValue({
        _id: "doc_1",
        documentType: "sales_report",
        storeId: "store_1",
        contentHash,
        chainHash,
        previousHash: null,
        anchorType: "database",
        txHash: null,
        blockNumber: null,
        createdAt: new Date(),
      });

      const result = await verifyDocument("doc_1", content);
      expect(result.isValid).toBe(true);
      expect(result.integrityCheck.matches).toBe(true);
      expect(result.document?.storeId).toBe("store_1");
    });

    it("devrait détecter une falsification du contenu", async () => {
      const contentHash = crypto.createHash("sha256").update("original", "utf8").digest("hex");
      const chainHash = crypto.createHash("sha256").update(contentHash + "genesis").digest("hex");

      DocumentCertification.__leanDoc.mockResolvedValue({
        _id: "doc_1",
        documentType: "invoice",
        storeId: "store_1",
        contentHash,
        chainHash,
        previousHash: null,
        anchorType: "database",
        txHash: null,
        blockNumber: null,
        createdAt: new Date(),
      });

      const result = await verifyDocument("doc_1", "falsifié");
      expect(result.isValid).toBe(false);
      expect(result.integrityCheck.matches).toBe(false);
    });

    it("devrait vérifier l intégrité de la chaîne", async () => {
      const contentHash = crypto.createHash("sha256").update("content", "utf8").digest("hex");
      const prevHash = "prev_hash_value";
      const chainHash = crypto.createHash("sha256").update(contentHash + prevHash).digest("hex");

      DocumentCertification.__leanDoc.mockResolvedValue({
        _id: "doc_2",
        documentType: "payment_proof",
        storeId: "store_2",
        contentHash,
        chainHash,
        previousHash: prevHash,
        anchorType: "database",
        txHash: null,
        blockNumber: null,
        createdAt: new Date(),
      });

      DocumentCertification.findOne.mockImplementationOnce(() => ({
        sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
        lean: jest.fn().mockResolvedValue({ chainHash: prevHash }),
      }));

      const result = await verifyDocument("doc_2", "content");
      expect(result.isValid).toBe(true);
      expect(result.chainIntegrity.isLinked).toBe(true);
    });
  });

  describe("getStoreCertifications", () => {
    it("devrait retourner les certifications d un store", async () => {
      const mockDocs = [
        { _id: "d1", documentType: "invoice", storeId: "s1", contentHash: "h1", chainHash: "ch1", previousHash: null, anchorType: "database", txHash: null, blockNumber: null, chainId: null, explorerUrl: null, createdAt: new Date() },
        { _id: "d2", documentType: "sales_report", storeId: "s1", contentHash: "h2", chainHash: "ch2", previousHash: "ch1", anchorType: "database", txHash: null, blockNumber: null, chainId: null, explorerUrl: null, createdAt: new Date() },
      ];

      DocumentCertification.find.mockReturnValueOnce({
        sort: jest.fn(() => ({ skip: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(mockDocs) })) })) })),
      });
      DocumentCertification.countDocuments.mockResolvedValueOnce(2);

      const result = await getStoreCertifications("s1");
      expect(result.total).toBe(2);
      expect(result.certifications).toHaveLength(2);
    });
  });
});
