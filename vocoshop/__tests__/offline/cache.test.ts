// __tests__/offline/cache.test.ts

import {
  cacheSet,
  cacheGet,
  cacheClear,
  cacheProducts,
  getCachedProducts,
  cacheStock,
  getCachedStock,
  cacheStockList,
  getCachedStocks,
  cacheReport,
  getCachedReport,
  cacheInventorySession,
  getCachedInventorySession,
  cacheCloseDay,
  getCachedCloseDay,
  getCacheStats,
} from '../../src/api/offline/cache';

describe('offline/cache', () => {
  beforeEach(async () => {
    await cacheClear();
  });

  describe('cacheSet / cacheGet', () => {
    it('should store and retrieve data', async () => {
      await cacheSet('products', [{ _id: '1', name: 'Coca' }]);
      const result = await cacheGet('products');
      expect(result).not.toBeNull();
      expect(result!.data).toHaveLength(1);
      expect((result!.data as any)[0].name).toBe('Coca');
      expect(result!.fromCache).toBe(true);
      expect(result!.stale).toBe(false);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheGet('nonexistent');
      expect(result).toBeNull();
    });

    it('should track stale status after TTL', async () => {
      await cacheSet('test_stale', { value: 'data' }, { ttl: 1 });
      await new Promise((r) => setTimeout(r, 20));
      const result = await cacheGet('test_stale');
      expect(result).not.toBeNull();
      expect(result!.stale).toBe(true);
      expect((result!.data as any).value).toBe('data');
    });

    it('should accept custom version', async () => {
      await cacheSet('version_test', { val: 1 }, { version: 42 });
      const result = await cacheGet('version_test');
      expect(result!.version).toBe(42);
    });
  });

  describe('cacheClear', () => {
    it('should clear all cache entries', async () => {
      await cacheSet('products', [{ id: '1' }]);
      await cacheSet('stocks_list', [{ id: '2' }]);
      await cacheClear();
      const stats = await getCacheStats();
      expect(stats.entries).toHaveLength(0);
    });
  });

  describe('products', () => {
    it('should cache products with long TTL', async () => {
      const products = [{ _id: '1', name: 'Coca' }, { _id: '2', name: 'Fanta' }];
      await cacheProducts(products, 100);
      const result = await getCachedProducts();
      expect(result!.data).toHaveLength(2);
      expect(result!.version).toBe(100);
    });
  });

  describe('stock', () => {
    it('should cache single stock', async () => {
      const stock = { _id: 'stock_123', quantity: 50 };
      await cacheStock('stock_123', stock, 5);
      const result = await getCachedStock('stock_123');
      expect(result!.data.quantity).toBe(50);
      expect(result!.version).toBe(5);
    });

    it('should cache stock list', async () => {
      const stocks = [{ _id: '1' }, { _id: '2' }];
      await cacheStockList(stocks);
      const result = await getCachedStocks();
      expect(result!.data).toHaveLength(2);
    });
  });

  describe('report', () => {
    it('should cache report', async () => {
      const report = { _id: 'r1', total: 5000 };
      await cacheReport('r1', report);
      const result = await getCachedReport('r1');
      expect(result!.data.total).toBe(5000);
    });
  });

  describe('inventory session', () => {
    it('should cache inventory session', async () => {
      const session = { _id: 'inv_1', items: [] };
      await cacheInventorySession(session);
      const result = await getCachedInventorySession('inv_1');
      expect(result!.data._id).toBe('inv_1');
    });
  });

  describe('close day', () => {
    it('should cache close day', async () => {
      const close = { _id: 'close_1', total: 15000 };
      await cacheCloseDay('close_1', close);
      const result = await getCachedCloseDay('close_1');
      expect(result!.data.total).toBe(15000);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      await cacheSet('products', [{ id: '1' }], { version: 1 });
      await cacheSet('stocks_list', [{ id: '2' }], { version: 2 });
      const stats = await getCacheStats();
      expect(stats.keys.length).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.entries.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle null data', async () => {
      await cacheSet('null_test', null as any);
      const result = await cacheGet('null_test');
      expect(result).not.toBeNull();
    });

    it('should handle empty array', async () => {
      await cacheSet('empty_test', []);
      const result = await cacheGet('empty_test');
      expect(result!.data).toHaveLength(0);
    });

    it('should handle nested objects', async () => {
      const data = { nested: { deep: { value: 42 } }, arr: [1, 2, 3] };
      await cacheSet('nested_test', data);
      const result = await cacheGet('nested_test');
      expect((result!.data as any).nested.deep.value).toBe(42);
      expect((result!.data as any).arr).toHaveLength(3);
    });
  });
});