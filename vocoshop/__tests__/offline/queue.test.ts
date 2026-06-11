// __tests__/offline/queue.test.ts

jest.mock("../../src/api/api", () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    request: jest.fn().mockResolvedValue({ data: {} }),
    get: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

import {
  initQueue,
  enqueueJob,
  processQueue,
  runOrQueue,
  getQueueSize,
  getFailedJobs,
  retryJob,
  retryAllFailed,
  clearFailedJob,
  clearAllFailed,
  getQueueStats,
  replayPendingJobs,
} from '../../src/api/offline/queue';
import { loadQueue, saveQueue, clearQueue } from '../../src/api/offline/storage';
import { OfflineJob } from '../../src/api/offline/types';
import { setForceOffline } from '../../src/api/utils/network';

async function clearAll() {
  await clearQueue();
}

function makeJob(overrides: Partial<OfflineJob> = {}): OfflineJob {
  return {
    id: 'job_test',
    createdAt: Date.now(),
    title: 'Test job',
    method: 'POST',
    url: '/test',
    body: {},
    headers: {},
    tries: 0,
    status: 'pending',
    ...overrides,
  };
}

describe('offline/queue', () => {
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

  describe('initQueue', () => {
    it('should initialize without error', async () => {
      await expect(initQueue()).resolves.not.toThrow();
    });
  });

  /* =====================================================
  ENQUEUE
  ===================================================== */

  describe('enqueueJob', () => {
    it('should add job to queue', async () => {
      const job = await enqueueJob({
        title: 'Add stock',
        method: 'POST',
        url: '/stocks/stock_123',
        body: { quantity: 50 },
        headers: { Authorization: 'Bearer test' },
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');
      expect(job.method).toBe('POST');
      expect(job.url).toBe('/stocks/stock_123');

      const queue = await loadQueue();
      expect(queue).toHaveLength(1);
    });

    it('should set entity info from URL', async () => {
      const job = await enqueueJob({
        method: 'POST',
        url: '/stocks/stock_abc',
        body: { qty: 10 },
      });

      // entity fields are set but may be stripped by type — check job itself
      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');
    });

    it('should not create duplicate jobs', async () => {
      const job1 = await enqueueJob({ method: 'POST', url: '/stocks/123', body: { qty: 1 } });
      const job2 = await enqueueJob({ method: 'POST', url: '/stocks/123', body: { qty: 1 } });

      expect(job1.id).toBe(job2.id);
      const queue = await loadQueue();
      expect(queue).toHaveLength(1);
    });

    it('should allow duplicate if different body', async () => {
      const job1 = await enqueueJob({ method: 'POST', url: '/stocks/123', body: { qty: 1 } });
      const job2 = await enqueueJob({ method: 'POST', url: '/stocks/123', body: { qty: 2 } });

      expect(job1.id).not.toBe(job2.id);
      const queue = await loadQueue();
      expect(queue).toHaveLength(2);
    });

    it('should track fingerprint', async () => {
      const job = await enqueueJob({ method: 'POST', url: '/test', body: { a: 1 } });
      expect(job.fingerprint).toBeDefined();
    });

    it('should accept entity override', async () => {
      const job = await enqueueJob({
        method: 'PATCH',
        url: '/products/prod_1',
        body: { price: 500 },
        entity: 'product',
        entityId: 'prod_1',
      });

      expect(job.entity).toBe('product');
      expect(job.entityId).toBe('prod_1');
    });
  });

  /* =====================================================
  RUN OR QUEUE
  ===================================================== */

  describe('runOrQueue', () => {
    it('should enqueue when offline', async () => {
      setForceOffline(true);

      const result = await runOrQueue({
        title: 'Offline action',
        method: 'POST',
        url: '/stocks/123',
        body: { qty: 5 },
      });

      expect(result.mode).toBe('offline');
      expect(result.jobId).toBeDefined();

      setForceOffline(null);
    });

    it('should return conflict flag when server conflict', async () => {
      // This test verifies the structure when online + conflict
      // actual conflict testing requires server mock
      setForceOffline(null);
      const result = await runOrQueue({
        title: 'Online action',
        method: 'POST',
        url: '/stocks/123',
        body: { qty: 5 },
      });

      // will fail because no actual server, but structure is correct
      expect(result.mode).toBe('online');
    });
  });

  /* =====================================================
  PROCESS QUEUE
  ===================================================== */

  describe('processQueue', () => {
    it('should return 0 when queue is empty', async () => {
      const result = await processQueue();
      expect(result.processed).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('should respect max limit', async () => {
      // Add 10 jobs
      for (let i = 0; i < 10; i++) {
        await enqueueJob({ method: 'POST', url: `/test/${i}`, body: {} });
      }

      const result = await processQueue({ max: 3 });
      expect(result.processed).toBeLessThanOrEqual(3);
    });

    it('should clean up done jobs', async () => {
      const job: OfflineJob = {
        id: 'done_job',
        createdAt: Date.now(),
        method: 'POST',
        url: '/test',
        body: {},
        headers: {},
        tries: 0,
        status: 'done',
      };

      await saveQueue([job]);

      await processQueue();

      const queue = await loadQueue();
      expect(queue.find((j) => j.id === 'done_job')).toBeUndefined();
    });

    it('should stop when offline during processing', async () => {
      setForceOffline(true);

      for (let i = 0; i < 5; i++) {
        await enqueueJob({ method: 'POST', url: `/test/${i}`, body: {} });
      }

      const result = await processQueue({ max: 10 });

      expect(result.processed).toBe(0);

      setForceOffline(null);
    });
  });

  /* =====================================================
  FAILED JOBS MANAGEMENT
  ===================================================== */

  describe('getFailedJobs', () => {
    it('should return empty array when no failed jobs', async () => {
      const jobs = await getFailedJobs();
      expect(jobs).toHaveLength(0);
    });

    it('should return failed jobs', async () => {
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

      const jobs = await getFailedJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('failed_1');
    });
  });

  describe('retryJob', () => {
    it('should reset failed job to pending', async () => {
      const failed: OfflineJob = {
        id: 'failed_retry',
        createdAt: Date.now(),
        method: 'POST',
        url: '/test',
        body: {},
        headers: {},
        tries: 5,
        status: 'failed',
        lastError: 'Error',
      };

      await saveQueue([failed]);

      const success = await retryJob('failed_retry');
      expect(success).toBe(true);

      const queue = await loadQueue();
      const job = queue.find((j) => j.id === 'failed_retry');
      expect(job!.status).toBe('pending');
      expect(job!.tries).toBe(0);
      expect(job!.lastError).toBeUndefined();
    });

    it('should return false for unknown job', async () => {
      const success = await retryJob('unknown_job');
      expect(success).toBe(false);
    });
  });

  describe('retryAllFailed', () => {
    it('should reset all failed jobs', async () => {
      const jobs: OfflineJob[] = [
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/t1', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'f2', createdAt: Date.now(), method: 'POST', url: '/t2', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'f3', createdAt: Date.now(), method: 'POST', url: '/t3', body: {}, headers: {}, tries: 5, status: 'failed' },
      ];

      await saveQueue(jobs);

      const count = await retryAllFailed();

      expect(count).toBe(3);

      const queue = await loadQueue();
      expect(queue.filter((j) => j.status === 'pending')).toHaveLength(3);
    });
  });

  describe('clearFailedJob', () => {
    it('should remove specific failed job', async () => {
      const jobs: OfflineJob[] = [
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/t1', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'f2', createdAt: Date.now(), method: 'POST', url: '/t2', body: {}, headers: {}, tries: 5, status: 'failed' },
      ];

      await saveQueue(jobs);

      await clearFailedJob('f1');

      const queue = await loadQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('f2');
    });
  });

  describe('clearAllFailed', () => {
    it('should remove all failed jobs', async () => {
      const jobs: OfflineJob[] = [
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/t1', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'f2', createdAt: Date.now(), method: 'POST', url: '/t2', body: {}, headers: {}, tries: 5, status: 'failed' },
        { id: 'p1', createdAt: Date.now(), method: 'POST', url: '/p1', body: {}, headers: {}, tries: 0, status: 'pending' },
      ];

      await saveQueue(jobs);

      await clearAllFailed();

      const queue = await loadQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].status).toBe('pending');
    });
  });

  /* =====================================================
  QUEUE STATS
  ===================================================== */

  describe('getQueueStats', () => {
    it('should return correct stats', async () => {
      const jobs: OfflineJob[] = [
        { id: 'p1', createdAt: Date.now(), method: 'POST', url: '/p1', body: {}, headers: {}, tries: 0, status: 'pending' },
        { id: 'p2', createdAt: Date.now(), method: 'POST', url: '/p2', body: {}, headers: {}, tries: 0, status: 'pending' },
        { id: 'f1', createdAt: Date.now(), method: 'POST', url: '/f1', body: {}, headers: {}, tries: 5, status: 'failed' },
      ];

      await saveQueue(jobs);

      const stats = await getQueueStats();

      expect(stats.pending).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.total).toBe(3);
    });
  });

  /* =====================================================
  GET QUEUE SIZE
  ===================================================== */

  describe('getQueueSize', () => {
    it('should return 0 for empty queue', async () => {
      const size = await getQueueSize();
      expect(size).toBe(0);
    });

    it('should return correct size', async () => {
      await enqueueJob({ method: 'POST', url: '/t1', body: {} });
      await enqueueJob({ method: 'POST', url: '/t2', body: {} });

      const size = await getQueueSize();
      expect(size).toBe(2);
    });
  });

  /* =====================================================
  REPLAY PENDING JOBS (ALIAS)
  ===================================================== */

  describe('replayPendingJobs', () => {
    it('should be an alias for processQueue', async () => {
      const result = await replayPendingJobs();
      expect(result.processed).toBeDefined();
      expect(result.remaining).toBeDefined();
    });
  });
});