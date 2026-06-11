import { detectOperator, MobileOperator } from '../../src/utils/operatorDetector';

describe('operatorDetector', () => {
  describe('detectOperator', () => {
    it('should return UNKNOWN for empty string', () => {
      expect(detectOperator('')).toBe('UNKNOWN');
    });

    it('should return UNKNOWN for null', () => {
      expect(detectOperator(null as any)).toBe('UNKNOWN');
    });

    it('should return UNKNOWN for undefined', () => {
      expect(detectOperator(undefined as any)).toBe('UNKNOWN');
    });

    describe('MTN detection (Congo)', () => {
      it('should detect MTN with +24206', () => {
        expect(detectOperator('+242060000000')).toBe('MTN');
      });

      it('should detect MTN with 06 prefix', () => {
        expect(detectOperator('060000000')).toBe('MTN');
      });

      it('should detect MTN with +242 06 format', () => {
        expect(detectOperator('+242 06 00 00 00 00')).toBe('MTN');
      });
    });

    describe('AIRTEL detection (Congo)', () => {
      it('should detect AIRTEL with +24205', () => {
        expect(detectOperator('+242050000000')).toBe('AIRTEL');
      });

      it('should detect AIRTEL with 05 prefix', () => {
        expect(detectOperator('050000000')).toBe('AIRTEL');
      });

      it('should detect AIRTEL with spaces', () => {
        expect(detectOperator('+242 05 00 00 00 00')).toBe('AIRTEL');
      });
    });

    describe('ORANGE detection (Congo)', () => {
      it('should detect ORANGE with +24207', () => {
        expect(detectOperator('+242070000000')).toBe('ORANGE');
      });

      it('should detect ORANGE with 07 prefix', () => {
        expect(detectOperator('070000000')).toBe('ORANGE');
      });
    });

    describe('UNKNOWN operator', () => {
      it('should return UNKNOWN for unrecognized numbers', () => {
        expect(detectOperator('+242080000000')).toBe('UNKNOWN');
      });

      it('should return UNKNOWN for international numbers', () => {
        expect(detectOperator('+33123456789')).toBe('UNKNOWN');
      });
    });

    it('should handle multiple spaces in phone number', () => {
      expect(detectOperator('+242  06  00  00  00  00')).toBe('MTN');
    });
  });
});