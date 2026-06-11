import request from "supertest";
import express from "express";
import { authLimiter, otpLimiter } from "../../src/middleware/rateLimiter";

describe("Rate Limiter Middleware", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Test route with auth limiter
    app.post("/test-auth", authLimiter, (req, res) => {
      res.json({ success: true });
    });

    // Test route with OTP limiter
    app.post("/test-otp", otpLimiter, (req, res) => {
      res.json({ success: true });
    });
  });

  describe("authLimiter", () => {
    it("should allow requests under the limit", async () => {
      const res = await request(app)
        .post("/test-auth")
        .send({});
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should include rate limit headers", async () => {
      const res = await request(app)
        .post("/test-auth")
        .send({});
      
      expect(res.headers["ratelimit-limit"]).toBeDefined();
      expect(res.headers["ratelimit-remaining"]).toBeDefined();
    });
  });

  describe("otpLimiter", () => {
    it("should allow OTP requests under the limit", async () => {
      const res = await request(app)
        .post("/test-otp")
        .send({});
      
      expect(res.status).toBe(200);
    });

    it("should block requests exceeding the limit", async () => {
      // Make 3 requests (max is 3 per minute)
      for (let i = 0; i < 3; i++) {
        await request(app).post("/test-otp").send({});
      }
      
      // 4th request should be blocked
      const res = await request(app)
        .post("/test-otp")
        .send({});
      
      expect(res.status).toBe(429);
      expect(res.body.error).toContain("Trop de codes");
    });
  });
});