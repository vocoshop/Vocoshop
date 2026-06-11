import { findBestProductMatch } from '../../src/api/utils/productMatcher';

describe('productMatcher', () => {
  const mockProducts = [
    { _id: '1', name: 'Coca' },
    { _id: '2', name: 'Fanta' },
    { _id: '3', name: 'Sprite' },
    { _id: '4', name: 'Eau' },
    { _id: '5', name: 'Pâte' },
  ];

  describe('findBestProductMatch', () => {
    it('should return exact match', () => {
      const result = findBestProductMatch('Coca', mockProducts);
      expect(result?._id).toBe('1');
    });

    it('should return exact match case insensitive', () => {
      const result = findBestProductMatch('coca', mockProducts);
      expect(result?._id).toBe('1');
    });

    it('should handle typo with 1 character difference', () => {
      const result = findBestProductMatch('Coka', mockProducts);
      expect(result?._id).toBe('1');
    });

    it('should handle missing letter (distance 1)', () => {
      const result = findBestProductMatch('Coc', mockProducts);
      expect(result?._id).toBe('1');
    });

    it('should handle extra letter', () => {
      const result = findBestProductMatch('Cocaa', mockProducts);
      expect(result?._id).toBe('1');
    });

    it('should handle accents', () => {
      const products = [{ _id: '1', name: 'Pâte' }];
      const result = findBestProductMatch('pate', products);
      expect(result?._id).toBe('1');
    });

    it('should handle accent variations', () => {
      const products = [{ _id: '1', name: 'Pâte' }];
      const result = findBestProductMatch('pâte', products);
      expect(result?._id).toBe('1');
    });

    it('should return null when no match within threshold', () => {
      const result = findBestProductMatch('xyz123', mockProducts);
      expect(result).toBeNull();
    });

    it('should return null for empty product name', () => {
      const result = findBestProductMatch('Coca', []);
      expect(result).toBeNull();
    });

    it('should return null when voiceProduct is empty', () => {
      const result = findBestProductMatch('', mockProducts);
      expect(result).toBeNull();
    });

    it('should return null when voiceProduct is null', () => {
      const result = findBestProductMatch(null as any, mockProducts);
      expect(result).toBeNull();
    });

    it('should return the closest match when within threshold', () => {
      const products = [
        { _id: '1', name: 'Coc' },
        { _id: '2', name: 'Coccc' },
      ];
      const result = findBestProductMatch('Coc', products);
      expect(result?._id).toBe('1');
    });

    it('should handle spaces and special characters', () => {
      const products = [{ _id: '1', name: 'Eau' }];
      const result = findBestProductMatch('eau ', products);
      expect(result?._id).toBe('1');
    });
  });
});