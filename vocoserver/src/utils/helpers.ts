/**
 * Helper partagés pour tous les controllers
 */

const REAUTH_DAYS = Math.min(Math.max(Number(process.env.REAUTH_DAYS || 14), 1), 180);
const REAUTH_MS = REAUTH_DAYS * 24 * 60 * 60 * 1000;
const TIMEZONE = process.env.BUSINESS_TIMEZONE || "Africa/Brazzaville";

export function getBusinessDate(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function safeTrim(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

export function safeBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1" || v.toLowerCase() === "yes";
  if (typeof v === "number") return v === 1;
  return false;
}

export function safeNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function shouldReauth(lastActiveAt: any): boolean {
  if (!lastActiveAt) return false;
  const t = new Date(lastActiveAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > REAUTH_MS;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const OBJECTID_REGEX = /^[0-9a-fA-F]{24}$/;

export function isValidObjectId(id: any): id is string {
  return typeof id === "string" && OBJECTID_REGEX.test(id);
}

export function sanitizeObjectId(id: any): string | null {
  return isValidObjectId(id) ? id : null;
}
