// src/api/offline/types.ts
export type OfflineHttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type OfflineJobStatus = "pending" | "processing" | "failed" | "done";

export type OfflineJob = {
  id: string;
  createdAt: number;

  // debug/UX
  title?: string;

  // requête à rejouer
  method: OfflineHttpMethod;
  url: string; // ex: "/inventory/session/xxx/add-line"
  body?: any;

  // headers utiles (token/storeId, etc.)
  headers?: Record<string, string>;

  // retry
  tries: number;
  lastError?: string;
  status: OfflineJobStatus;

  // 🔥 V5 — conflict tracking
  entity?: string;    // "stock", "product", etc.
  entityId?: string; // id de l'entité modifiée
  version?: number;   // version connue au moment de la création
  fingerprint?: string;
};