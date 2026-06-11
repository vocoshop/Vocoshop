import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import AdminManager from "../models/AdminManager";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function requireManager(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token manquant" });
    }

    const token = auth.split(" ")[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== "manager" && decoded.role !== "owner") {
      return res.status(403).json({ error: "Accès réservé aux Admin Managers" });
    }

    if (decoded.role === "owner") {
      req.manager = { managerId: "owner", email: decoded.email || "", name: "Super Admin", firstName: "Super", lastName: "Admin", assignedRegions: [], assignedCities: [] };
      return next();
    }

    const manager = await AdminManager.findById(decoded.managerId).select("-passwordHash");
    if (!manager || !manager.isActive) {
      return res.status(403).json({ error: "Compte désactivé ou introuvable" });
    }

    req.manager = {
      managerId: String(manager._id),
      email: manager.email,
      name: `${manager.firstName} ${manager.lastName}`,
      firstName: manager.firstName,
      lastName: manager.lastName,
      assignedRegions: manager.assignedRegions,
      assignedCities: manager.assignedCities,
    };

    next();
  } catch (e) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}
