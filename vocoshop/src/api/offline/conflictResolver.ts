// src/api/offline/conflictResolver.ts
// Résolution de conflits pour mutations offline
// Chaque mutation携带 un timestamp ou version pour détecter les conflits serveur

import { OfflineJob } from "./types";
import { loadQueue, saveQueue } from "./storage";
import AsyncStorage from '@react-native-async-storage/async-storage';

/* =====================================================
TYPES
===================================================== */

export type ConflictStrategy = "client_wins" | "server_wins" | "merge" | "ask_user";

export type ConflictInfo = {
  jobId: string;
  job: OfflineJob;
  serverVersion: number;
  serverTimestamp: number;
  clientVersion: number;
  clientTimestamp: number;
  field: string;
  serverValue: any;
  clientValue: any;
  strategy: ConflictStrategy;
};

export type ConflictResult = {
  resolved: boolean;
  action: "apply" | "skip" | "merge" | "pending";
  mergedData?: any;
  error?: string;
};

export type ConflictListener = (conflicts: ConflictInfo[]) => void;

/* =====================================================
CONFLICT STORE
Stocker les versions connues pour détecter les conflits
===================================================== */

const VERSION_KEY = "voco_versions_v1";

type VersionEntry = {
  entity: string;  // "stock", "product", "inventory_session"
  entityId: string;
  version: number;
  timestamp: number;
  serverHash: string; // hash des données serveur
};

let versionStore: VersionEntry[] = [];
let listeners = new Set<ConflictListener>();
let initialized = false;

/**
 * Charger le store de versions depuis AsyncStorage
 */
export async function initVersionStore(): Promise<void> {
  if (initialized) return;
  try {
    const raw = await AsyncStorage.getItem(VERSION_KEY);
    if (raw) {
      versionStore = JSON.parse(raw);
    }
    initialized = true;
  } catch {
    versionStore = [];
    initialized = true;
  }
}

async function saveVersionStore(): Promise<void> {
  await AsyncStorage.setItem(VERSION_KEY, JSON.stringify(versionStore));
}

/**
 * Enregistrer la version courante d'une entité (appelé après fetch réussi)
 */
export async function recordVersion(
  entity: string,
  entityId: string,
  version: number,
  timestamp: number,
  serverHash?: string
): Promise<void> {
  await initVersionStore();

  const idx = versionStore.findIndex(
    (v) => v.entity === entity && v.entityId === entityId
  );

  const entry: VersionEntry = {
    entity,
    entityId,
    version,
    timestamp,
    serverHash: serverHash ?? "",
  };

  if (idx >= 0) {
    versionStore[idx] = entry;
  } else {
    versionStore.push(entry);
  }

  await saveVersionStore();
}

/**
 * Récupérer la dernière version connue d'une entité
 */
export async function getLastVersion(
  entity: string,
  entityId: string
): Promise<VersionEntry | null> {
  await initVersionStore();
  return (
    versionStore.find(
      (v) => v.entity === entity && v.entityId === entityId
    ) || null
  );
}

/* =====================================================
CONFLICT DETECTION
===================================================== */

/**
 * Extraire entity + id d'une URL serveur
 * Ex: "/stocks/abc123" → entity="stock", id="abc123"
 */
function parseEntityFromUrl(url: string): { entity: string; entityId: string } | null {
  const parts = url.replace(/^\//, "").split("/");
  if (parts.length < 2) return null;

  // patterns courants
  // Note: URLs have a leading "/" (e.g. "/stocks/stock_123")
  const patterns = [
    { entity: "stock", pattern: /^\/?stocks\/([^/]+)/ },
    { entity: "product", pattern: /^\/?products\/([^/]+)/ },
    { entity: "inventory_session", pattern: /^\/?inventory\/session\/([^/]+)/ },
    { entity: "inventory_line", pattern: /^\/?inventory\/session\/([^/]+)\/add-line/ },
    { entity: "close_day", pattern: /^\/?sales\/close-day/ },
    { entity: "employee", pattern: /^\/?employees\/([^/]+)/ },
  ];

  for (const { entity, pattern } of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { entity, entityId: match[1] };
    }
  }

  return null;
}

/**
 * Vérifier si un job a un conflit avec l'état serveur connu
 * Retourne null si pas de conflit, sinon les détails du conflit
 */
