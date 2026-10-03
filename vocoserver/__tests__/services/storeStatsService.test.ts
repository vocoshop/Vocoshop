jest.mock("../../src/models/Store", () => ({
  __esModule: true,
  default: { aggregate: jest.fn() },
}));

import Store from "../../src/models/Store";
import {
  getStoreStats,
  getAgentStoreStats,
  getTopCities,
} from "../../src/services/storeStatsService";

const aggregateMock = Store.aggregate as unknown as jest.Mock;

describe("storeStatsService", () => {
  beforeEach(() => {
    aggregateMock.mockReset();
  });

  describe("getStoreStats", () => {
    it("should return all-zero counters when the collection is empty", async () => {
      aggregateMock.mockReturnValue([]);

      const stats = await getStoreStats();

      expect(stats).toEqual({
        active: 0,
        trial: 0,
        grace: 0,
        expired: 0,
        unused: 0,
      });
    });

    it("should sum counters per computed subscription status", async () => {
      aggregateMock.mockReturnValue([
        { _id: "active", count: 12 },
        { _id: "trial", count: 5 },
        { _id: "expired", count: 3 },
      ]);

      const stats = await getStoreStats();

      expect(stats.active).toBe(12);
      expect(stats.trial).toBe(5);
      expect(stats.expired).toBe(3);
      expect(stats.grace).toBe(0);
      expect(stats.unused).toBe(0);
    });

    it("should keep unknown statuses as their own key", async () => {
      aggregateMock.mockReturnValue([{ _id: "cancelled", count: 2 }]);

      const stats = await getStoreStats();

      expect((stats as any).cancelled).toBe(2);
      expect(stats.active).toBe(0);
    });

    it("should not read the stores from Node memory (server-side aggregation)", async () => {
      aggregateMock.mockReturnValue([]);
      const findSpy = jest.fn();
      (Store as any).find = findSpy;

      await getStoreStats();

      expect(findSpy).not.toHaveBeenCalled();
      expect(aggregateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getAgentStoreStats", () => {
    it("should return an empty map when there is no store", async () => {
      aggregateMock.mockReturnValue([]);

      await expect(getAgentStoreStats()).resolves.toEqual({});
    });

    it("should scope the aggregation to the given agent codes", async () => {
      aggregateMock.mockReturnValue([{ _id: "agent1", total: 2, active: 2 }]);

      await getAgentStoreStats(["agent1"]);

      const pipeline = aggregateMock.mock.calls[0][0] as any[];
      expect(pipeline[0].$match).toEqual({ agentCode: { $in: ["agent1"] } });
    });

    it("should not query when the agent code list is empty", async () => {
      await expect(getAgentStoreStats([])).resolves.toEqual({});

      expect(aggregateMock).not.toHaveBeenCalled();
    });

    it("should compute inactive as total minus active", async () => {
      aggregateMock.mockReturnValue([
        { _id: "agent1", total: 10, active: 4 },
        { _id: "agent2", total: 3, active: 3 },
      ]);

      const stats = await getAgentStoreStats();

      expect(stats.agent1).toEqual({ total: 10, active: 4, inactive: 6 });
      expect(stats.agent2).toEqual({ total: 3, active: 3, inactive: 0 });
    });

    it("should skip rows without agentCode", async () => {
      aggregateMock.mockReturnValue([
        { _id: null, total: 5, active: 1 },
        { _id: "agent1", total: 2, active: 2 },
      ]);

      const stats = await getAgentStoreStats();

      expect(Object.keys(stats)).toEqual(["agent1"]);
    });

    it("should tolerate missing count fields", async () => {
      aggregateMock.mockReturnValue([{ _id: "agent1" }]);

      const stats = await getAgentStoreStats();

      expect(stats.agent1).toEqual({ total: 0, active: 0, inactive: 0 });
    });
  });

  describe("getTopCities", () => {
    it("should map aggregation rows to city objects", async () => {
      aggregateMock.mockReturnValue([
        { _id: "Brazzaville", count: 40 },
        { _id: "Pointe-Noire", count: 25 },
      ]);

      await expect(getTopCities()).resolves.toEqual([
        { city: "Brazzaville", count: 40 },
        { city: "Pointe-Noire", count: 25 },
      ]);
    });

    it("should return an empty list when there is no city", async () => {
      aggregateMock.mockReturnValue([]);

      await expect(getTopCities()).resolves.toEqual([]);
    });
  });
});