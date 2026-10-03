import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const mockStoreFindOne = jest.fn();
const mockStoreUpdateOne = jest.fn();
const mockStoreUpdateMany = jest.fn();
const mockStoreAggregate = jest.fn();
const mockAgentFindOne = jest.fn();
const mockAgentUpdateOne = jest.fn();
const mockNotificationCreate = jest.fn();
const mockProductFindOne = jest.fn();
const mockProductFindOneAndUpdate = jest.fn();
const mockProductCreate = jest.fn();
const mockPreprocessForVision = jest.fn();

jest.mock("openai", () => {
  const OpenAI = jest.fn().mockImplementation(() => ({
    responses: { create: jest.fn() },
  }));
  return { __esModule: true, default: OpenAI };
});

jest.mock("../../src/middleware/authMiddleware", () => ({
  __esModule: true,
  default: (req: any, _res: any, next: any) => {
    const actorId = String(req.headers["x-test-actor"] || "admin");
    req.user = {
      id: actorId,
      userId: actorId,
      storeId: "store-test",
      role: "owner",
      permissions: { "*": true },
    };
    next();
  },
}));

jest.mock("../../src/models/Store", () => ({
  __esModule: true,
  default: {
    findOne: mockStoreFindOne,
    updateOne: mockStoreUpdateOne,
    updateMany: mockStoreUpdateMany,
    aggregate: mockStoreAggregate,
  },
}));

jest.mock("../../src/models/Agent", () => ({
  __esModule: true,
  default: {
    findOne: mockAgentFindOne,
    updateOne: mockAgentUpdateOne,
    countDocuments: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock("../../src/models/Notification", () => ({
  __esModule: true,
  default: { create: mockNotificationCreate },
}));

jest.mock("../../src/models/Invoice", () => ({
  __esModule: true,
  default: { aggregate: jest.fn().mockResolvedValue([]) },
}));

jest.mock("../../src/models/Product", () => ({
  __esModule: true,
  default: {
    findOne: mockProductFindOne,
    findOneAndUpdate: mockProductFindOneAndUpdate,
    create: mockProductCreate,
  },
}));

jest.mock("../../src/services/securityMonitor", () => ({
  SecurityMonitor: {
    getHealthReport: jest.fn(),
    getActivityFeed: jest.fn(),
  },
}));

jest.mock("../../src/services/platformAnalyzer", () => ({
  PlatformAnalyzer: {
    getOverview: jest.fn(),
  },
}));

jest.mock("../../src/services/imagePreprocess", () => ({
  preprocessForVision: mockPreprocessForVision,
}));

import aiRoutes from "../../src/routes/aiRoutes";
import { AICommandExecutor } from "../../src/services/aiCommandExecutor";

const app = express();
app.use(express.json());
app.use("/ai", aiRoutes);

const validStoreId = "507f191e810c19729de860ea";
const validImage = "data:image/jpeg;base64,QUFB";

describe("VocoAI confirmation de sécurité", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-for-ai-confirmation";
    jest.clearAllMocks();
    mockStoreFindOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: validStoreId, storeName: "Boutique test" }),
    });
    mockStoreUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("ne pas exécuter une action naturelle avant confirmation", async () => {
    const response = await request(app)
      .post("/ai/admin-chat")
      .send({ messages: [{ role: "user", content: `suspendre boutique ${validStoreId}` }] });

    expect(response.status).toBe(200);
    expect(response.body.confirmationRequired).toBe(true);
    expect(typeof response.body.confirmationToken).toBe("string");
    expect(response.body.reply).toContain("CONFIRMER");
    expect(mockStoreUpdateOne).not.toHaveBeenCalled();
  });

  it("exécute l’action après un jeton valide", async () => {
    const challenge = await request(app)
      .post("/ai/admin-chat")
      .send({ command: "suspendre_boutique", params: { storeId: validStoreId } });

    expect(challenge.status).toBe(200);
    expect(challenge.body.confirmationRequired).toBe(true);
    expect(mockStoreUpdateOne).not.toHaveBeenCalled();

    const response = await request(app)
      .post("/ai/admin-chat")
      .send({ confirmationToken: challenge.body.confirmationToken });

    expect(response.status).toBe(200);
    expect(response.body.result.success).toBe(true);
    expect(mockStoreUpdateOne).toHaveBeenCalledWith(
      { _id: validStoreId },
      { $set: { subscriptionStatus: "suspended" } }
    );
  });

  it("lie le jeton à l’admin qui l’a demandé", async () => {
    const token = AICommandExecutor.createConfirmationToken(
      "suspendre_boutique",
      { storeId: validStoreId },
      "admin"
    );

    const response = await request(app)
      .post("/ai/admin-chat")
      .set("x-test-actor", "other-admin")
      .send({ confirmationToken: token });

    expect(response.status).toBe(403);
    expect(mockStoreUpdateOne).not.toHaveBeenCalled();
  });

  it("refuse un jeton altéré ou expiré", async () => {
    const token = AICommandExecutor.createConfirmationToken(
      "suspendre_boutique",
      { storeId: validStoreId },
      "admin"
    );
    const expiredToken = jwt.sign(
      {
        type: "voco_ai_action",
        command: "suspendre_boutique",
        params: { storeId: validStoreId },
        actorId: "admin",
      },
      process.env.JWT_SECRET!,
      { audience: "voco-ai-admin", issuer: "voco-ai", expiresIn: -1 }
    );

    const alteredResponse = await request(app)
      .post("/ai/admin-chat")
      .send({ confirmationToken: `${token}x` });
    const expiredResponse = await request(app)
      .post("/ai/admin-chat")
      .send({ confirmationToken: expiredToken });

    expect(alteredResponse.status).toBe(403);
    expect(expiredResponse.status).toBe(403);
    expect(mockStoreUpdateOne).not.toHaveBeenCalled();
  });

  it("refuse les images en excès avant tout prétraitement", async () => {
    const response = await request(app)
      .post("/ai/vision-products")
      .send({ images: Array.from({ length: 7 }, () => validImage) });

    expect(response.status).toBe(400);
    expect(mockPreprocessForVision).not.toHaveBeenCalled();
  });

  it("refuse un nom de produit trop long pour la suggestion", async () => {
    const response = await request(app)
      .post("/ai/suggest-category")
      .send({ name: "x".repeat(201) });

    expect(response.status).toBe(400);
  });
});