export async function detectConflict(job: OfflineJob): Promise<ConflictInfo | null> {
  const parsed = parseEntityFromUrl(job.url);
  if (!parsed) return null;

  const lastKnown = await getLastVersion(parsed.entity, parsed.entityId);
  if (!lastKnown) return null;

  // Si le job a un timestamp de création → comparer
  const jobTimestamp = job.createdAt; // jobs ont createdAt = timestamp de création

  // Conflict si le serveur a été modifié APRÈS la création du job
  // ET que le job n'a pas encore été rejoué avec succès
  if (lastKnown.timestamp > jobTimestamp) {
    return {
      jobId: job.id,
      job,
      serverVersion: lastKnown.version,
      serverTimestamp: lastKnown.timestamp,
      clientVersion: lastKnown.version - 1,
      clientTimestamp: jobTimestamp,
      field: parsed.entity,
      serverValue: lastKnown.serverHash,
      clientValue: job.body,
      strategy: "server_wins", // par défaut
    };
  }

  return null;
}

/* =====================================================
CONFLICT RESOLUTION
===================================================== */

/**
 * Résoudre un conflit automatiquement selon la stratégie
 */
export function resolveConflict(
  conflict: ConflictInfo,
  strategy: ConflictStrategy = "server_wins"
): ConflictResult {
  switch (strategy) {
    case "server_wins":
      return { resolved: true, action: "skip" };

    case "client_wins":
      return {
        resolved: true,
        action: "apply",
        mergedData: { ...conflict.job.body, _forceApply: true },
      };

    case "merge":
      // Merge superficiel : on garde les champs non-conflictuels du client
      const merged = {
        ...conflict.serverValue,
        ...conflict.clientValue,
        _merged: true,
        _serverTimestamp: conflict.serverTimestamp,
      };
      return { resolved: true, action: "merge", mergedData: merged };

    case "ask_user":
    default:
      return { resolved: false, action: "pending" };
  }
}

/**
 * Traiter une queue avec détection de conflits
 * Retourne les jobs à rejouer et les conflits détectés
 */
export async function processQueueWithConflicts(): Promise<{
  toReplay: OfflineJob[];
  conflicts: ConflictInfo[];
  skipped: string[];
}> {
  const queue = await loadQueue();
  const toReplay: OfflineJob[] = [];
  const conflicts: ConflictInfo[] = [];
  const skipped: string[] = [];

  for (const job of queue) {
    if (job.status === "done") continue;

    const conflict = await detectConflict(job);
    if (conflict) {
      conflicts.push(conflict);
      // Par défaut skip les conflicts serveur
      const resolved = resolveConflict(conflict, "server_wins");
      if (resolved.action === "skip") {
        skipped.push(job.id);
        continue;
      }
    }

    toReplay.push(job);
  }

  return { toReplay, conflicts, skipped };
}

/* =====================================================
AUTO-RESOLVE CONFLICTS
===================================================== */

export async function autoResolveConflicts(strategy: ConflictStrategy = "server_wins"): Promise<{
  resolved: number;
  skipped: number;
  pending: number;
}> {
  const { toReplay, conflicts, skipped } = await processQueueWithConflicts();

  let resolved = 0;
  let pending = 0;

  for (const conflict of conflicts) {
    const result = resolveConflict(conflict, strategy);
    if (result.resolved) resolved++;
    else pending++;
  }

  // Nettoyer les skipped de la queue
  if (skipped.length > 0) {
    const queue = await loadQueue();
    const filtered = queue.filter((j) => !skipped.includes(j.id));
    await saveQueue(filtered);
  }

  return {
    resolved,
    skipped: skipped.length,
    pending,
  };
}

/* =====================================================
CONFLICT UI LISTENERS
===================================================== */

export function onConflictDetected(cb: ConflictListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function notifyConflictListeners(conflicts: ConflictInfo[]): void {
  listeners.forEach((fn) => fn(conflicts));
}

/* =====================================================
MANUAL VERSION SYNC
Appelé après un fetch réussi pour mettre à jour les versions
===================================================== */

export async function syncVersionsFromServer(data: {
  entity: string;
  id: string;
  version: number;
  updatedAt: string;
  dataHash?: string;
}[]): Promise<void> {
  for (const item of data) {
    await recordVersion(
      item.entity,
      item.id,
      item.version,
      new Date(item.updatedAt).getTime(),
      item.dataHash
    );
  }
}

/* =====================================================
TEST RESET (for test isolation)
===================================================== */

/** @internal Reset le cache interne pour les tests */
export function __resetVersionStore(): void {
  versionStore = [];
  initialized = false;
}

/* =====================================================
CONFLICT HISTORY (for user review)
===================================================== */

const CONFLICT_HISTORY_KEY = "voco_conflict_history_v1";

export async function logConflict(conflict: ConflictInfo): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICT_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift({
      ...conflict,
      resolvedAt: Date.now(),
    });
    // Garder les 50 derniers
    const trimmed = history.slice(0, 50);
    await AsyncStorage.setItem(CONFLICT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {}
}

export async function getConflictHistory(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(CONFLICT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearConflictHistory(): Promise<void> {
  await AsyncStorage.multiRemove([CONFLICT_HISTORY_KEY]);
}