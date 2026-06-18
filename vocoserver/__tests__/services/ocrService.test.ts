jest.mock("tesseract.js", () => ({
  recognize: jest.fn().mockResolvedValue({
    data: { text: "Savon 500F\nHuile 2L 2500\nRiz 5kg 3500", confidence: 85 },
  }),
}));

/* ------------------------------------------------------
Model mocks
------------------------------------------------------ */
const mockOcrScanCreate = jest.fn();
const mockOcrFindOne = jest.fn();
const mockOcrFind = jest.fn();
const mockOcrCountDocuments = jest.fn();

jest.mock("../../src/models/OcrScan", () => {
  const mockToObject = jest.fn(function () {
    return {
      _id: this._id ?? "scan_test_1",
      storeId: this.storeId ?? "store_test",
      images: this.images ?? [],
      rawText: this.rawText ?? "",
      lines: this.lines ?? [],
      globalConfidence: this.globalConfidence ?? 0,
      needsReview: this.needsReview ?? false,
      validatedByUser: this.validatedByUser ?? false,
      status: this.status ?? "pending",
      correctionFeedback: this.correctionFeedback ?? {},
      pageCount: this.pageCount ?? 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  return {
    __esModule: true,
    default: {
      create: mockOcrScanCreate.mockImplementation((data: any) => {
        const doc: any = { ...data, _id: "scan_test_1", toObject: mockToObject };
        doc.save = jest.fn().mockResolvedValue(doc);
        return Promise.resolve(doc);
      }),
      findOne: mockOcrFindOne,
      find: mockOcrFind,
      countDocuments: mockOcrCountDocuments,
    },
  };
});

jest.mock("../../src/models/ProductAlias", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(() => ({
      sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
    })),
  },
}));

let mockProductFindResult: any = [];

const mockProductFind = jest.fn().mockImplementation(() => ({
  lean: jest.fn().mockResolvedValue(mockProductFindResult),
}));

const mockProductFindByIdAndUpdate = jest.fn();
const mockProductFindOne = jest.fn();

const mockProductFindById = jest.fn();

jest.mock("../../src/models/Product", () => ({
  __esModule: true,
  default: {
    find: mockProductFind,
    findById: mockProductFindById,
    findByIdAndUpdate: mockProductFindByIdAndUpdate,
    findOne: mockProductFindOne,
  },
}));

/* ------------------------------------------------------
Imports
------------------------------------------------------ */
import { ocrService } from "../../src/services/ocrService";

const OcrScan = jest.requireMock("../../src/models/OcrScan").default;
const ProductAlias = jest.requireMock("../../src/models/ProductAlias").default;
const Product = jest.requireMock("../../src/models/Product").default;

