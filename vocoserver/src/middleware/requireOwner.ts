import { Request, Response, NextFunction } from "express";

export default function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).json({ error: "Accès réservé au Super Admin" });
  }
  next();
}
