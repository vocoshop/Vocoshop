// src/offline/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { OfflineJob } from "./types";

const QUEUE_KEY = "voco_offline_queue_v1";

export async function loadQueue(): Promise<OfflineJob[]> {
try {
const raw = await AsyncStorage.getItem(QUEUE_KEY);
if (!raw) return [];
const parsed = JSON.parse(raw);
return Array.isArray(parsed) ? (parsed as OfflineJob[]) : [];
} catch {
return [];
}
}

export async function saveQueue(list: OfflineJob[]): Promise<void> {
await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export async function clearQueue(): Promise<void> {
await AsyncStorage.multiRemove([QUEUE_KEY]);
}

export async function getQueueSize(): Promise<number> {
const list = await loadQueue();
return list.length;
}
