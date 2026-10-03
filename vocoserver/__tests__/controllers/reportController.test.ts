import crypto from "crypto";

/* ------------------------------------------------------
Model mocks (for all controller/service imports)
------------------------------------------------------ */
jest.mock("../../src/models/Product", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    countDocuments: jest.fn(),
  },
}));
jest.mock("../../src/models/StockHistory", () => ({}));
jest.mock("../../src/models/Store", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));
jest.mock("../../src/models/OcrScan", () => ({}));
jest.mock("qrcode", () => ({
  toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,report"),
}));
jest.mock("../../src/blockchain/vocoScore", () => ({
  computeScore: jest.fn().mockResolvedValue({ overallScore: 80 }),
}));
jest.mock("../../src/models/Sales", () => ({}));
jest.mock("../../src/models/Counter", () => ({ findOneAndUpdate: jest.fn() }));

jest.mock("../../src/models/SharedReportLink", () => ({
  findOne: jest.fn(), findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(), updateMany: jest.fn(), create: jest.fn(),
}));

jest.mock("../../src/models/DailyReport", () => ({
  find: jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })),
  distinct: jest.fn().mockResolvedValue([]),
}));

// BlockchainProof mock
jest.mock("../../src/models/BlockchainProof", () => {
  const find = jest.fn(() => ({
    sort: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })),
  }));
  const findOne = jest.fn(() => ({
    sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
  }));
  const create = jest.fn().mockResolvedValue({});
  return { find, findOne, create };
});

// ethers virtual mock (dynamic import in anchorOnBlockchain)
jest.mock("ethers", () => ({}), { virtual: true });

// Keep blockchainAnchorService real EXCEPT anchorOnBlockchain (which uses ethers)
jest.mock("../../src/services/blockchainAnchorService", () => {
  const actual = jest.requireActual("../../src/services/blockchainAnchorService");
  actual.anchorOnBlockchain = jest.fn().mockResolvedValue({
    txHash: null, blockNumber: null, chainId: null, explorerUrl: null,
  });
  return actual;
});

/* ------------------------------------------------------
Imports
------------------------------------------------------ */
import { computeDataHash, viewSharedReport } from "../../src/controllers/reportController";
import {
  anchorReport, getAnchorsForHash, getProofChain,
} from "../../src/services/blockchainAnchorService";

// Get mocked model refs
const BlockchainProof = jest.requireMock("../../src/models/BlockchainProof") as any;
const SharedReportLink = jest.requireMock("../../src/models/SharedReportLink") as any;
const Product = jest.requireMock("../../src/models/Product").default as any;
const Store = jest.requireMock("../../src/models/Store").default as any;
const DailyReport = jest.requireMock("../../src/models/DailyReport") as any;

