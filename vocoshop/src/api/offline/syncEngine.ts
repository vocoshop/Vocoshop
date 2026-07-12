// src/offline/syncEngine.ts
import { AppState, AppStateStatus } from "react-native";
import { onNetworkChange, isOnline } from "../utils/network";
import { processQueue, getQueueSize, getQueueStats, getFailedJobs, clearFailedJob, clearAllFailed, retryAllFailed } from "./queue";
import { autoResolveConflicts } from "./conflictResolver";

/* =====================================================
SYNC ENGINE V5 — PRODUCTION READY
- smart background sync
- anti double process
- silent UI updates
- conflict auto-resolution
- foreground sync trigger
===================================================== */

type Listener = (state: {
  syncing: boolean;
  queueSize: number;
  failed: number;
  pending: number;
}) => void;

let listeners = new Set<Listener>();

let syncing = false;
let queueSize = 0;
let failedCount = 0;
let pendingCount = 0;
let started = false;

// Anti-spam
let lastSyncTime = 0;
const MIN_SYNC_INTERVAL = 2500;

// Track last successful sync
let lastSyncFinished = 0;

// Track failed jobs for UI
let failedJobs: any[] = [];

/* =====================================================
NOTIFY LISTENERS
===================================================== */

function notify() {
  listeners.forEach((fn) =>
    fn({ syncing, queueSize, failed: failedCount, pending: pendingCount })
  );
}

async function refreshStats() {
  try {
    const stats = await getQueueStats();
    queueSize = stats.total;
    pendingCount = stats.pending;
    failedCount = stats.failed;
    failedJobs = await getFailedJobs();
  } catch {
    queueSize = 0;
    pendingCount = 0;
    failedCount = 0;
    failedJobs = [];
  }
  notify();
}

/* =====================================================
INIT ENGINE (ONCE AT APP START)
===================================================== */

export function initSyncEngine() {
  if (started) return;
  started = true;

  refreshStats();

  // ✅ Trigger sync quand internet revient
  onNetworkChange(async (s) => {
    if (s.online) {
      triggerSync();
    }
  });

  // ✅ NEW — Sync aussi quand l'app revient au premier plan
  let appState = AppState.currentState;
  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextState === "active") {
      // App came to foreground → trigger sync
      if (isOnline()) {
        triggerSync();
      }
    }
    appState = nextState;
  };

  const subscription = AppState.addEventListener("change", handleAppStateChange);
}

/* =====================================================
TRIGGER SYNC
===================================================== */

export async function triggerSync(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  remaining: number;
} | null> {
  const now = Date.now();

  if (syncing) return null;
  if (now - lastSyncTime < MIN_SYNC_INTERVAL) return null;

  lastSyncTime = now;
  syncing = true;
  notify();

  try {
    // Auto-résoudre les conflits (serveur gagne)
    await autoResolveConflicts("server_wins");

    // Traiter la queue
    const result = await processQueue({ max: 50 });

    lastSyncFinished = Date.now();

    return result;
  } catch (e) {
    console.log("⚠️ SyncEngine error:", e);
    return null;
  } finally {
    await refreshStats();
    syncing = false;
    notify();
  }
}

/* =====================================================
MANUAL SYNC (user triggered)
===================================================== */

export async function forceSync(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
  remaining: number;
}> {
  // Reset anti-spam pour forcer le sync
  lastSyncTime = 0;
  const result = await triggerSync();
  return result ?? { processed: 0, failed: 0, skipped: 0, remaining: queueSize };
}

/* =====================================================
SUBSCRIBE UI
===================================================== */

export function onSyncState(cb: Listener): () => void {
  listeners.add(cb);

  cb({ syncing, queueSize, failed: failedCount, pending: pendingCount });

  return () => listeners.delete(cb);
}

/* =====================================================
EXPOSE LAST SYNC TIME
===================================================== */

export function getLastSyncFinished() {
  return lastSyncFinished;
}

/* =====================================================
FAILED JOBS MANAGEMENT
===================================================== */

export async function getFailedJobsUI() {
  return failedJobs;
}

export async function retryFailedJob(jobId: string): Promise<boolean> {
  const { retryJob } = await import("./queue");
  return retryJob(jobId);
}

export async function retryAllFailedJobs(): Promise<number> {
  const count = await retryAllFailed();
  await refreshStats();
  triggerSync();
  return count;
}

export async function clearFailedJobUI(jobId: string): Promise<void> {
  await clearFailedJob(jobId);
  await refreshStats();
}

export async function clearAllFailedJobs(): Promise<void> {
  await clearAllFailed();
  await refreshStats();
}

/* =====================================================
CLEAR ALL PENDING JOBS
===================================================== */

export async function clearAllPending(): Promise<void> {
  const { clearQueue } = await import("./queue");
  await clearQueue();
  await refreshStats();
}

/* =====================================================
QUEUE DETAILS
===================================================== */

export async function getQueueDetails(): Promise<{
  pending: number;
  processing: number;
  failed: number;
  total: number;
  failedJobs: any[];
}> {
  await refreshStats();
  return {
    pending: pendingCount,
    processing: 0, // not tracked separately
    failed: failedCount,
    total: queueSize,
    failedJobs,
  };
}

/* =====================================================
FORCE REFRESH STATS
===================================================== */

export async function refresh() {
  await refreshStats();
}