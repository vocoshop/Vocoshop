// __tests__/offline/conflictResolver.test.ts

import {
  initVersionStore,
  recordVersion,
  getLastVersion,
  detectConflict,
  resolveConflict,
  autoResolveConflicts,
  onConflictDetected,
  syncVersionsFromServer,
  logConflict,
  getConflictHistory,
  clearConflictHistory,
} from '../../src/api/offline/conflictResolver';
import { OfflineJob } from '../../src/api/offline/types';

const CONFLICT_HISTORY_KEY = 'voco_conflict_history_v1';

async function clearStorages() {
  // Clear the real AsyncStorage mock's internal data
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  await AsyncStorage.clear();
  // Reset the conflictResolver module's internal version cache
  const { __resetVersionStore } = require('../../src/api/offline/conflictResolver');
  __resetVersionStore();
}

function makeJob(overrides: Partial<OfflineJob> = {}): OfflineJob {
  return {
    id: 'job_1',
    createdAt: Date.now() - 10000,
    title: 'Add stock',
    method: 'POST' as const,
    url: '/stocks/stock_123',
    body: { quantity: 50 },
    headers: {},
    tries: 0,
    status: 'pending' as const,
    entity: 'stock',
    entityId: 'stock_123',
    ...overrides,
  } as OfflineJob;
}

