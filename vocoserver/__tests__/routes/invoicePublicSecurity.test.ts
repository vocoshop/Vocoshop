/**
=====================================================
🧾 SÉCURITÉ ENDPOINT PUBLIC FACTURE
=====================================================
✔ invoiceNumber seul ne suffit plus (était énumérable)
✔ Jeton `t` obligatoire + rate limit
✔ Aucun secret exposé dans la réponse
✔ 404 indistinguable (pas d'oracle d'existence)
*/
/* Le vrai mongoose est nécessaire pour lire le schéma (test du default
   du jeton) ; on neutralise findOne avec un spy plutôt qu'un jest.mock. */
jest.unmock("mongoose");

import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import Invoice from "../../src/models/Invoice";

const findOneSpy = jest.spyOn(Invoice, "findOne");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  app.use("/api/invoices", require("../../src/routes/invoiceRoutes").default);
  return app;
};

const validToken = "a".repeat(48);

const fakeInvoice = {
  invoiceNumber: "VOC-2026-482913",
  plan: "PRO",
  amount: 15000,
  currency: "XAF",
  billingPeriodStart: new Date("2026-01-01"),
  billingPeriodEnd: new Date("2026-01-31"),
  paidAt: new Date("2026-01-05"),
  // 👇 champs qui ne doivent JAMAIS sortir
  storeId: new mongoose.Types.ObjectId(),
  transactionId: "TXN-SECRET-123",
  publicToken: validToken,
};

beforeAll(() => {
  process.env.DISABLE_RATE_LIMIT = "1";
});

afterAll(() => {
  findOneSpy.mockReset();
});

describe("GET /api/invoices/public/:invoiceNumber", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("404 sans jeton (aucune requête DB)", async () => {
    const res = await request(buildApp())
      .get("/api/invoices/public/VOC-2026-482913")
      .expect(404);

    expect(res.body.error).toBe("Facture introuvable");
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  test("404 avec jeton invalide", async () => {
    findOneSpy.mockReturnValue({
      lean: () => Promise.resolve(null),
    } as any);

    const res = await request(buildApp())
      .get("/api/invoices/public/VOC-2026-482913?t=deadbeef")
      .expect(404);

    expect(res.body.error).toBe("Facture introuvable");
  });

  test("la requête DB filtre sur invoiceNumber ET publicToken", async () => {
    findOneSpy.mockReturnValue({
      lean: () => Promise.resolve(null),
    } as any);

    await request(buildApp())
      .get("/api/invoices/public/VOC-2026-482913?t=deadbeef")
      .expect(404);

    expect(findOneSpy).toHaveBeenCalledWith({
      invoiceNumber: "VOC-2026-482913",
      publicToken: "deadbeef",
    });
  });

  test("200 avec le bon jeton", async () => {
    findOneSpy.mockReturnValue({
      lean: () => Promise.resolve(fakeInvoice),
    } as any);

    const res = await request(buildApp())
      .get(`/api/invoices/public/VOC-2026-482913?t=${validToken}`)
      .expect(200);

    expect(res.body.invoiceNumber).toBe("VOC-2026-482913");
    expect(res.body.amount).toBe(15000);
    expect(res.body.status).toBe("PAYEE");
  });

  test("la réponse n'expose NI storeId NI transactionId NI publicToken", async () => {
    findOneSpy.mockReturnValue({
      lean: () => Promise.resolve(fakeInvoice),
    } as any);

    const res = await request(buildApp())
      .get(`/api/invoices/public/VOC-2026-482913?t=${validToken}`)
      .expect(200);

    expect(res.body).not.toHaveProperty("storeId");
    expect(res.body).not.toHaveProperty("transactionId");
    expect(res.body).not.toHaveProperty("publicToken");
    expect(res.body).not.toHaveProperty("_id");
    expect(res.body).not.toHaveProperty("__v");
  });

  test("facture impayée => status EN_ATTENTE", async () => {
    findOneSpy.mockReturnValue({
      lean: () => Promise.resolve({ ...fakeInvoice, paidAt: null }),
    } as any);

    const res = await request(buildApp())
      .get(`/api/invoices/public/VOC-2026-482913?t=${validToken}`)
      .expect(200);

    expect(res.body.status).toBe("EN_ATTENTE");
  });
});

describe("génération du jeton", () => {

  test("default Mongoose = 48 hex chars (24 octets aléatoires)", () => {
    /* path.default est l'objet SchemaDefaultValue de Mongoose :
       getDefault() l'évalue réellement. */
    const path = Invoice.schema.path("publicToken") as any;
    const a = path.getDefault();
    const b = path.getDefault();

    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(b).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });

  test("invoiceNumber reste lisible et séquentiel-compatible", () => {
    expect(Invoice.schema.path("invoiceNumber").options.required).toBe(true);
  });
});