describe("OcrService", () => {
  const storeId = "store_test_1";

  beforeEach(() => {
    jest.clearAllMocks();
    mockProductFindResult = [];
  });

  const validBase64 = "data:image/jpeg;base64," + "A".repeat(100);

  /* =====================================================
  scanDocument
  ===================================================== */
  describe("scanDocument", () => {
    it("crée un scan avec statut pending", async () => {
      const result = await ocrService.scanDocument(storeId, [validBase64]);
      expect(result.status).toBe("pending");
      expect(result.storeId).toBe(storeId);
      expect(OcrScan.create).toHaveBeenCalledTimes(1);
    });

    it("stocke l'image et le pageCount", async () => {
      const result = await ocrService.scanDocument(storeId, [validBase64], { pageCount: 3 });
      expect(result.images).toContain(validBase64);
      expect(result.pageCount).toBe(3);
    });

    it("ne crashe pas si aucun produit trouvé", async () => {
      await expect(
        ocrService.scanDocument(storeId, [validBase64])
      ).resolves.toBeDefined();
    });
  });

  /* =====================================================
  validateScan
  ===================================================== */
  describe("validateScan", () => {
    it("valide un scan et marque validatedByUser", async () => {
      const mockSave = jest.fn().mockResolvedValue({});
      const mockScan = {
        _id: "507f191e810c19729de860ea",
        storeId,
        lines: [],
        status: "pending",
        validatedByUser: false,
        correctionFeedback: {},
        save: mockSave,
        toObject: function () {
          return { ...this, _id: this._id };
        },
      };

      mockOcrFindOne.mockResolvedValue(mockScan);
      mockProductFindOne.mockResolvedValue(null);

      const validatedLines = [{ text: "test", confidence: 90, corrected: false, type: "unknown" as const }];
      const result = await ocrService.validateScan("507f191e810c19729de860ea", storeId, validatedLines);

      expect(result.validatedByUser).toBe(true);
      expect(result.status).toBe("validated");
      expect(mockSave).toHaveBeenCalled();
    });

    it("apprend les alias pour les lignes corrigées", async () => {
      const mockSave = jest.fn().mockResolvedValue({});
      const mockScan = {
        _id: "507f191e810c19729de860eb",
        storeId,
        lines: [],
        status: "pending",
        validatedByUser: false,
        correctionFeedback: {},
        save: mockSave,
        toObject: function () {
          return { ...this, _id: this._id };
        },
      };

      mockOcrFindOne.mockResolvedValue(mockScan);

      const mockProductDoc = {
        _id: "507f191e810c19729de860ea",
        name: "Savon",
        aliases: [],
        save: jest.fn().mockResolvedValue({}),
      };
      mockProductFindOne.mockResolvedValue(mockProductDoc);

      ProductAlias.findOne.mockResolvedValue(null);
      ProductAlias.create.mockResolvedValue({});

      const validatedLines = [
        {
          text: "savon 500F",
          productName: "Savon",
          productId: "507f191e810c19729de860ea",
          confidence: 85,
          corrected: true,
          type: "sale" as const,
        },
      ];

      await ocrService.validateScan("507f191e810c19729de860eb", storeId, validatedLines);

      expect(ProductAlias.create).toHaveBeenCalledWith(
        expect.objectContaining({ storeId, rawText: "savon 500F" })
      );
      expect(mockProductDoc.aliases).toContain("savon 500F");
      expect(mockProductDoc.save).toHaveBeenCalled();
    });

    it("rejette si scan introuvable", async () => {
      mockOcrFindOne.mockResolvedValue(null);
      await expect(
        ocrService.validateScan("507f191e810c19729de860ec", storeId, [])
      ).rejects.toThrow("Scan introuvable");
    });
  });

  /* =====================================================
  importValidatedScan
  ===================================================== */
  describe("importValidatedScan", () => {
    it("importe les lignes de type stock_in dans le stock", async () => {
      const mockSave = jest.fn().mockResolvedValue({});
      const mockScan = {
        _id: "507f191e810c19729de860ee",
        storeId,
        status: "validated",
        lines: [
          {
            text: "appro 10 sacs riz",
            productName: "Riz",
            productId: "507f191e810c19729de860ed",
            quantity: 10,
            confidence: 90,
            type: "stock_in" as const,
            corrected: false,
          },
        ],
        save: mockSave,
      };

      mockOcrFindOne.mockResolvedValue(mockScan);
      mockProductFindById.mockResolvedValue({ _id: "507f191e810c19729de860ed", name: "Riz", sellPrice: 500 });
      mockProductFindByIdAndUpdate.mockResolvedValue({});

      const result = await ocrService.importValidatedScan("507f191e810c19729de860ee", storeId);
      expect(result.importedCount).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockProductFindByIdAndUpdate).toHaveBeenCalledWith(
        "507f191e810c19729de860ed",
        { $inc: { quantity: 10 } }
      );
    });

    it("ignore les lignes à faible confiance", async () => {
      const mockSave = jest.fn().mockResolvedValue({});
      const mockScan = {
        _id: "507f191e810c19729de860ef",
        storeId,
        status: "validated",
        lines: [
          {
            text: "brouillon",
            confidence: 20,
            type: "stock_in" as const,
            productId: "507f191e810c19729de860ea",
            quantity: 5,
            corrected: false,
          },
        ],
        save: mockSave,
      };

      mockOcrFindOne.mockResolvedValue(mockScan);
      const result = await ocrService.importValidatedScan("507f191e810c19729de860ef", storeId);
      expect(result.importedCount).toBe(0);
      expect(mockProductFindByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("rejette si le scan n'existe pas", async () => {
      mockOcrFindOne.mockResolvedValue(null);
      await expect(
        ocrService.importValidatedScan("507f191e810c19729de860f0", storeId)
      ).rejects.toThrow("Scan introuvable");
    });
  });
});
