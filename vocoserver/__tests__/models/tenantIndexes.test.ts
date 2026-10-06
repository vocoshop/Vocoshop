/* Les métadonnées d'index sont hors-ligne : on utilise le vrai mongoose
   (setupTests.ts le mock globalement pour les autres suites). */
jest.unmock("mongoose");

import Store from "../../src/models/Store";
import Product from "../../src/models/Product";
import StockHistory from "../../src/models/StockHistory";
import InventoryHistory from "../../src/models/InventoryHistory";
import InventorySession from "../../src/models/InventorySession";
import Invoice from "../../src/models/Invoice";
import Notification from "../../src/models/Notification";
import Commission from "../../src/models/Commission";

/* Liste les couples de champs déclarés via Schema.index(),
   sans caring de l'ordre directionnel ni du nom auto-généré. */
const indexKeys = (model: any): string[][] =>
  model.schema.indexes().map((spec: any[]) =>
    (spec[0] as Record<string, number>)
      ? Object.keys(spec[0])
      : (spec[0] as any)
  );

const hasIndex = (model: any, keys: string[]) =>
  indexKeys(model).some((k) => JSON.stringify(k) === JSON.stringify(keys));

const indexOptions = (model: any, keys: string[]) =>
  model.schema.indexes().find(
    (spec: any[]) => JSON.stringify(Object.keys(spec[0])) === JSON.stringify(keys)
  )?.[1] ?? {};

describe("Tenant-scoped model indexes", () => {
  describe("Store", () => {
    it("should index agentCode + createdAt for admin-manager listings", () => {
      expect(hasIndex(Store, ["agentCode", "createdAt"])).toBe(true);
    });

    it("should index lastActiveAt for inactivity counters", () => {
      expect(hasIndex(Store, ["lastActiveAt"])).toBe(true);
    });

    it("should index subscriptionStatus + paidUntil for stats aggregation", () => {
      expect(hasIndex(Store, ["subscriptionStatus", "paidUntil"])).toBe(true);
    });
  });

  describe("Product", () => {
    it("should index storeId + barcode", () => {
      expect(hasIndex(Product, ["storeId", "barcode"])).toBe(true);
    });

    it("should enforce uniqueness on storeId + barcode", () => {
      expect(indexOptions(Product, ["storeId", "barcode"]).unique).toBe(true);
    });

    /* `sparse: true` ignore les champs ABSENTS mais pas les chaines vides :
       tous les produits sans code (barcode: "") entraient en collision sur
       (storeId, "") et rendaient l'index impossible a creer. */
    it("should NOT rely on sparse alone to skip empty barcodes", () => {
      expect(indexOptions(Product, ["storeId", "barcode"]).sparse).toBeUndefined();
    });

    it("should restrict the unique index to non-empty string barcodes", () => {
      expect(
        indexOptions(Product, ["storeId", "barcode"]).partialFilterExpression
      ).toEqual({ barcode: { $type: "string", $gt: "" } });
    });
  });

  describe("StockHistory", () => {
    it("should index storeId + appliedAt for history listing", () => {
      expect(hasIndex(StockHistory, ["storeId", "appliedAt"])).toBe(true);
    });

    it("should index sessionId + storeId for session lookups", () => {
      expect(hasIndex(StockHistory, ["sessionId", "storeId"])).toBe(true);
    });

    it("should index storeId + productId + appliedAt for product rollups", () => {
      expect(hasIndex(StockHistory, ["storeId", "productId", "appliedAt"])).toBe(true);
    });
  });

  describe("InventoryHistory", () => {
    it("should index storeId + createdAt", () => {
      expect(hasIndex(InventoryHistory, ["storeId", "createdAt"])).toBe(true);
    });
  });

  describe("InventorySession", () => {
    it("should index storeId + createdAt", () => {
      expect(hasIndex(InventorySession, ["storeId", "createdAt"])).toBe(true);
    });

    it("should index storeId + employeeId + createdAt for the current session", () => {
      expect(hasIndex(InventorySession, ["storeId", "employeeId", "createdAt"])).toBe(true);
    });

    it("should index storeId + status + appliedAt", () => {
      expect(hasIndex(InventorySession, ["storeId", "status", "appliedAt"])).toBe(true);
    });
  });

  describe("Invoice", () => {
    it("should index paidAt for the payment list sort", () => {
      expect(hasIndex(Invoice, ["paidAt", "_id"])).toBe(true);
    });

    it("should index storeId + paidAt", () => {
      expect(hasIndex(Invoice, ["storeId", "paidAt"])).toBe(true);
    });
  });

  describe("Notification", () => {
    it("should index storeId + createdAt for the notification feed", () => {
      expect(hasIndex(Notification, ["storeId", "createdAt"])).toBe(true);
    });

    it("should index storeId + isRead + createdAt for the unread badge", () => {
      expect(hasIndex(Notification, ["storeId", "isRead", "createdAt"])).toBe(true);
    });
  });

  describe("Commission", () => {
    it("should keep the unique agent/store/period index", () => {
      expect(hasIndex(Commission, ["agentCode", "storeId", "month", "year"])).toBe(true);
    });

    it("should index agentCode + status + createdAt for admin filters", () => {
      expect(hasIndex(Commission, ["agentCode", "status", "createdAt"])).toBe(true);
    });
  });
});