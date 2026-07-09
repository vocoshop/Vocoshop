import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import { ocrService } from "../services/ocrService";
import { analyzeImageQuality } from "../services/imagePreprocess";
import OcrScan from "../models/OcrScan";
import ProductAlias from "../models/ProductAlias";
import { getStoreId } from "../utils/storeId";

export const scanDocument = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { images, image, pageCount, defaultLineType } = req.body;
    const storeId = getStoreId(req);

    if (!storeId) {
      return next(new UnauthorizedError("Authentification requise"));
    }

    const validTypes = ["sale", "stock_in", "expense", "debt"];
    const lineType = validTypes.includes(defaultLineType) ? defaultLineType : undefined;

    const imageList: string[] = images || (image ? [image] : []);
    if (imageList.length === 0) {
      return next(new ValidationError("Image(s) requise(s)"));
    }

    const result = await ocrService.scanDocument(storeId, imageList, {
      pageCount: pageCount || imageList.length,
      defaultLineType: lineType,
    });

    res.status(201).json(result);
  });

export const validateScan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { id } = req.params;
    const { lines, feedback } = req.body;
    const storeId = getStoreId(req);

    if (!storeId) {
      return next(new UnauthorizedError("Authentification requise"));
    }

    const result = await ocrService.validateScan(id, storeId, lines, feedback);
    res.json(result);
  });

export const importScan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { id } = req.params;
    const storeId = getStoreId(req);

    if (!storeId) {
      return next(new UnauthorizedError("Authentification requise"));
    }

    const result = await ocrService.importValidatedScan(id, storeId);
    res.json(result);
  });

export const getScanHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const storeId = getStoreId(req);
    if (!storeId) {
      return next(new UnauthorizedError("Authentification requise"));
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
  });

export const getScanById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { id } = req.params;
    const storeId = getStoreId(req);
    if (!storeId) {
      return next(new UnauthorizedError("Authentification requise"));
    }

    const scan = await OcrScan.findOne({ _id: id, storeId }).lean();
    if (!scan) {
      return next(new NotFoundError("Scan introuvable"));
    }

    res.json(scan);
  });

export const getAliases = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const storeId = getStoreId(req);
    if (!storeId) {
      return next(new UnauthorizedError("Authentification requise"));
    }

    const aliases = await ProductAlias.find({ storeId })
      .sort({ frequency: -1 })
      .lean();
    res.json({ data: aliases });
  });

export const analyzeQuality = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { image } = req.body;
    if (!image) {
      return next(new ValidationError("Image requise"));
    }

    const result = await analyzeImageQuality(image);
    res.json(result);
  });
