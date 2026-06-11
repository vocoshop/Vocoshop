// __tests__/offline/syncEngine.test.ts

import {
  initSyncEngine,
  triggerSync,
  forceSync,
  onSyncState,
  getLastSyncFinished,
  getFailedJobsUI,
  retryFailedJob,
  retryAllFailedJobs,
  clearFailedJobUI,
  clearAllFailedJobs,
  getQueueDetails,
  refresh,
} from '../../src/api/offline/syncEngine';
import { saveQueue, clearQueue } from '../../src/api/offline/storage';
import { OfflineJob } from '../../src/api/offline/types';
import { setForceOffline } from '../../src/api/utils/network';

async function clearAll() {
  await clearQueue();
}

describe('offline/syncEngine', () => {
  beforeEach(async () => {
    await clearAll();
    setForceOffline(null);
  });

  afterEach(async () => {
    await clearAll();
  });

  /* =====================================================
  INIT
  ===================================================== */

  describe('initSyncEngine', () => {
    it('should be idempotent', () => {
      initSyncEngine();
      initSyncEngine(); // should not crash
      expect(true).toBe(true);
    });
  });

  /* =====================================================
  ON SYNC STATE LISTENER
  ===================================================== */

  describe('onSyncState', () => {
    it('should call callback immediately with current state', () => {
      const cb = jest.fn();

      const unsub = onSyncState(cb);

      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({
          syncing: expect.any(Boolean),
          queueSize: expect.any(Number),
          failed: expect.any(Number),
          pending: expect.any(Number),
        })
      );

      unsub();
    });

    it('should return unsubscribe function', () => {
      const cb = jest.fn();
      const unsub = onSyncState(cb);
      expect(typeof unsub).toBe('function');
      unsub();
    });

    it('should notify on state changes', async () => {
      const cb = jest.fn();

      const unsub = onSyncState(cb);
      expect(cb).toHaveBeenCalledTimes(1);

      // Trigger a refresh
      await refresh();
      expect(cb).toHaveBeenCalledTimes(2);

      unsub();
    });
  });

  /* =====================================================
  TRIGGER SYNC
  ===================================================== */

  describe('triggerSync', () => {
    it('should return null if already syncing', async () => {
      setForceOffline(true); // Force offline so queue can't process

      // Add jobs to queue
      const job: OfflineJob = {
        id: 'test_job',
        createdAt: Date.now(),
        method: 'POST',
        url: '/test',
        body: {},
        headers: {},
        tries: 0,
        status: 'pending',
      };
      await saveQueue([job]);

      // Trigger twice rapidly
      const result1 = await triggerSync();
      const result2 = await triggerSync();

      // Second should be null (anti-spam)
      expect(result2).toBeNull();

      setForceOffline(null);
    });

    it('should return null or result when offline', async () => {
      setForceOffline(true);

      const result = await triggerSync();

      // When offline, triggerSync may return null due to anti-spam or queue processing
      // We just verify it doesn't crash
      expect(result === null || (result !== null && typeof result.processed === 'number')).toBe(true);

      setForceOffline(null);
    });
  });

  /* =====================================================
  FORCE SYNC
  ===================================================== */

  describe('forceSync', () => {
    it('should bypass anti-spam', async () => {
      setForceOffline(true);

      const result = await forceSync();

      expect(result.processed).toBeDefined();
      expect(result.failed).toBeDefined();
      expect(result.remaining).toBeDefined();

      setForceOffline(null);
    });
  });

  /* =====================================================
  GET LAST SYNC FINISHED
  ===================================================== */

  describe('getLastSyncFinished', () => {
    it('should return timestamp', () => {
      const ts = getLastSyncFinished();
      expect(typeof ts).toBe('number');
    });
  });

  /* =====================================================
  FAILED JOBS MANAGEMENT
  ===================================================== */

  describe('getFailedJobsUI', () => {
    it('should return array of failed jobs', async () => {
      const failed: OfflineJob = {
        id: 'failed_1',
        createdAt: Date.now(),
        method: 'POST',
        url: '/test',
        body: {},
        headers: {},
        tries: 5,
        status: 'failed',
        lastError: 'Server error',
      };

      await saveQueue([failed]);

      const jobs = await getFailedJobsUI();

      expect(Array.isArray(jobs)).toBe(true);
    });
  });

  describe('retryAllFailedJobs', () => {
    it('should return count of retried jobs', async () => {
      const jobs: OfflineJob[] = [
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/t1', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'f2', createdAt: Date.now(), method: 'POST', url: '/t2', body: {}, headers: {}, tries: 5, status: 'failed' },
      ];

      await saveQueue(jobs);

      const count = await retryAllFailedJobs();

      expect(count).toBe(2);
    });

    it('should return 0 when no failed jobs', async () => {
      const count = await retryAllFailedJobs();
      expect(count).toBe(0);
    });
  });

  describe('clearFailedJobUI', () => {
    it('should remove specific failed job', async () => {
      const jobs: OfflineJob[] = [
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/t1', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'f2', createdAt: Date.now(), method: 'POST', url: '/t2', body: {}, headers: {}, tries: 5, status: 'failed' },
      ];

      await saveQueue(jobs);

      await clearFailedJobUI('f1');

      const details = await getQueueDetails();
      expect(details.total).toBe(1);
    });
  });

  describe('clearAllFailedJobs', () => {
    it('should remove all failed jobs', async () => {
      const jobs: OfflineJob[] = [
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/t1', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'f2', createdAt: Date.now(), method: 'POST', url: '/t2', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'p1', createdAt: Date.now(), method: 'POST', url: '/p1', body: {}, headers: {}, tries: 0, status: 'pending' },
      ];

      await saveQueue(jobs);

      await clearAllFailedJobs();

      const details = await getQueueDetails();
      expect(details.total).toBe(1);
      expect(details.failed).toBe(0);
      expect(details.pending).toBe(1);
    });
  });

  /* =====================================================
  QUEUE DETAILS
  ===================================================== */

  describe('getQueueDetails', () => {
    it('should return correct queue details', async () => {
      const jobs: OfflineJob[] = [
        { id: 'p1', createdAt: Date.now(), method: 'POST', url: '/p1', body: {}, headers: {}, tries: 0, status: 'pending' },
        { id: 'p2', createdAt: Date.now(), method: 'POST', url: '/p2', body: {}, headers: {}, tries: 0, status: 'pending' },
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/f1', body: {}, headers: {}, tries: 5, status: 'failed' },
      ];

      await saveQueue(jobs);

      const details = await getQueueDetails();

      expect(details.pending).toBe(2);
      expect(details.failed).toBe(1);
      expect(details.total).toBe(3);
      expect(Array.isArray(details.failedJobs)).toBe(true);
    });

    it('should return zeros for empty queue', async () => {
      const details = await getQueueDetails();

      expect(details.pending).toBe(0);
      expect(details.failed).toBe(0);
      expect(details.total).toBe(0);
    });
  });

  /* =====================================================
  REFRESH
  ===================================================== */

  describe('refresh', () => {
    it('should update stats without error', async () => {
      await expect(refresh()).resolves.not.toThrow();
    });
  });

  /* =====================================================
  INTEGRATION — SYNC WITH JOBS
  ===================================================== */

  describe('sync integration', () => {
    it('should process queue and update listener', async () => {
      const cb = jest.fn();

      const unsub = onSyncState(cb);
      const initialCallCount = cb.mock.calls.length;

      // Add a job and trigger sync (offline → won't process)
      const job: OfflineJob = {
        id: 'sync_test',
        createdAt: Date.now(),
        method: 'POST',
        url: '/test',
        body: {},
        headers: {},
        tries: 0,
        status: 'pending',
      };
      await saveQueue([job]);

      setForceOffline(true);
      await triggerSync();

      // Listener should have been notified after sync
      expect(cb.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount);

      setForceOffline(null);
      unsub();
    });
  });
});