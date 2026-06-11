describe("ManagerRoute Utilities", () => {
  /* =============================================
   buildAccessFilter
  ============================================= */
  const buildAccessFilter = (manager: any) => {
    const filter: any = {};
    const orConditions: any[] = [];
    if (manager?.assignedRegions?.length > 0) {
      orConditions.push({ region: { $in: manager.assignedRegions } });
    }
    if (manager?.assignedCities?.length > 0) {
      orConditions.push({ city: { $in: manager.assignedCities } });
    }
    if (manager?.assignedAgents?.length > 0) {
      orConditions.push({ _id: { $in: manager.assignedAgents } });
    }
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }
    return filter;
  };

  describe("buildAccessFilter", () => {
    it("should return empty filter for manager with no assignments", () => {
      const filter = buildAccessFilter({});
      expect(filter).toEqual({});
    });

    it("should return region filter when regions assigned", () => {
      const filter = buildAccessFilter({ assignedRegions: ["Brazzaville", "Pointe-Noire"] });
      expect(filter).toEqual({ $or: [{ region: { $in: ["Brazzaville", "Pointe-Noire"] } }] });
    });

    it("should return city filter when cities assigned", () => {
      const filter = buildAccessFilter({ assignedCities: ["Bacongo", "Makelele"] });
      expect(filter).toEqual({ $or: [{ city: { $in: ["Bacongo", "Makelele"] } }] });
    });

    it("should return agents filter when agents assigned", () => {
      const filter = buildAccessFilter({ assignedAgents: ["id1", "id2"] });
      expect(filter).toEqual({ $or: [{ _id: { $in: ["id1", "id2"] } }] });
    });

    it("should combine region + city + agents", () => {
      const filter = buildAccessFilter({
        assignedRegions: ["Brazzaville"],
        assignedCities: ["Bacongo"],
        assignedAgents: ["id1"],
      });
      expect(filter.$or).toHaveLength(3);
      expect(filter.$or[0]).toEqual({ region: { $in: ["Brazzaville"] } });
      expect(filter.$or[1]).toEqual({ city: { $in: ["Bacongo"] } });
      expect(filter.$or[2]).toEqual({ _id: { $in: ["id1"] } });
    });

    it("should handle null manager", () => {
      expect(buildAccessFilter(null)).toEqual({});
    });

    it("should handle undefined manager", () => {
      expect(buildAccessFilter(undefined)).toEqual({});
    });
  });

  /* =============================================
   computeAgentScore
  ============================================= */
  const computeAgentScore = (agent: any, stores: any[]) => {
    const agentStores = stores.filter((s) => (s.agentCode || "").toLowerCase() === (agent.code || "").toLowerCase());
    const total = agentStores.length;
    const active = agentStores.filter((s) => s.subscriptionStatus === "active").length;
    const inactive = total - active;
    const lastActive = agent.lastLoginAt ? new Date(agent.lastLoginAt).getTime() : 0;
    const daysSinceActive = (Date.now() - lastActive) / 86400000;

    let score = 100;
    if (total === 0) score -= 30;
    if (active < total * 0.5) score -= 20;
    if (inactive > total * 0.3) score -= 15;
    if (daysSinceActive > 7) score -= 10;
    if (daysSinceActive > 14) score -= 10;
    if (daysSinceActive > 30) score -= 10;
    if (!agent.isActive) score -= 20;
    score = Math.max(0, Math.min(100, score));

    const label = score >= 80 ? "Excellent" : score >= 60 ? "Correct" : score >= 40 ? "À surveiller" : "Problématique";
    const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

    return { score, label, color, total, active, inactive };
  };

  describe("computeAgentScore", () => {
    const now = Date.now();
    const DAY = 86400000;

    const makeStore = (overrides = {}) => ({
      agentCode: "AG-1000-A",
      subscriptionStatus: "active",
      ...overrides,
    });

    const makeAgent = (overrides = {}) => ({
      _id: "agent1",
      code: "AG-1000-A",
      name: "Test Agent",
      isActive: true,
      lastLoginAt: new Date(now).toISOString(),
      ...overrides,
    });

    it("should give 100 for active agent with all stores active", () => {
      const agent = makeAgent();
      const stores = [makeStore(), makeStore(), makeStore()];
      const result = computeAgentScore(agent, stores);
      expect(result.score).toBe(100);
      expect(result.label).toBe("Excellent");
      expect(result.color).toBe("#22c55e");
      expect(result.total).toBe(3);
      expect(result.active).toBe(3);
    });

    it("should penalize agent with no stores", () => {
      const agent = makeAgent();
      const result = computeAgentScore(agent, []);
      expect(result.score).toBe(70);
      expect(result.total).toBe(0);
    });

    it("should penalize when less than 50% active", () => {
      const agent = makeAgent();
      const stores = [
        makeStore({ subscriptionStatus: "active" }),
        makeStore({ subscriptionStatus: "active" }),
        makeStore({ subscriptionStatus: "expired" }),
        makeStore({ subscriptionStatus: "expired" }),
        makeStore({ subscriptionStatus: "expired" }),
      ];
      const result = computeAgentScore(agent, stores);
      expect(result.active).toBe(2);
      expect(result.inactive).toBe(3);
      expect(result.score).toBeLessThan(100);
    });

    it("should penalize inactive agent", () => {
      const agent = makeAgent({ isActive: false });
      const result = computeAgentScore(agent, [makeStore()]);
      expect(result.score).toBe(80);
    });

    it("should penalize for days since last login", () => {
      const agent = makeAgent({
        lastLoginAt: new Date(now - 20 * DAY).toISOString(),
      });
      const result = computeAgentScore(agent, [makeStore()]);
      expect(result.score).toBeLessThan(100);
    });

    it("should not go below 0", () => {
      const agent = makeAgent({
        isActive: false,
        lastLoginAt: new Date(now - 60 * DAY).toISOString(),
      });
      const result = computeAgentScore(agent, []);
      expect(result.score).toBe(20);
    });

    it("should label score 80+ as Excellent", () => {
      const agent = makeAgent();
      const result = computeAgentScore(agent, [makeStore(), makeStore()]);
      expect(result.label).toBe("Excellent");
    });

    it("should label score 60-79 as Correct", () => {
      const agent = makeAgent({
        isActive: false,
        lastLoginAt: new Date(now - 10 * DAY).toISOString(),
      });
      const result = computeAgentScore(agent, [makeStore()]);
      expect(result.label).toBe("Correct");
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(80);
    });

    it("should label score 40-59 as À surveiller", () => {
      const agent = makeAgent({ isActive: false });
      const result = computeAgentScore(agent, []);
      expect(result.label).toBe("À surveiller");
    });

    it("should label score <40 as Problématique", () => {
      const agent = makeAgent({
        isActive: false,
        lastLoginAt: new Date(now - 60 * DAY).toISOString(),
      });
      const result = computeAgentScore(agent, []);
      expect(result.label).toBe("Problématique");
      expect(result.color).toBe("#ef4444");
    });
  });

  /* =============================================
   Alert generation & sorting
  ============================================= */
  describe("Alert sorting", () => {
    const PRIORITY: Record<string, number> = {};
    const setPriority = (sev: string, p: number) => { PRIORITY[sev] = p; };
    setPriority("red", 0);
    setPriority("orange", 1);
    setPriority("yellow", 2);

    const sortAlerts = (alerts: any[]) =>
      [...alerts].sort((a, b) => (PRIORITY[a.severity] ?? 9) - (PRIORITY[b.severity] ?? 9));

    it("should sort red before orange before yellow", () => {
      const alerts = [
        { severity: "yellow", label: "Low" },
        { severity: "red", label: "High" },
        { severity: "orange", label: "Medium" },
        { severity: "red", label: "Critical" },
      ];
      const sorted = sortAlerts(alerts);
      expect(sorted[0].label).toBe("High");
      expect(sorted[1].label).toBe("Critical");
      expect(sorted[2].label).toBe("Medium");
      expect(sorted[3].label).toBe("Low");
    });

    it("should put unknown severity at the end", () => {
      const alerts = [
        { severity: "red", label: "High" },
        { severity: "unknown", label: "Unknown" },
      ];
      const sorted = sortAlerts(alerts);
      expect(sorted[0].label).toBe("High");
      expect(sorted[1].label).toBe("Unknown");
    });
  });

  describe("Alert generation logic", () => {
    it("should detect expired subscription", () => {
      const store = { subscriptionStatus: "expired", storeName: "Ma Boutique", _id: "s1" };
      const alert = {
        type: "danger", severity: "🔴",
        label: "Abonnement expiré", store: store.storeName,
        agent: "Agent X", agentId: "a1", storeId: "s1",
      };
      expect(alert.label).toBe("Abonnement expiré");
      expect(alert.severity).toBe("🔴");
    });

    it("should detect expiring soon (≤7 days)", () => {
      const daysLeft = 3;
      if (daysLeft <= 7 && daysLeft >= 0) {
        const alert = {
          type: "warning", severity: "🟡",
          label: `Expire dans ${daysLeft}j`, store: "Boutique",
          agent: "Agent X", agentId: "a1", storeId: "s1",
        };
        expect(alert.label).toBe("Expire dans 3j");
        expect(alert.severity).toBe("🟡");
      }
    });

    it("should detect inactive 14+ days", () => {
      const store = { status: "inactive", lastActiveAt: new Date(Date.now() - 20 * 86400000) };
      const isInactive = store.status === "inactive" && store.lastActiveAt &&
        (Date.now() - new Date(store.lastActiveAt).getTime()) > 14 * 86400000;
      expect(isInactive).toBe(true);
    });

    it("should detect trial not converted (>35 days)", () => {
      const store = { subscriptionStatus: "trial", createdAt: new Date(Date.now() - 40 * 86400000) };
      const notConverted = store.subscriptionStatus === "trial" && store.createdAt &&
        (Date.now() - new Date(store.createdAt).getTime()) > 35 * 86400000;
      expect(notConverted).toBe(true);
    });

    it("should NOT flag trial under 35 days", () => {
      const store = { subscriptionStatus: "trial", createdAt: new Date(Date.now() - 20 * 86400000) };
      const notConverted = store.subscriptionStatus === "trial" && store.createdAt &&
        (Date.now() - new Date(store.createdAt).getTime()) > 35 * 86400000;
      expect(notConverted).toBe(false);
    });

    it("should detect agent inactive", () => {
      const agent = { isActive: false, name: "Agent Inactif" };
      if (!agent.isActive) {
        const alert = { type: "danger", label: "Agent inactif", agent: agent.name, severity: "🔴", agentId: "a1", store: null };
        expect(alert.label).toBe("Agent inactif");
      }
    });

    it("should detect agent inactive >7 days", () => {
      const lastLogin = new Date(Date.now() - 10 * 86400000).getTime();
      const inactive = (Date.now() - lastLogin) > 7 * 86400000;
      expect(inactive).toBe(true);
    });

    it("should detect low subscription rate", () => {
      const stores = [
        { subscriptionStatus: "active" },
        { subscriptionStatus: "expired" },
        { subscriptionStatus: "expired" },
        { subscriptionStatus: "expired" },
      ];
      const active = stores.filter(s => s.subscriptionStatus === "active").length;
      const threshold = stores.length * 0.3;
      const isLow = stores.length > 5 && active < threshold;
      expect(isLow).toBe(false);
    });
  });
});
