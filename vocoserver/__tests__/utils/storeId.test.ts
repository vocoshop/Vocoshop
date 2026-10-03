import { getStoreId } from "../../src/utils/storeId";

const OBJECT_ID_A = "507f1f77bcf86cd799439011";
const OBJECT_ID_B = "507f191e810c19729de860ea";

const buildReq = (overrides: any = {}) => ({
  headers: {},
  body: {},
  ...overrides,
}) as any;

describe("getStoreId", () => {
  describe("JWT prioritaire", () => {
    it("should return the storeId from the token", () => {
      const req = buildReq({ user: { storeId: ` ${OBJECT_ID_A} ` } });

      expect(getStoreId(req)).toBe(OBJECT_ID_A);
    });

    it("should ignore a conflicting x-store-id header (anti-tenant hijack)", () => {
      const req = buildReq({
        user: { storeId: OBJECT_ID_A },
        headers: { "x-store-id": OBJECT_ID_B },
      });

      expect(getStoreId(req)).toBe(OBJECT_ID_A);
    });

    it("should ignore a conflicting body.storeId (anti-tenant hijack)", () => {
      const req = buildReq({
        user: { storeId: OBJECT_ID_A, role: "employee" },
        body: { storeId: OBJECT_ID_B },
      });

      expect(getStoreId(req)).toBe(OBJECT_ID_A);
    });
  });

  describe("Principaux non boutiques", () => {
    it("should refuse the header for an authenticated user without store", () => {
      const req = buildReq({
        headers: { "x-store-id": OBJECT_ID_B },
      });

      expect(getStoreId(req)).toBeNull();
    });

    it("should refuse the body for an authenticated user without store", () => {
      const req = buildReq({
        user: { storeId: null, role: "employee", permissions: {} },
        body: { storeId: OBJECT_ID_B },
      });

      expect(getStoreId(req)).toBeNull();
    });

    it("should refuse when no principal is attached at all", () => {
      const req = buildReq({
        headers: { "x-store-id": OBJECT_ID_B },
        body: { storeId: OBJECT_ID_B },
      });

      expect(getStoreId(req)).toBeNull();
    });

    it("should refuse a non-owner role even with wildcard permissions", () => {
      const req = buildReq({
        user: { storeId: null, role: "employee", permissions: { "*": true } },
        body: { storeId: OBJECT_ID_B },
      });

      expect(getStoreId(req)).toBeNull();
    });
  });

  describe("Principaux plateforme", () => {
    const admin = { storeId: null, role: "owner", permissions: { "*": true } };

    it("should accept a valid x-store-id header", () => {
      const req = buildReq({
        user: admin,
        headers: { "x-store-id": OBJECT_ID_B },
      });

      expect(getStoreId(req)).toBe(OBJECT_ID_B);
    });

    it("should fall back to body.storeId", () => {
      const req = buildReq({ user: admin, body: { storeId: OBJECT_ID_A } });

      expect(getStoreId(req)).toBe(OBJECT_ID_A);
    });

    it("should prefer the header over the body", () => {
      const req = buildReq({
        user: admin,
        headers: { "x-store-id": OBJECT_ID_B },
        body: { storeId: OBJECT_ID_A },
      });

      expect(getStoreId(req)).toBe(OBJECT_ID_B);
    });

    it("should reject a Mongo operator injected as a string", () => {
      const req = buildReq({ user: admin, body: { storeId: '{"$ne":null}' } });

      expect(getStoreId(req)).toBeNull();
    });

    it("should reject a non-ObjectId string", () => {
      const req = buildReq({ user: admin, body: { storeId: "store-1" } });

      expect(getStoreId(req)).toBeNull();
    });

    it("should reject a non-string body value", () => {
      const req = buildReq({ user: admin, body: { storeId: { $ne: null } } });

      expect(getStoreId(req)).toBeNull();
    });

    it("should return null when the admin provides no store", () => {
      const req = buildReq({ user: admin });

      expect(getStoreId(req)).toBeNull();
    });

    it("should read the first value of a repeated header", () => {
      const req = buildReq({
        user: admin,
        headers: { "x-store-id": [OBJECT_ID_B, OBJECT_ID_A] },
      });

      expect(getStoreId(req)).toBe(OBJECT_ID_B);
    });
  });
});