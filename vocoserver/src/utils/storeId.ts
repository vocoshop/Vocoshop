import { Request } from "express";

/**
 * Extrait le storeId de la requête.
 * Priorité : JWT (req.user.storeId) → header x-store-id → body storeId
 */
export function getStoreId(req: Request): string | null {
  const fromToken = req?.user?.storeId;
  if (typeof fromToken === "string" && fromToken.trim()) return fromToken.trim();

  const headerId = req.headers?.["x-store-id"];
  if (typeof headerId === "string" && headerId.trim()) return headerId.trim();

  const bodyId = (req.body as any)?.storeId;
  if (typeof bodyId === "string" && bodyId.trim()) return bodyId.trim();

  return null;
}
