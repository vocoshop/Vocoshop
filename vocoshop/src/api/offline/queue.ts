// src/api/offline/queue.ts
import API from "../../api/api";
import { isOnline } from "../utils/network";
import { loadQueue, saveQueue } from "./storage";
import { OfflineJob, OfflineHttpMethod } from "./types";
import { detectConflict, resolveConflict, logConflict, initVersionStore } from "./conflictResolver";
import { cacheSet, invalidateOnSync } from "./cache";

/* =====================================================
UTILS
===================================================== */

function makeId(): string {
  return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* =====================================================
FINGERPRINT V4 — ANTI DUPLICATE
===================================================== */

function makeFingerprint(params: { method: string; url: string; body?: any }) {
  return `${params.method}_${params.url}_${JSON.stringify(params.body || {})}`;
}

type EnqueueParams = {
  title?: string;
  method: OfflineHttpMethod;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  entity?: string;   // "stock", "product", etc.
  entityId?: string; // id de l'entité modifiée
  version?: number;  // version connue au moment de la création
};

let isProcessing = false;

/* =====================================================
INIT (appelé au boot)
===================================================== */
export async function initQueue(): Promise<void> {
  await initVersionStore();
}

/* =====================================================
ENQUEUE JOB
===================================================== */

export async function enqueueJob(params: EnqueueParams): Promise<OfflineJob> {
  const fingerprint = makeFingerprint({
    method: params.method,
    url: params.url,
    body: params.body,
  });

  const list: any[] = await loadQueue();

  // 🔥 PROTECTION ANTI DUPLICATE
  const alreadyExists = list.find(
    (j) =>
      j.fingerprint === fingerprint &&
      (j.status === "pending" || j.status === "processing")
  );

  if (alreadyExists) {
    return alreadyExists;
  }

  // Extraire entity info depuis l'URL
  let entity = params.entity;
  let entityId = params.entityId;

  if (!entity || !entityId) {
    const parsed = parseEntityFromUrl(params.url);
    if (parsed) {
      entity = parsed.entity;
      entityId = parsed.entityId;
    }
  }

  const job: OfflineJob & { fingerprint?: string; entity?: string; entityId?: string; version?: number } = {
    id: makeId(),
    createdAt: Date.now(),
    title: params.title,
    method: params.method,
    url: params.url,
    body: params.body,
    headers: params.headers,
    tries: 0,
    status: "pending",
    fingerprint,
    entity,
    entityId,
    version: params.version,
  };

  list.push(job);
  await saveQueue(list);

  return job;
}

/* =====================================================
REPLAY SINGLE JOB (avec gestion de conflit)
===================================================== */

async function replay(job: OfflineJob): Promise<{ ok: boolean; conflict?: any; error?: string }> {
  const method = job.method.toUpperCase();

  // 🔥 CONFLICT DETECTION AVANT REPLAY
  const conflictInfo = await detectConflict(job);
  if (conflictInfo) {
    // Log le conflit
    await logConflict(conflictInfo);

    // Résolution auto : serveur gagne par défaut
    const resolution = resolveConflict(conflictInfo, "server_wins");
    if (resolution.action === "skip") {
      job.status = "done";
      return { ok: true, conflict: conflictInfo };
    }
  }

  try {
    if (method === "POST") {
      await API.post(job.url, job.body ?? {}, { headers: job.headers });
    } else if (method === "PUT") {
      await API.put(job.url, job.body ?? {}, { headers: job.headers });
    } else if (method === "PATCH") {
      await API.patch(job.url, job.body ?? {}, { headers: job.headers });
    } else if (method === "DELETE") {
      await API.request({
        method: "DELETE",
        url: job.url,
        headers: job.headers,
        data: job.body ?? {},
      });
    } else {
      throw new Error(`Unsupported method: ${job.method}`);
    }

    return { ok: true };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.response?.data?.error || e?.response?.data?.message || e?.message || "UNKNOWN_ERROR",
    };
  }
}

/* =====================================================
PROCESS QUEUE (FIFO + RETRY + BACKOFF + CONFLICTS)
===================================================== */