/* ========================================================================
computeDataHash — pure function, 0 mocks needed
======================================================================== */
describe("computeDataHash", () => {
  it("produit un hash hex 64", () => {
    const h = computeDataHash({
      revenue: 1000, cogs: 400, grossProfit: 600, netProfit: 500,
      salesCount: 10, marginPercent: 60, from: "2026-01-01", to: "2026-01-31",
      rows: [{ date: "2026-01-15", revenue: 1000, cogs: 400, profit: 600, sales: 10 }],
    });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("mêmes entrées = même hash", () => {
    const input = {
      revenue: 250000, cogs: 120000, grossProfit: 130000, netProfit: 110000,
      salesCount: 45, marginPercent: 52, from: "2026-02-01", to: "2026-02-28",
      rows: [
        { date: "2026-02-05", revenue: 120000, cogs: 60000, profit: 55000, sales: 20 },
        { date: "2026-02-15", revenue: 130000, cogs: 60000, profit: 55000, sales: 25 },
      ],
    };
    expect(computeDataHash(input)).toBe(computeDataHash(input));
  });

  it("entrées ≠ hash ≠", () => {
    const base = {
      revenue: 1000, cogs: 400, grossProfit: 600, netProfit: 500,
      salesCount: 10, marginPercent: 60, from: "2026-01-01", to: "2026-01-31",
      rows: [{ date: "2026-01-15", revenue: 1000, cogs: 400, profit: 600, sales: 10 }],
    };
    expect(computeDataHash(base)).not.toBe(computeDataHash({ ...base, revenue: 2000 }));
  });

  it("zéro revenue / lignes vides", () => {
    const h = computeDataHash({
      revenue: 0, cogs: 0, grossProfit: 0, netProfit: 0,
      salesCount: 0, marginPercent: 0, from: "2026-01-01", to: "2026-01-31", rows: [],
    });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

/* ========================================================================
blockchainAnchorService — tests unitaires
======================================================================== */
describe("blockchainAnchorService — anchorReport", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("type database sans wallet, chaîne genesis si pas de précédent", async () => {
    const result = await anchorReport({
      dataHash: "hash_001",
      storeId: "store_001",
      month: "2026-03",
    });

    expect(result.type).toBe("database");
    expect(result.chainHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.previousHash).toBeNull();
    expect(result.txHash).toBeNull();
    expect(BlockchainProof.create).toHaveBeenCalledTimes(1);
    expect(BlockchainProof.create).toHaveBeenCalledWith(expect.objectContaining({
      dataHash: result.chainHash,
      previousHash: null,
      anchorType: "database",
      storeId: "store_001",
      month: "2026-03",
    }));
  });

  it("chaîne les hash quand preuve précédente existe", async () => {
    const prevChainHash = crypto.createHash("sha256").update("prev").digest("hex");
    BlockchainProof.findOne.mockReturnValue({
      sort: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({ dataHash: prevChainHash }),
      })),
    });

    const result = await anchorReport({
      dataHash: "hash_002",
      storeId: "store_001",
      month: "2026-04",
    });

    expect(result.previousHash).toBe(prevChainHash);
    const expected = crypto.createHash("sha256").update("hash_002" + prevChainHash).digest("hex");
    expect(result.chainHash).toBe(expected);
  });

  it("remonte l'erreur si BlockchainProof.create échoue (le controller la catch)", async () => {
    BlockchainProof.create.mockRejectedValue(new Error("DB error"));

    await expect(anchorReport({
      dataHash: "hash_003",
      storeId: "store_001",
      month: "2026-05",
    })).rejects.toThrow("DB error");
  });
});

/* blockchainAnchorService — getAnchorsForHash */
describe("blockchainAnchorService — getAnchorsForHash", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("retourne les preuves par dataHash", async () => {
    BlockchainProof.find.mockReturnValue({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue([
            { dataHash: "proof_a", anchorType: "database", storeId: "store_001" },
          ]),
        })),
      })),
    });

    const results = await getAnchorsForHash("some_data_hash");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].dataHash).toBe("proof_a");
  });

  it("retourne vide si aucun hash ne correspond", async () => {
    BlockchainProof.find.mockReturnValue({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue([]),
        })),
      })),
    });

    const results = await getAnchorsForHash("hash_inconnu");
    expect(results).toHaveLength(0);
  });
});

/* blockchainAnchorService — getProofChain */
describe("blockchainAnchorService — getProofChain", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("retourne la liste triée", async () => {
    BlockchainProof.find.mockReturnValue({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          lean: jest.fn().mockResolvedValue([{ dataHash: "a" }, { dataHash: "b" }]),
        })),
      })),
    });

    const chain = await getProofChain(2);
    expect(chain).toHaveLength(2);
  });
});

describe("viewSharedReport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SharedReportLink.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "link-1",
        storeId: "store-1",
        month: "2026-01",
        token: "a".repeat(64),
        expiresAt: new Date(Date.now() + 86400000),
        storeName: "Commerce",
      }),
    });
    SharedReportLink.updateOne.mockResolvedValue({});
    Store.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        storeName: "<script>alert(1)</script>",
        ownerName: "\"><img src=x onerror=alert(2)>",
        city: "<svg onload=alert(3)>",
        phone: "\"javascript:alert(4)\"",
        shopId: "<b>shop</b>",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    });
    Product.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { name: "</script><script>alert(5)</script>", quantity: 4, sellPrice: 1000, purchasePrice: 500 },
      ]),
    });
    Product.countDocuments.mockResolvedValue(1);
    DailyReport.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          date: "2026-01-15",
          totalRevenue: 4000,
          grossProfit: 2000,
          cogs: 2000,
          totalSales: 4,
          sales: [{ productName: "</script><script>alert(5)</script>", quantity: 4, totalAmount: 4000 }],
        },
      ]),
    });
    DailyReport.distinct.mockResolvedValue(["2026-01-15"]);
  });

  it("échappe les données du rapport et les valeurs intégrées au script", async () => {
    const response: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    const request: any = {
      params: { id: "a".repeat(64) },
      query: { month: "\"><script>alert(6)</script>" },
      headers: {},
      get: jest.fn().mockReturnValue("reports.example.test"),
    };

    await viewSharedReport(request, response);

    expect(response.status).toHaveBeenCalledWith(200);
    const html = response.send.mock.calls[0][0] as string;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("</script><script>alert(5)</script>");
    expect(html).not.toContain("\"><script>alert(6)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("\\u003c/script\\u003e\\u003cscrip");
  });
});
