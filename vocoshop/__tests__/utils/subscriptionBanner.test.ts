describe("Subscription Banner Logic", () => {
  // Mock subscription banner logic from HomeScreen.tsx
  interface Subscription {
    status?: string;
    subscriptionStatus?: string;
    installedAt?: string;
    graceUntil?: string;
  }

  function getDaysLeft(subscription: Subscription | null): number {
    if (!subscription?.installedAt) return 0;
    
    const start = new Date(subscription.installedAt);
    const now = new Date();
    const diff = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const left = 30 - Math.floor(diff);
    return left > 0 ? left : 0;
  }

  function getGraceDaysLeft(subscription: Subscription | null): number {
    if (!subscription?.graceUntil) return 0;
    
    const now = new Date();
    const end = new Date(subscription.graceUntil);
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
  }

  function shouldShowBanner(subscription: Subscription | null): boolean {
    if (!subscription) return true;
    
    const status = subscription.status || subscription.subscriptionStatus;
    
    // Show banner if not active
    if (status === "active" || status === "trial_extended") {
      return false;
    }
    
    return true;
  }

  function isBlocked(subscription: Subscription | null): boolean {
    if (!subscription) return false;
    
    const status = subscription.status || subscription.subscriptionStatus;
    const daysLeft = getDaysLeft(subscription);
    const graceDaysLeft = getGraceDaysLeft(subscription);
    
    return (
      status === "expired" ||
      status === "blocked" ||
      (status === "trial" && daysLeft <= 0 && graceDaysLeft <= 0) ||
      (status === "grace" && graceDaysLeft <= 0)
    );
  }

  describe("getDaysLeft", () => {
    it("should return 0 when no installedAt", () => {
      expect(getDaysLeft({})).toBe(0);
      expect(getDaysLeft(null)).toBe(0);
    });

    it("should return days remaining from 30 day trial", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const subscription = { installedAt: yesterday.toISOString() };
      const days = getDaysLeft(subscription);
      
      expect(days).toBeGreaterThanOrEqual(28);
      expect(days).toBeLessThanOrEqual(30);
    });

    it("should return 0 when trial expired", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      
      const subscription = { installedAt: oldDate.toISOString() };
      
      expect(getDaysLeft(subscription)).toBe(0);
    });
  });

  describe("getGraceDaysLeft", () => {
    it("should return 0 when no graceUntil", () => {
      expect(getGraceDaysLeft({})).toBe(0);
    });

    it("should calculate remaining grace days", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);
      
      const subscription = { graceUntil: futureDate.toISOString() };
      const days = getGraceDaysLeft(subscription);
      
      expect(days).toBeGreaterThanOrEqual(1);
      expect(days).toBeLessThanOrEqual(3);
    });

    it("should return 0 or negative when grace period expired", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const subscription = { graceUntil: pastDate.toISOString() };
      
      expect(getGraceDaysLeft(subscription)).toBeLessThanOrEqual(0);
    });
  });

  describe("shouldShowBanner", () => {
    it("should return true for null subscription", () => {
      expect(shouldShowBanner(null)).toBe(true);
    });

    it("should return false for active subscription", () => {
      expect(shouldShowBanner({ status: "active" })).toBe(false);
    });

    it("should return false for trial_extended", () => {
      expect(shouldShowBanner({ status: "trial_extended" })).toBe(false);
    });

    it("should return true for trial status", () => {
      expect(shouldShowBanner({ status: "trial" })).toBe(true);
    });

    it("should return true for grace status", () => {
      expect(shouldShowBanner({ status: "grace" })).toBe(true);
    });

    it("should return true for expired status", () => {
      expect(shouldShowBanner({ status: "expired" })).toBe(true);
    });

    it("should return true for blocked status", () => {
      expect(shouldShowBanner({ status: "blocked" })).toBe(true);
    });
  });

  describe("isBlocked", () => {
    it("should return false for active subscription", () => {
      expect(isBlocked({ status: "active" })).toBe(false);
    });

    it("should return false for trial with days left", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      expect(isBlocked({ status: "trial", installedAt: new Date().toISOString() })).toBe(false);
    });

    it("should return true for expired status", () => {
      expect(isBlocked({ status: "expired" })).toBe(true);
    });

    it("should return true for blocked status", () => {
      expect(isBlocked({ status: "blocked" })).toBe(true);
    });

    it("should return true for grace with no days left", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      expect(isBlocked({ status: "grace", graceUntil: pastDate.toISOString() })).toBe(true);
    });
  });
});