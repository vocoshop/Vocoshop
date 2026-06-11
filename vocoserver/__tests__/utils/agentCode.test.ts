import { buildAgentCode, randomSuffix } from '../../src/services/counterService';

describe("Agent Code Generation", () => {
  describe("buildAgentCode", () => {
    it("should generate correct code format", () => {
      expect(buildAgentCode(1000, "A")).toBe("AG-1000-A");
    });

    it("should handle different suffixes", () => {
      expect(buildAgentCode(1001, "B")).toBe("AG-1001-B");
      expect(buildAgentCode(1002, "Z")).toBe("AG-1002-Z");
    });

    it("should default to A for empty suffix", () => {
      expect(buildAgentCode(1000, "")).toBe("AG-1000-A");
    });

    it("should only use first character of suffix", () => {
      expect(buildAgentCode(1000, "AB")).toBe("AG-1000-A");
    });
  });

  describe("randomSuffix", () => {
    it("should return a single letter", () => {
      const suffix = randomSuffix();
      expect(suffix.length).toBe(1);
      expect(suffix).toMatch(/[A-Z]/);
    });

    it("should return different values over multiple calls", () => {
      const suffixes = new Set([randomSuffix(), randomSuffix(), randomSuffix(), randomSuffix(), randomSuffix()]);
      expect(suffixes.size).toBeGreaterThan(1);
    });
  });

  describe("Agent model validation", () => {
    // Simulate Agent validation
    interface MockAgent {
      phone?: string;
      firstName?: string;
      lastName?: string;
      code?: string;
      codeNumber?: number;
      codeSuffix?: string;
      isApproved?: boolean;
      isActive?: boolean;
    }

    const validateAgent = (agent: MockAgent): string[] => {
      const errors: string[] = [];
      
      if (!agent.phone) errors.push("phone is required");
      if (!agent.code) errors.push("code is required");
      if (agent.isApproved === undefined) errors.push("isApproved is required");
      if (agent.isActive === undefined) errors.push("isActive is required");
      
      return errors;
    };

    it("should validate complete agent", () => {
      const agent: MockAgent = {
        phone: "+24261234567",
        code: "AG-1000-A",
        codeNumber: 1000,
        codeSuffix: "A",
        isApproved: true,
        isActive: true,
        firstName: "John",
        lastName: "Doe"
      };
      
      expect(validateAgent(agent)).toHaveLength(0);
    });

    it("should reject agent without phone", () => {
      const agent: MockAgent = {
        code: "AG-1000-A",
        isApproved: true,
        isActive: true
      };
      
      expect(validateAgent(agent)).toContain("phone is required");
    });

    it("should reject agent without isApproved", () => {
      const agent: MockAgent = {
        phone: "+24261234567",
        code: "AG-1000-A",
        isActive: true
      };
      
      expect(validateAgent(agent)).toContain("isApproved is required");
    });
  });
});