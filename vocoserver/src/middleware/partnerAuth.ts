import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

interface PartnerInfo {
  id: string;
  name: string;
  permissions: string[];
  storeId?: string;
}

const API_KEYS: Record<string, PartnerInfo> = {};

function loadApiKeys(): void {
  const keys = process.env.PARTNER_API_KEYS;
  if (!keys) return;
  try {
    const parsed = JSON.parse(keys);
    if (typeof parsed === "object" && parsed !== null) {
      Object.assign(API_KEYS, parsed);
    }
  } catch {
    console.error("❌ PARTNER_API_KEYS invalide dans .env");
  }
}

loadApiKeys();

export function registerPartnerApiKey(
  apiKey: string,
  info: PartnerInfo
): void {
  API_KEYS[apiKey] = info;
}

export function partnerAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({ error: "API key requise (header X-API-Key)" });
    return;
  }

  const partner = API_KEYS[apiKey];

  if (!partner) {
    res.status(403).json({ error: "API key invalide" });
    return;
  }

  (req as any).partner = partner;
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const partner = (req as any).partner as PartnerInfo;
    if (!partner || !partner.permissions.includes(permission)) {
      res.status(403).json({ error: `Permission '${permission}' requise` });
      return;
    }
    next();
  };
}