describe('offline/conflictResolver', () => {
  beforeEach(async () => { await clearStorages(); });
  afterEach(async () => { await clearStorages(); });

  describe('initVersionStore', () => {
    it('should initialize without error', async () => {
      await expect(initVersionStore()).resolves.not.toThrow();
    });

    it('should be idempotent', async () => {
      await initVersionStore();
      await initVersionStore();
      // verify no crash
      expect(true).toBe(true);
    });
  });

  describe('recordVersion', () => {
    it('should record a new version', async () => {
      await recordVersion('stock', 'stock_123', 1, Date.now());
      const version = await getLastVersion('stock', 'stock_123');
      expect(version).not.toBeNull();
      expect(version!.version).toBe(1);
    });

    it('should update existing version', async () => {
      await recordVersion('stock', 'stock_123', 1, Date.now() - 5000);
      await recordVersion('stock', 'stock_123', 2, Date.now());
      const version = await getLastVersion('stock', 'stock_123');
      expect(version!.version).toBe(2);
    });

    it('should handle multiple entities', async () => {
      await recordVersion('stock', 's1', 1, Date.now());
      await recordVersion('product', 'p1', 2, Date.now());
      expect((await getLastVersion('stock', 's1'))!.version).toBe(1);
      expect((await getLastVersion('product', 'p1'))!.version).toBe(2);
    });

    it('should return null for unknown entity', async () => {
      const version = await getLastVersion('unknown', 'id');
      expect(version).toBeNull();
    });
  });

  describe('detectConflict', () => {
    it('should return null when no version is known', async () => {
      const job = makeJob();
      const conflict = await detectConflict(job);
      expect(conflict).toBeNull();
    });

    it('should return null when server version is older than job', async () => {
      const jobCreatedAt = Date.now();
      await recordVersion('stock', 'stock_123', 1, jobCreatedAt - 5000);
      const job = makeJob({ createdAt: jobCreatedAt });
      const conflict = await detectConflict(job);
      expect(conflict).toBeNull();
    });

    it('should detect conflict when server updated after job creation', async () => {
      const jobCreatedAt = Date.now() - 120000; // 2 minutes to be absolutely sure
      await recordVersion('stock', 'stock_123', 2, Date.now());
      const job = makeJob({ createdAt: jobCreatedAt });
      const conflict = await detectConflict(job);
      expect(conflict).not.toBeNull();
      expect(conflict!.jobId).toBe('job_1');
      expect(conflict!.serverVersion).toBe(2);
    });

    it('should return null for unrecognized URL pattern', async () => {
      const job = makeJob({ url: '/unrecognized/path/123', entityId: 'unknown_id' });
      const conflict = await detectConflict(job);
      expect(conflict).toBeNull();
    });
  });

  describe('resolveConflict', () => {
    it('should skip when server_wins', async () => {
      const conflict = {
        jobId: 'j1', job: makeJob(), serverVersion: 2, serverTimestamp: Date.now(),
        clientVersion: 1, clientTimestamp: Date.now() - 10000, field: 'stock',
        serverValue: { quantity: 100 }, clientValue: { quantity: 50 },
        strategy: 'server_wins' as const,
      };
      const result = resolveConflict(conflict, 'server_wins');
      expect(result.resolved).toBe(true);
      expect(result.action).toBe('skip');
    });

    it('should apply when client_wins', async () => {
      const conflict = {
        jobId: 'j1', job: makeJob(), serverVersion: 2, serverTimestamp: Date.now(),
        clientVersion: 1, clientTimestamp: Date.now() - 10000, field: 'stock',
        serverValue: { quantity: 100 }, clientValue: { quantity: 50 },
        strategy: 'client_wins' as const,
      };
      const result = resolveConflict(conflict, 'client_wins');
      expect(result.resolved).toBe(true);
      expect(result.action).toBe('apply');
    });

    it('should merge when strategy is merge', async () => {
      const conflict = {
        jobId: 'j1', job: makeJob(), serverVersion: 2, serverTimestamp: Date.now(),
        clientVersion: 1, clientTimestamp: Date.now() - 10000, field: 'stock',
        serverValue: { quantity: 100, name: 'Coca' }, clientValue: { quantity: 50, price: 500 },
        strategy: 'merge' as const,
      };
      const result = resolveConflict(conflict, 'merge');
      expect(result.resolved).toBe(true);
      expect(result.action).toBe('merge');
      expect(result.mergedData).toMatchObject({ quantity: 50, name: 'Coca', price: 500 });
    });

    it('should return pending when ask_user', async () => {
      const conflict = {
        jobId: 'j1', job: makeJob(), serverVersion: 2, serverTimestamp: Date.now(),
        clientVersion: 1, clientTimestamp: Date.now() - 10000, field: 'stock',
        serverValue: {}, clientValue: {}, strategy: 'ask_user' as const,
      };
      const result = resolveConflict(conflict, 'ask_user');
      expect(result.resolved).toBe(false);
      expect(result.action).toBe('pending');
    });
  });

  describe('autoResolveConflicts', () => {
    it('should resolve and skip conflicts', async () => {
      await recordVersion('stock', 'stock_123', 2, Date.now());
      const job = makeJob({ createdAt: Date.now() - 10000 });
      const { saveQueue } = require('../../src/api/offline/storage');
      await saveQueue([job]);
      const result = await autoResolveConflicts('server_wins');
      expect(result.resolved).toBeGreaterThan(0);
      expect(result.skipped).toBeGreaterThan(0);
    });
  });

  describe('onConflictDetected', () => {
    it('should add and remove listener', () => {
      const cb = jest.fn();
      const unsub = onConflictDetected(cb);
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should notify all listeners', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      onConflictDetected(cb1);
      onConflictDetected(cb2);
      const { notifyConflictListeners } = require('../../src/api/offline/conflictResolver');
      const conflict = { jobId: 'j1', job: makeJob(), serverVersion: 2, serverTimestamp: Date.now(), clientVersion: 1, clientTimestamp: Date.now(), field: 'stock', serverValue: {}, clientValue: {}, strategy: 'server_wins' as const };
      notifyConflictListeners([conflict]);
      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  describe('syncVersionsFromServer', () => {
    it('should sync multiple versions', async () => {
      const data = [
        { entity: 'stock', id: 's1', version: 5, updatedAt: new Date().toISOString() },
        { entity: 'product', id: 'p1', version: 3, updatedAt: new Date().toISOString() },
      ];
      await syncVersionsFromServer(data);
      expect((await getLastVersion('stock', 's1'))!.version).toBe(5);
      expect((await getLastVersion('product', 'p1'))!.version).toBe(3);
    });
  });

  describe('logConflict', () => {
    it('should log conflict to history', async () => {
      const conflict = {
        jobId: 'j1', job: makeJob(), serverVersion: 2, serverTimestamp: Date.now(),
        clientVersion: 1, clientTimestamp: Date.now() - 10000, field: 'stock',
        serverValue: {}, clientValue: {}, strategy: 'server_wins' as const,
      };
      await logConflict(conflict);
      const history = await getConflictHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].jobId).toBe('j1');
    });
  });

  describe('clearConflictHistory', () => {
    it('should clear history', async () => {
      await clearConflictHistory();
      const history = await getConflictHistory();
      expect(history).toHaveLength(0);
    });
  });
});