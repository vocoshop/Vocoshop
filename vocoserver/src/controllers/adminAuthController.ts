// controllers/adminAuthController.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { logSystem } from "../utils/systemLogger";
import PlatformConfig from "../models/PlatformConfig";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, UnauthorizedError } from "../utils/AppError";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD_PLAIN = process.env.ADMIN_PASSWORD || "";
const ADMIN_NAME = process.env.ADMIN_NAME || "";
const ADMIN_SURNAME = process.env.ADMIN_SURNAME || "";

let cachedHash: string | null = null;
let cachedDbConfig: { email: string; passwordHash: string } | null = null;
let dbConfigLastFetch = 0;
const failedAttempts = new Map<string, { count: number; blockedUntil: number }>();

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 min

async function getAdminConfig(): Promise<{ email: string; passwordHash: string }> {
  // Refresh from DB every 30s
  if (Date.now() - dbConfigLastFetch > 30000) {
    try {
      const doc = await PlatformConfig.findOne({ key: "admin_auth" }).lean();
      if (doc?.value?.email && doc?.value?.passwordHash) {
        cachedDbConfig = { email: doc.value.email, passwordHash: doc.value.passwordHash };
      } else {
        cachedDbConfig = null;
      }
    } catch {
      cachedDbConfig = null;
    }
    dbConfigLastFetch = Date.now();
  }
  return cachedDbConfig || { email: ADMIN_EMAIL, passwordHash: await getAdminHash() };
}

async function getAdminHash(): Promise<string> {
  if (!cachedHash) {
    cachedHash = await bcrypt.hash(ADMIN_PASSWORD_PLAIN, 10);
  }
  return cachedHash;
}

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || "unknown";
}

/* =====================================================
POST /api/admin/auth/login
Connexion sécurisée par email + mot de passe
Body: { email, password }
===================================================== */
export const loginAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  const ip = getClientIp(req);

  if (!email || !password) {
    return next(new ValidationError("Email et mot de passe requis"));
  }

  // Rate limit check
  const attempt = failedAttempts.get(ip);
  if (attempt && attempt.blockedUntil > Date.now()) {
    logSystem("security", `Tentative bloquée (rate limit) depuis ${ip}`, {
      source: "auth",
      ip,
      details: `email=${email}`,
    });
    const remaining = Math.ceil((attempt.blockedUntil - Date.now()) / 1000 / 60);
    return res.status(429).json({
      error: `Trop de tentatives. Réessayez dans ${remaining} minute(s).`,
    });
  }

  // Get credentials (DB override or env fallback)
  const config = await getAdminConfig();

  // Verify credentials
  if (email.toLowerCase() !== config.email.toLowerCase()) {
    logSystem("security", `Échec login: email inconnu depuis ${ip}`, {
      source: "auth",
      ip,
      details: `email=${email}`,
    });
    const current = failedAttempts.get(ip) || { count: 0, blockedUntil: 0 };
    current.count++;
    if (current.count >= MAX_ATTEMPTS) {
      current.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    }
    failedAttempts.set(ip, current);
    return next(new UnauthorizedError("Email ou mot de passe incorrect"));
  }

  const passwordOk = await bcrypt.compare(password, config.passwordHash);
  if (!passwordOk) {
    const current = failedAttempts.get(ip) || { count: 0, blockedUntil: 0 };
    current.count++;
    if (current.count >= MAX_ATTEMPTS) {
      current.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    }
    failedAttempts.set(ip, current);
    return next(new UnauthorizedError("Email ou mot de passe incorrect"));
  }

  // Success — reset failed attempts
  failedAttempts.delete(ip);

  logSystem("security", `Super Admin connecté depuis ${ip}`, {
    source: "auth",
    ip,
  });

  // Generate JWT
  const adminName = [ADMIN_NAME, ADMIN_SURNAME].filter(Boolean).join(' ');

  const JWT_SECRET = process.env.JWT_SECRET!;
  const token = jwt.sign(
    { role: "owner", email: config.email, name: adminName },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json({
    message: "Connexion réussie",
    token,
    name: adminName,
    user: {
      name: adminName,
      email: config.email,
      role: "owner",
    },
  });
});

/* =====================================================
PUT /api/admin/auth/credentials
Changer l'email et/ou le mot de passe du Super Admin
Body: { email?, password? }
===================================================== */
export const changeCredentials = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;
  if (!email && !password) {
    return next(new ValidationError("Fournissez au moins un email ou un nouveau mot de passe"));
  }

  // Get current config to merge partial updates
  const existing = await PlatformConfig.findOne({ key: "admin_auth" }).lean();
  const current = (existing?.value || {}) as any;

  const newEmail = email || current.email || ADMIN_EMAIL;
  const newPasswordHash = password
    ? await bcrypt.hash(password, 10)
    : current.passwordHash || await getAdminHash();

  await PlatformConfig.findOneAndUpdate(
    { key: "admin_auth" },
    {
      $set: {
        value: { email: newEmail, passwordHash: newPasswordHash },
        type: "json",
        category: "security",
        label: "Identifiants Super Admin",
        description: "Email et mot de passe de connexion Super Admin (stockés en base)",
      },
    },
    { upsert: true }
  );

  // Invalidate cache
  dbConfigLastFetch = 0;

  logSystem("security", `Identifiants Super Admin modifiés depuis ${getClientIp(req)}`, {
    source: "auth",
    ip: getClientIp(req),
    details: email ? `nouvel email: ${email}` : "mot de passe changé",
  });

  return res.json({
    success: true,
    message: "Identifiants mis à jour",
    email: newEmail,
    hint: password ? "Mot de passe modifié" : "Email modifié",
  });
});
