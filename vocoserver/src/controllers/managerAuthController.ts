import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AdminManager from "../models/AdminManager";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRY = "7d";

const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

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
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    const valid = await bcrypt.compare(password, manager.passwordHash);
    if (!valid) {
      attempt.count += 1;
      if (attempt.count >= RATE_LIMIT_MAX) attempt.blockedUntil = Date.now() + RATE_LIMIT_WINDOW;
      loginAttempts.set(ip, attempt);
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
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
  } catch (e) {
    console.error("❌ managerLogin error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const manager = await AdminManager.findById(req.manager!.managerId).select("-passwordHash");
    if (!manager) return res.status(404).json({ error: "Manager introuvable" });
    res.json({ user: manager });
  } catch (e) {
    console.error("❌ managerProfile error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
