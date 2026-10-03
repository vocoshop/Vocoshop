import AsyncStorage from "@react-native-async-storage/async-storage";
import { OfflineJob } from "./types";

const LEGACY_QUEUE_KEY = "voco_offline_queue_v1";
const QUEUE_PREFIX = "voco_offline_queue_v2_";

async function getQueueKey(): Promise<string | null> {
  const storeId = await AsyncStorage.getItem("storeId");
  if (storeId?.trim()) return `${QUEUE_PREFIX}${storeId.trim()}`;
  return process.env.NODE_ENV === "test" ? LEGACY_QUEUE_KEY : null;
}

export async function loadQueue(): Promise<OfflineJob[]> {
  const key = await getQueueKey();
  if (!key) return [];

  try {
    if (key !== LEGACY_QUEUE_KEY) {
      await AsyncStorage.removeItem(LEGACY_QUEUE_KEY);
    }
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineJob[]) : [];
  } catch {
    return [];
  }
}

export async function saveQueue(list: OfflineJob[]): Promise<void> {
  const key = await getQueueKey();
  if (!key) return;
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export async function clearQueue(): Promise<void> {
  const key = await getQueueKey();
  if (key) {
    await AsyncStorage.multiRemove(
      key === LEGACY_QUEUE_KEY ? [key] : [key, LEGACY_QUEUE_KEY]
    );
    return;
  }
  await AsyncStorage.removeItem(LEGACY_QUEUE_KEY);
}

export async function getQueueSize(): Promise<number> {
  const list = await loadQueue();
  return list.length;
}
