import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../api";
import { isOnline, onNetworkChange } from "../utils/network";

const OCR_QUEUE_KEY = "voco_ocr_offline_queue_v1";

interface OcrOfflineJob {
  id: string;
  imageBase64List: string[];
  defaultLineType?: string;
  status: "pending" | "syncing" | "done" | "failed";
  createdAt: number;
  lastError?: string;
  scanResult?: any;
}

let started = false;
let syncCallbacks: Array<() => void> = [];

export function onOcrSync(cb: () => void) {
  syncCallbacks.push(cb);
  return () => {
    syncCallbacks = syncCallbacks.filter((fn) => fn !== cb);
  };
}

function notifySync() {
  syncCallbacks.forEach((fn) => fn());
}

async function loadQueue(): Promise<OcrOfflineJob[]> {
  try {
    const raw = await AsyncStorage.getItem(OCR_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveQueue(list: OcrOfflineJob[]) {
  await AsyncStorage.setItem(OCR_QUEUE_KEY, JSON.stringify(list));
}

export async function enqueueOcrScan(imageBase64List: string[], defaultLineType?: string): Promise<OcrOfflineJob> {
  const job: OcrOfflineJob = {
    id: `ocr_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    imageBase64List,
    defaultLineType,
    status: "pending",
    createdAt: Date.now(),
  };

  const list = await loadQueue();
  list.push(job);
  await saveQueue(list);
  notifySync();
  return job;
}

export async function syncPendingScans(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 };

  let list = await loadQueue();
  let synced = 0;
  let failed = 0;

  for (const job of list) {
    if (job.status !== "pending") continue;

    job.status = "syncing";
    await saveQueue(list);

    try {
      const images = job.imageBase64List.map((b) => `data:image/jpeg;base64,${b}`);
      const res = await API.post("/ocr/scan", {
        images,
        pageCount: images.length,
        defaultLineType: job.defaultLineType,
      });
      const data = res.data as { _id: string; globalConfidence: number };
      job.status = "done";
      job.scanResult = { _id: data._id, globalConfidence: data.globalConfidence };
      synced++;
    } catch (err: any) {
      job.status = "failed";
      job.lastError = err?.message || "SYNC_ERROR";
      failed++;
    }

    await saveQueue(list);
  }

  const remaining = (await loadQueue()).filter((j) => j.status !== "done");
  await saveQueue(remaining);

  notifySync();
  return { synced, failed };
}

export async function getPendingCount(): Promise<number> {
  const list = await loadQueue();
  return list.filter((j) => j.status === "pending" || j.status === "syncing").length;
}

export async function getOcrQueueStats(): Promise<{
  pending: number;
  failed: number;
  done: number;
  total: number;
}> {
  const list = await loadQueue();
  return {
    pending: list.filter((j) => j.status === "pending").length,
    failed: list.filter((j) => j.status === "failed").length,
    done: list.filter((j) => j.status === "done").length,
    total: list.length,
  };
}

export async function retryFailedScans(): Promise<number> {
  const list = await loadQueue();
  let count = 0;
  for (const job of list) {
    if (job.status === "failed") {
      job.status = "pending";
      job.lastError = undefined;
      count++;
    }
  }
  await saveQueue(list);
  notifySync();
  return count;
}

export function initOcrSyncEngine() {
  if (started) return;
  started = true;

  onNetworkChange((state) => {
    if (state.online) {
      syncPendingScans();
    }
  });
}

export async function clearDoneScans() {
  const list = await loadQueue();
  const filtered = list.filter((j) => j.status !== "done");
  await saveQueue(filtered);
}