export async function processQueue(opts?: { max?: number }): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  remaining: number;
}> {
  if (isProcessing) {
    const q = await loadQueue();
    return { processed: 0, failed: 0, skipped: 0, remaining: q.length };
  }

  isProcessing = true;

  try {
    const max = typeof opts?.max === "number" ? opts!.max : 50;

    let list: any[] = await loadQueue();
    if (list.length === 0) return { processed: 0, failed: 0, skipped: 0, remaining: 0 };

    let processed = 0;
    let skipped = 0;

    for (let i = 0; i < list.length; i++) {
      if (!isOnline()) break;
      if (processed >= max) break;

      const job = list[i];
      if (!job || job.status === "done") continue;

      job.status = "processing";
      await saveQueue(list);

      try {
        job.tries += 1;

        const result = await replay(job);

        if (result.conflict) {
          // Conflit résolu (skip)
          job.status = "done";
          job.lastError = "CONFLICT_SKIPPED";
          skipped += 1;
        } else if (result.ok) {
          job.status = "done";
          job.lastError = undefined;
          processed += 1;
        } else {
          throw new Error(result.error || "Request failed");
        }

        await sleep(80);
      } catch (e: any) {
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "UNKNOWN_ERROR";

        job.lastError = String(msg);

        if (job.tries >= 5) {
          job.status = "failed";
        } else {
          job.status = "pending";
          await sleep(250 * job.tries);
        }
      } finally {
        await saveQueue(list);
      }
    }

    // Nettoyage DONE
    list = (await loadQueue()).filter((j) => j.status !== "done");
    await saveQueue(list);

    // 🔥 Invalider le cache des entités modifiées
    if (processed > 0) {
      await invalidateOnSync();
    }

    return {
      processed,
      failed: list.filter((j) => j.status === "failed").length,
      skipped,
      remaining: list.length,
    };
  } finally {
    isProcessing = false;
  }
}

/* =====================================================
RUN OR QUEUE (SMART EXECUTION)
===================================================== */

export async function runOrQueue(
  params: EnqueueParams
): Promise<{
  mode: "online" | "offline";
  jobId?: string;
  conflict?: boolean;
}> {
  if (isOnline()) {
    const result = await replay({
      id: "now",
      createdAt: Date.now(),
      title: params.title,
      method: params.method,
      url: params.url,
      body: params.body,
      headers: params.headers,
      tries: 0,
      status: "processing",
    });

    if (result.conflict) {
      return { mode: "online", conflict: true };
    }

    return { mode: "online" };
  }

  const job = await enqueueJob(params);
  return { mode: "offline", jobId: job.id };
}

/* =====================================================
FAILED JOBS MANAGEMENT
===================================================== */

export async function getFailedJobs(): Promise<OfflineJob[]> {
  const q = await loadQueue();
  return q.filter((j) => j.status === "failed");
}

export async function retryJob(jobId: string): Promise<boolean> {
  const q = await loadQueue();
  const job = q.find((j) => j.id === jobId);
  if (!job) return false;

  job.status = "pending";
  job.tries = 0;
  job.lastError = undefined;
  await saveQueue(q);
  return true;
}

export async function retryAllFailed(): Promise<number> {
  const q = await loadQueue();
  let count = 0;
  for (const job of q) {
    if (job.status === "failed") {
      job.status = "pending";
      job.tries = 0;
      job.lastError = undefined;
      count++;
    }
  }
  await saveQueue(q);
  return count;
}

export async function clearFailedJob(jobId: string): Promise<void> {
  const q = await loadQueue();
  const filtered = q.filter((j) => j.id !== jobId);
  await saveQueue(filtered);
}

export async function clearAllFailed(): Promise<void> {
  const q = await loadQueue();
  const filtered = q.filter((j) => j.status !== "failed");
  await saveQueue(filtered);
}

export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  failed: number;
  total: number;
}> {
  const q = await loadQueue();
  return {
    pending: q.filter((j) => j.status === "pending").length,
    processing: q.filter((j) => j.status === "processing").length,
    failed: q.filter((j) => j.status === "failed").length,
    total: q.length,
  };
}

/* =====================================================
ALIAS BOOTSTRAP
===================================================== */

export async function replayPendingJobs() {
  return processQueue();
}

/* =====================================================
QUEUE SIZE (legacy alias)
===================================================== */

export async function getQueueSize(): Promise<number> {
  try {
    const q = await loadQueue();
    return Array.isArray(q) ? q.length : 0;
  } catch {
    return 0;
  }
}

/* =====================================================
INTERNAL — URL parsing
===================================================== */

function parseEntityFromUrl(url: string): { entity: string; entityId: string } | null {
  const patterns: { entity: string; pattern: RegExp }[] = [
    { entity: "stock", pattern: /^stocks\/([^/]+)/ },
    { entity: "product", pattern: /^products\/([^/]+)/ },
    { entity: "inventory_session", pattern: /^inventory\/session\/([^/]+)/ },
    { entity: "close_day", pattern: /^sales\/close-day/ },
    { entity: "employee", pattern: /^employees\/([^/]+)/ },
  ];

  for (const { entity, pattern } of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { entity, entityId: match[1] };
    }
  }

  return null;
}