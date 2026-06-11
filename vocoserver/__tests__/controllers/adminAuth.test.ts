import { generateAuthCode } from '../../src/services/counterService';

describe("Admin Auth Controller - OTP Generation", () => {
  describe("generateAuthCode", () => {
    it("should generate 6-digit code by default", () => {
      const code = generateAuthCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d{6}$/);
    });

    it("should generate different codes each time", () => {
      const codes = new Set([generateAuthCode(), generateAuthCode(), generateAuthCode()]);
      expect(codes.size).toBeGreaterThan(1);
    });

    it("should respect custom length", () => {
      const code = generateAuthCode(4);
      expect(code).toHaveLength(4);
      expect(code).toMatch(/^\d{4}$/);
    });

    it("should handle length of 1", () => {
      const code = generateAuthCode(1);
      expect(code).toHaveLength(1);
      expect(code).toMatch(/^\d$/);
    });

    it("should handle length of 8", () => {
      const code = generateAuthCode(8);
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^\d{8}$/);
    });
  });

  describe("OTP validation", () => {
    // Mock the validateOTPRequest function behavior
    const isValidPhoneNumber = (phone: string): boolean => {
      if (!phone) return false;
      const cleaned = phone.replace(/\D/g, '');
      return cleaned.length >= 8 && cleaned.length <= 15;
    };

    it("should validate Congo phone numbers", () => {
      expect(isValidPhoneNumber("+24261234567")).toBe(true);
      expect(isValidPhoneNumber("24261234567")).toBe(true);
      expect(isValidPhoneNumber("06 123 45 67")).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(isValidPhoneNumber("")).toBe(false);
      expect(isValidPhoneNumber("123")).toBe(false);
      expect(isValidPhoneNumber("abc")).toBe(false);
    });
  });
});