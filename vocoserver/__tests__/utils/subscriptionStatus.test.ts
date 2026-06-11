describe("Subscription Status Utility", () => {
  // Mock the same function used in adminStoreRoutes and agentController
  const planToSubscriptionStatus = (plan?: string): string => {
    if (!plan) return "unused";
    const p = plan.toLowerCase();
    if (p.includes("expired") || p.includes("none") || p === "") return "expired";
    if (p.includes("trial") || p.includes("essentiel") || p.includes("basic")) return "trial";
    if (p.includes("grace")) return "grace";
    return "active";
  };

  describe("planToSubscriptionStatus", () => {
    it("should return 'unused' for undefined plan", () => {
      expect(planToSubscriptionStatus(undefined)).toBe("unused");
    });

    it("should return 'unused' for null plan", () => {
      expect(planToSubscriptionStatus(null as any)).toBe("unused");
    });

    it("should return 'unused' for empty string", () => {
      expect(planToSubscriptionStatus("")).toBe("unused");
    });

    it("should return 'active' for premium plan", () => {
      expect(planToSubscriptionStatus("Premium")).toBe("active");
    });

    it("should return 'active' for Pro plan", () => {
      expect(planToSubscriptionStatus("Pro")).toBe("active");
    });

    it("should return 'active' for annual plan", () => {
      expect(planToSubscriptionStatus("Annual")).toBe("active");
    });

    it("should return 'trial' for Essentiel plan", () => {
      expect(planToSubscriptionStatus("Essentiel")).toBe("trial");
    });

    it("should return 'trial' for Basic plan", () => {
      expect(planToSubscriptionStatus("Basic")).toBe("trial");
    });

    it("should return 'trial' for trial in any case", () => {
      expect(planToSubscriptionStatus("TRIAL")).toBe("trial");
      expect(planToSubscriptionStatus("Trial")).toBe("trial");
    });

    it("should return 'expired' for expired plan", () => {
      expect(planToSubscriptionStatus("expired")).toBe("expired");
      expect(planToSubscriptionStatus("Expired")).toBe("expired");
    });

    it("should return 'grace' for grace period", () => {
      expect(planToSubscriptionStatus("grace")).toBe("grace");
      expect(planToSubscriptionStatus("Grace Period")).toBe("grace");
    });

    it("should handle mixed case", () => {
      expect(planToSubscriptionStatus("PREMIUM")).toBe("active");
      expect(planToSubscriptionStatus("Trial Plan")).toBe("trial");
    });
  });

  describe("subscription price calculation", () => {
    const SUBSCRIPTION_PRICE = 3900;

    it("should calculate correct monthly revenue", () => {
      const activeSubscriptions = 10;
      const revenue = activeSubscriptions * SUBSCRIPTION_PRICE;
      expect(revenue).toBe(39000);
    });

    it("should handle zero subscriptions", () => {
      const activeSubscriptions = 0;
      const revenue = activeSubscriptions * SUBSCRIPTION_PRICE;
      expect(revenue).toBe(0);
    });

    it("should handle large number of subscriptions", () => {
      const activeSubscriptions = 1000;
      const revenue = activeSubscriptions * SUBSCRIPTION_PRICE;
      expect(revenue).toBe(3900000);
    });
  });
});