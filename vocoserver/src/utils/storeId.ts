import { Request } from "express";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Un principal plateforme (super admin / owner sans boutique) est le seul
 * autorisé à cibler une boutique via header/body : tous les autres doivent
 * provenir du JWT.
 */
function isPlatformAdmin(user: any): boolean {
if (!user) return false;
if (user.role !== "owner") return false;
const perms = user.permissions;
return !!perms && typeof perms === "object" && (perms as any)["*"] === true;
}

function readUntrustedStoreId(req: Request): string | null {
const headerId = (req.headers?.["x-store-id"] ?? req.headers?.["x-storeid"]) as
| string
| string[]
| undefined;

const candidates: unknown[] = [
typeof headerId === "string" ? headerId : Array.isArray(headerId) ? headerId[0] : undefined,
(req.body as any)?.storeId,
];

for (const raw of candidates) {
// On n'accepte qu'un ObjectId strict : bloque les opérateurs Mongo
// injectés sous forme de chaîne et les valeurs arbitraires.
if (typeof raw === "string" && OBJECT_ID_RE.test(raw.trim())) return raw.trim();
}

return null;
}

/**
 * Extrait le storeId de la requête — source de vérité : le JWT.
 *
 * Priorité :
 * 1. JWT (req.user.storeId) : fait autorité, header/body ignorés
 *    (empêche un utilisateur authentifié de cibler une autre boutique).
 * 2. Header `x-store-id` / body.storeId : réservé aux principaux
 *    plateforme, et validé comme ObjectId.
 * 3. null : aucun contexte boutique exploitable.
 */
export function getStoreId(req: Request): string | null {
const fromToken = req?.user?.storeId;
if (typeof fromToken === "string" && fromToken.trim()) return fromToken.trim();

if (!isPlatformAdmin(req?.user)) return null;

return readUntrustedStoreId(req);
}