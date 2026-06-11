import { Request, Response } from "express";
import PlatformConfig from "../models/PlatformConfig";
import { seedPlatformConfig } from "../services/seedPlatformConfig";

export const getConfig = async (req: Request, res: Response) => {
  try {
    const category = String(req.query.category || "").trim();
    const filter = category ? { category } : {};
    const configs = await PlatformConfig.find(filter).sort({ category: 1, label: 1 }).lean();
    const grouped = configs.reduce((acc: any, c: any) => {
      if (!acc[c.category]) acc[c.category] = [];
      acc[c.category].push(c);
      return acc;
    }, {});
    res.json({ configs: grouped, all: configs });
  } catch (err: any) {
    console.error("❌ getConfig:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const updateConfig = async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: "Clé requise" });

    const config = await PlatformConfig.findOne({ key });
    if (!config) return res.status(404).json({ error: "Paramètre introuvable" });

    config.value = value;
    await config.save();

    res.json({ config: { key: config.key, value: config.value, label: config.label } });
  } catch (err: any) {
    console.error("❌ updateConfig:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

export const seedConfig = async (_req: Request, res: Response) => {
  try {
    await seedPlatformConfig();
    res.json({ message: "Configuration initialisée" });
  } catch (err: any) {
    console.error("❌ seedConfig:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
};