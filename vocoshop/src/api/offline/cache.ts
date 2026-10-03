// src/api/offline/cache.ts
// Cache de données offline — produits, stocks, rapports
// Chaque entrée a timestamp + version pour détection de conflits

import AsyncStorage from "@react-native-async-storage/async-storage";
import { isOnline } from "../utils/network";

/* =====================================================
TYPES
===================================================== */

export type CacheEntry<T> = {
  data: T;
  cachedAt: number; // timestamp millis
  version: number;  // incrémenté à chaque update serveur
  expiresAt: number; // expiration ms
  key: string;
};

export type CacheConfig = {
  ttl?: number;        // durée de vie en ms (défaut: 15 min)
  version?: number;    // force version spécifique
};

export type CachedResult<T> = {
  data: T;
  fromCache: boolean;
  stale: boolean; // true si périmé mais encore dispo
  version: number;
  cachedAt: number;
};

/* =====================================================
CONSTANTS
===================================================== */

const CACHE_PREFIX = "voco_cache_";
const DEFAULT_TTL = 15 * 60 * 1000; // 15 min
const LONG_TTL = 60 * 60 * 1000;    // 1h (produits)
const CRITICAL_TTL = 5 * 60 * 1000; // 5 min (stocks)

async function getCacheScope(): Promise<string | null> {
  const storeId = await AsyncStorage.getItem("storeId");
  if (storeId?.trim()) return storeId.trim();
  return process.env.NODE_ENV === "test" ? "test" : null;
}

/* =====================================================
LOW-LEVEL STORAGE
===================================================== */

async function cacheKey(entity: string, id?: string): Promise<string | null> {
  const scope = await getCacheScope();
  if (!scope) return null;
  return `${CACHE_PREFIX}${scope}_${entity}${id ? `_${id}` : ''}`;
}

export async function getRaw(key: string): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setRaw<T = any>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeRaw(key: string): Promise<void> {
  await AsyncStorage.multiRemove([key]);
}

/* =====================================================
🔥 CORE CACHE OPERATIONS
===================================================== */

export async function cacheSet<T>(
  entity: string,
  data: T,
  config: CacheConfig = {}
): Promise<CacheEntry<T>> {
const key = await cacheKey(entity);
if (!key) throw new Error("SESSION_REQUIRED");
const now = Date.now();
  const ttl = config.ttl ?? DEFAULT_TTL;

  const entry: CacheEntry<T> = {
    data,
    cachedAt: now,
    version: config.version ?? now,
    expiresAt: now + ttl,
    key,
  };

  await setRaw(key, entry);
  return entry;
}

export async function cacheGet<T>(entity: string, id?: string): Promise<CachedResult<T> | null> {
const key = await cacheKey(entity, id);
if (!key) return null;
const raw = await getRaw(key);
  if (!raw) return null;

  const entry = raw as CacheEntry<T>;
  const now = Date.now();
  const stale = now > entry.expiresAt;

  return {
    data: entry.data,
    fromCache: true,
    stale,
    version: entry.version,
    cachedAt: entry.cachedAt,
  };
}

export async function cacheInvalidate(entity: string, id?: string): Promise<void> {
const key = await cacheKey(entity, id);
if (key) await removeRaw(key);
}

export async function cacheClear(entity?: string): Promise<void> {
  if (!entity) {
    // clear all cache
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
    return;
  }
  await cacheInvalidate(entity);
}

/* =====================================================
🔥 ENTITY-SPECIFIC CACHE WRAPPERS
===================================================== */

// ========== PRODUCTS ==========

export async function cacheProducts(products: any[], version?: number): Promise<void> {
  await cacheSet("products", products, {
    ttl: LONG_TTL,
    version: version ?? Date.now(),
  });
}

export async function getCachedProducts(): Promise<CachedResult<any[]> | null> {
  return cacheGet("products");
}

// ========== SINGLE PRODUCT ==========

export async function cacheProduct(productId: string, product: any, version?: number): Promise<void> {
  await cacheSet(`product_${productId}`, product, {
    ttl: LONG_TTL,
    version: version ?? Date.now(),
  });
}

export async function getCachedProduct(productId: string): Promise<CachedResult<any> | null> {
  return cacheGet("product", productId);
}

// ========== STOCK ==========

export async function cacheStock(stockId: string, stock: any, version?: number): Promise<void> {
  await cacheSet(`stock_${stockId}`, stock, {
    ttl: CRITICAL_TTL,
    version: version ?? Date.now(),
  });
}

