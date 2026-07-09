import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AdminManager from "../models/AdminManager";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = "7d";

const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { email, password } = req.body;
    if (!email || !password) return next(new ValidationError("Email et mot de passe requis"));

    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const attempt = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };

    if (Date.now() < attempt.blockedUntil) {
      const remaining = Math.ceil((attempt.blockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${remaining} min.` });
    }

    const manager = await AdminManager.findOne({ email: email.toLowerCase() });
    if (!manager) {
      attempt.count += 1;
      if (attempt.count >= RATE_LIMIT_MAX) attempt.blockedUntil = Date.now() + RATE_LIMIT_WINDOW;
      loginAttempts.set(ip, attempt);
      return next(new UnauthorizedError("Email ou mot de passe incorrect"));
    }

    const valid = await bcrypt.compare(password, manager.passwordHash);
    if (!valid) {
      attempt.count += 1;
      if (attempt.count >= RATE_LIMIT_MAX) attempt.blockedUntil = Date.now() + RATE_LIMIT_WINDOW;
      loginAttempts.set(ip, attempt);
      return next(new UnauthorizedError("Email ou mot de passe incorrect"));
    }

    loginAttempts.delete(ip);
    manager.lastLoginAt = new Date();
    await manager.save();

    const token = jwt.sign(
      { role: "manager", managerId: String(manager._id), email: manager.email, name: `${manager.firstName} ${manager.lastName}` },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      token,
      user: {
        id: manager._id,
        email: manager.email,
        firstName: manager.firstName,
        lastName: manager.lastName,
        name: `${manager.firstName} ${manager.lastName}`,
        phone: manager.phone,
        photoUrl: manager.photoUrl,
        assignedRegions: manager.assignedRegions,
        assignedCities: manager.assignedCities,
        role: "manager",
      },
    });
  });

export const getProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const manager = await AdminManager.findById(req.manager!.managerId).select("-passwordHash");
    if (!manager) return next(new NotFoundError("Manager introuvable"));
    res.json({ user: manager });
  });
