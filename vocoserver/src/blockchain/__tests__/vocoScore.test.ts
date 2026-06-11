jest.mock("../../models/Store", () => ({
  findOne: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue({
      shopId: "store_1",
      createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      loginCount: 45,
    }),
  })),
}));

jest.mock("../../models/Sales", () => ({
  find: jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })),
}));

jest.mock("../../models/StockHistory", () => ({
  find: jest.fn(() => ({ sort: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })) })),
}));

jest.mock("../../models/Subscription", () => ({
  findOne: jest.fn(() => ({
    sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue({ status: "active" }) })),
    lean: jest.fn().mockResolvedValue({ status: "active" }),
  })),
}));

jest.mock("../../models/MerchantScore", () => {
  const findOne = jest.fn(() => ({
    sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
    lean: jest.fn().mockResolvedValue(null),
  }));
  const find = jest.fn(() => ({ sort: jest.fn(() => ({ skip: jest.fn(() => ({ limit: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) })) })) }));
  const countDocuments = jest.fn().mockResolvedValue(0);
  const create = jest.fn().mockImplementation((data: any) => Promise.resolve({
    _id: "score_1",
    ...data,
    createdAt: new Date(),
  }));
  return { findOne, find, countDocuments, create };
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

import { computeScore, certifyScore, verifyScore, getScoreHistory, getScoreComponents } from "../vocoScore";

describe("vocoScore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("computeScore", () => {
    it("devrait calculer un score avec des composants", async () => {
      const result = await computeScore("store_1");

      expect(result).toBeDefined();
      expect(result.storeId).toBe("store_1");
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1000);
      expect(result.components).toHaveLength(8);
      expect(result.accountAgeDays).toBeGreaterThan(0);
    });

    it("devrait inclure tous les composants de score", async () => {
      const result = await computeScore("store_1");
      const componentNames = result.components.map((c) => c.name);

      expect(componentNames).toContain("account_age");
      expect(componentNames).toContain("transaction_frequency");
      expect(componentNames).toContain("revenue_stability");
      expect(componentNames).toContain("subscription_regularity");
      expect(componentNames).toContain("stock_management");
      expect(componentNames).toContain("sales_regularity");
      expect(componentNames).toContain("app_engagement");
      expect(componentNames).toContain("payment_history");
    });

    it("devrait avoir des poids qui totalisent 1", () => {
      const totalWeight = getScoreComponents().reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 1);
    });
  });

  describe("certifyScore", () => {
    it("devrait certifier un score et retourner les infos de chaîne", async () => {
      const result = await certifyScore("store_1");

      expect(result).toBeDefined();
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.chainHash).toBeTruthy();
      expect(result.certificationId).toBe(result.chainHash);
      expect(result.anchorType).toBe("database");
    });
  });

  describe("verifyScore", () => {
    it("devrait retourner le score courant même sans certification", async () => {
      const result = await verifyScore("store_1");

      expect(result.current).toBeDefined();
      expect(result.lastCertified).toBeNull();
      expect(result.verification).toBeNull();
    });
  });

  describe("getScoreHistory", () => {
    it("devrait retourner l historique des scores", async () => {
      const result = await getScoreHistory("store_1");
      expect(result.scores).toBeDefined();
      expect(typeof result.total).toBe("number");
    });
  });

  describe("getScoreComponents", () => {
    it("devrait retourner les définitions des composants", () => {
      const components = getScoreComponents();
      expect(components).toHaveLength(8);
      expect(components[0]).toHaveProperty("name");
      expect(components[0]).toHaveProperty("weight");
      expect(components[0]).toHaveProperty("maxScore");
    });
  });
});
