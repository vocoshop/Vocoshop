import { Request, Response } from "express";
import { ocrService } from "../services/ocrService";
import { analyzeImageQuality } from "../services/imagePreprocess";
import OcrScan from "../models/OcrScan";
import ProductAlias from "../models/ProductAlias";
import { getStoreId } from "../utils/storeId";

export const scanDocument = async (req: Request, res: Response) => {
  try {
    const { images, image, pageCount, defaultLineType } = req.body;
    const storeId = getStoreId(req);

    if (!storeId) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const validTypes = ["sale", "stock_in", "expense", "debt"];
    const lineType = validTypes.includes(defaultLineType) ? defaultLineType : undefined;

    const imageList: string[] = images || (image ? [image] : []);
    if (imageList.length === 0) {
      return res.status(400).json({ error: "Image(s) requise(s)" });
    }

    const result = await ocrService.scanDocument(storeId, imageList, {
      pageCount: pageCount || imageList.length,
      defaultLineType: lineType,
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error("Erreur scan OCR:", err);
    res.status(500).json({ error: err.message || "Erreur lors du scan" });
  }
};

export const validateScan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { lines, feedback } = req.body;
    const storeId = getStoreId(req);

    if (!storeId) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const result = await ocrService.validateScan(id, storeId, lines, feedback);
    res.json(result);
  } catch (err: any) {
    console.error("Erreur validation OCR:", err);
    res.status(500).json({ error: err.message || "Erreur lors de la validation" });
  }
};

export const importScan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = getStoreId(req);

    if (!storeId) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const result = await ocrService.importValidatedScan(id, storeId);
    res.json(result);
  } catch (err: any) {
    console.error("Erreur import OCR:", err);
    res.status(500).json({ error: err.message || "Erreur lors de l'import" });
  }
};

export const getScanHistory = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const scans = await OcrScan.find({ storeId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await OcrScan.countDocuments({ storeId });

    res.json({ data: scans, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    console.error("Erreur historique OCR:", err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
};

export const getScanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const scan = await OcrScan.findOne({ _id: id, storeId }).lean();
    if (!scan) {
      return res.status(404).json({ error: "Scan introuvable" });
    }

    res.json(scan);
  } catch (err: any) {
    console.error("Erreur récupération scan:", err);
    res.status(500).json({ error: "Erreur lors de la récupération du scan" });
  }
};

export const getAliases = async (req: Request, res: Response) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({ error: "Authentification requise" });
    }

    const aliases = await ProductAlias.find({ storeId })
      .sort({ frequency: -1 })
      .lean();
    res.json({ data: aliases });
  } catch (err) {
    console.error("Erreur alias OCR:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des alias" });
  }
};

export const analyzeQuality = async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "Image requise" });
    }

    const result = await analyzeImageQuality(image);
    res.json(result);
  } catch (err) {
    console.error("Erreur analyse qualité:", err);
    res.status(500).json({ error: "Erreur lors de l'analyse" });
  }
};