export async function getCachedStock(stockId: string): Promise<CachedResult<any> | null> {
  return cacheGet("stock", stockId);
}

export async function cacheStockList(stocks: any[], version?: number): Promise<void> {
  await cacheSet("stocks_list", stocks, {
    ttl: CRITICAL_TTL,
    version: version ?? Date.now(),
  });
}

export async function getCachedStocks(): Promise<CachedResult<any[]> | null> {
  return cacheGet("stocks_list");
}

// ========== REPORTS / BILAN ==========

export async function cacheReport(reportId: string, report: any, version?: number): Promise<void> {
  await cacheSet(`report_${reportId}`, report, {
    ttl: DEFAULT_TTL,
    version: version ?? Date.now(),
  });
}

export async function getCachedReport(reportId: string): Promise<CachedResult<any> | null> {
  return cacheGet("report", reportId);
}

// ========== INVENTORY SESSION ==========

export async function cacheInventorySession(session: any, version?: number): Promise<void> {
  await cacheSet(`inventory_${session._id || session.id}`, session, {
    ttl: CRITICAL_TTL,
    version: version ?? Date.now(),
  });
}

export async function getCachedInventorySession(sessionId: string): Promise<CachedResult<any> | null> {
  return cacheGet("inventory", sessionId);
}

// ========== CLOSE DAY ==========

export async function cacheCloseDay(closeId: string, closeData: any, version?: number): Promise<void> {
  await cacheSet(`closeday_${closeId}`, closeData, {
    ttl: DEFAULT_TTL,
    version: version ?? Date.now(),
  });
}

export async function getCachedCloseDay(closeId: string): Promise<CachedResult<any> | null> {
  return cacheGet("closeday", closeId);
}

/* =====================================================
🔥 SMART FETCH WITH CACHE FALLBACK
===================================================== */

export async function fetchWithCache<T>(
  entity: string,
  fetchFn: () => Promise<T>,
  getCachedFn: () => Promise<CachedResult<T> | null>,
  setCacheFn: (data: T, version?: number) => Promise<void>,
  options?: {
    ttl?: number;
    forceRefresh?: boolean;
    onCacheHit?: (data: T) => void;
    onFetchSuccess?: (data: T) => void;
  }
): Promise<CachedResult<T>> {
  const cached = await getCachedFn();

  // Si online et fresh → fetch
  if (isOnline()) {
    try {
      const data = await fetchFn();
      await setCacheFn(data);

      if (options?.onFetchSuccess) {
        options.onFetchSuccess(data);
      }

      return {
        data,
        fromCache: false,
        stale: false,
        version: Date.now(),
        cachedAt: Date.now(),
      };
    } catch (e) {
      // Fetch failed → use cache si disponible
      if (cached) {
        return cached;
      }
      throw e;
    }
  }

  // Offline → must use cache
  if (cached) {
    if (options?.onCacheHit) {
      options.onCacheHit(cached.data);
    }
    return cached;
  }

  // Pas de cache, pas de réseau → erreur
  throw new Error("OFFLINE_NO_CACHE");
}

/* =====================================================
🔥 BULK INVALIDATION (on sync complete)
===================================================== */

export async function invalidateOnSync(): Promise<void> {
  // Invalide les données critiques qui changent souvent
  await Promise.all([
    cacheInvalidate("stocks_list"),
  ]);
  // Produits restent en cache plus longtemps
}

/* =====================================================
🔥 CACHE STATS (debug/monitoring)
===================================================== */

export async function getCacheStats(): Promise<{
  keys: string[];
  totalSize: number;
  entries: { key: string; age: number; stale: boolean; version: number }[];
}> {
const scope = await getCacheScope();
if (!scope) return { keys: [], totalSize: 0, entries: [] };
const scopePrefix = `${CACHE_PREFIX}${scope}_`;
const allKeys = await AsyncStorage.getAllKeys();
const cacheKeys = allKeys.filter((k) => k.startsWith(scopePrefix));
  const entries: { key: string; age: number; stale: boolean; version: number }[] = [];
  let totalSize = 0;

  for (const key of cacheKeys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        totalSize += raw.length;
        const parsed = JSON.parse(raw);
        const now = Date.now();
        entries.push({
          key: key.replace(scopePrefix, ""),
          age: Math.round((now - (parsed.cachedAt || now)) / 1000),
          stale: now > (parsed.expiresAt || now),
          version: parsed.version || 0,
        });
      }
    } catch (e) { console.warn("cache getDebugInfo item", e); }
  }

  return { keys: cacheKeys, totalSize, entries };
}