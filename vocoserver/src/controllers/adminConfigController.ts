import { Request, Response, NextFunction } from "express";
import PlatformConfig from "../models/PlatformConfig";
import { seedPlatformConfig } from "../services/seedPlatformConfig";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError } from "../utils/AppError";

export const getConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const category = String(req.query.category || "").trim();
  const filter = category ? { category } : {};
  const configs = await PlatformConfig.find(filter).sort({ category: 1, label: 1 }).lean();
  const grouped = configs.reduce((acc: any, c: any) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});
  res.json({ configs: grouped, all: configs });
});

export const updateConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { key, value } = req.body;
  if (!key || typeof key !== "string") return next(new ValidationError("Clé requise"));

  const config = await PlatformConfig.findOne({ key: String(key) });
  if (!config) return next(new NotFoundError("Paramètre introuvable"));

  config.value = value;
  await config.save();

  res.json({ config: { key: config.key, value: config.value, label: config.label } });
});

export const seedConfig = asyncHandler(async (_req: Request, res: Response, next: NextFunction) => {
  await seedPlatformConfig();
  res.json({ message: "Configuration initialisée" });
});
