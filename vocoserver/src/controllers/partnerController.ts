import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import Partner from "../models/Partner";
import SharedReportLink from "../models/SharedReportLink";
import Product from "../models/Product";
import { isValidObjectId } from "../utils/helpers";

/* =====================================================
   GET /api/admin/partners
   ===================================================== */
export const getPartners = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const partners = await Partner.find().sort({ order: 1, createdAt: 1 }).lean();
    return res.json({ partners });
  });

/* =====================================================
   GET /api/admin/partners/:id
   ===================================================== */
export const getPartner = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const partner = await Partner.findById(req.params.id).lean();
    if (!partner) return next(new NotFoundError("Partenaire introuvable"));
    res.json(partner);
  });

/* =====================================================
   POST /api/admin/partners
   ===================================================== */
export const createPartner = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { name, type, email, phone, min, max, responseTime, rate, active, order } = req.body;

    if (!name || !email) {
      return next(new ValidationError("Nom et email requis"));
    }

    const partner = await Partner.create({
      name: name.trim(),
      type: type || "Microfinance",
      email: email.trim().toLowerCase(),
      phone: phone || "",
      min: Number(min) || 0,
      max: Number(max) || 0,
      responseTime: responseTime || "",
      rate: rate || "",
      active: active !== false,
      order: Number(order) || 0,
    });

    res.status(201).json(partner);
  });

/* =====================================================
   PUT /api/admin/partners/:id
   ===================================================== */
export const updatePartner = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { name, type, email, phone, min, max, responseTime, rate, active, order } = req.body;

    const partner = await Partner.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name: name.trim() }),
        ...(type !== undefined && { type }),
        ...(email !== undefined && { email: email.trim().toLowerCase() }),
        ...(phone !== undefined && { phone }),
        ...(min !== undefined && { min: Number(min) }),
        ...(max !== undefined && { max: Number(max) }),
        ...(responseTime !== undefined && { responseTime }),
        ...(rate !== undefined && { rate }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order: Number(order) }),
      },
      { new: true }
    ).lean();

    if (!partner) return next(new NotFoundError("Partenaire introuvable"));
    res.json(partner);
  });

/* =====================================================
   DELETE /api/admin/partners/:id
   ===================================================== */
export const deletePartner = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return next(new ValidationError("ID invalide"));
    const partner = await Partner.findByIdAndDelete(id).lean();
    if (!partner) return next(new NotFoundError("Partenaire introuvable"));
    res.json({ message: "Partenaire supprimé" });
  });

/* =====================================================
   POST /api/partner/documents/verify (existant)
   ===================================================== */
export const partnerVerifyDocument = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const storeId = String(req.body?.storeId || "").trim();
    if (!isValidObjectId(storeId)) return next(new ValidationError("storeId invalide"));
    const reportMonth = req.body?.reportMonth;

    const month = String(reportMonth || new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return next(new ValidationError("Format de mois invalide (attendu YYYY-MM)"));
    }
    const link = await SharedReportLink.findOne({ storeId, month, isActive: true }).lean();

    if (!link) {
      return next(new NotFoundError("Aucun bilan disponible pour ce mois"));
    }

    res.json({
      valid: true,
      storeId,
      month,
      token: link.token,
      dataHash: link.dataHash,
      expiresAt: link.expiresAt,
    });
  });

/* =====================================================
   GET /api/partner/score/:storeId (existant)
   ===================================================== */
export const partnerVerifyScore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const storeId = String(req.params.storeId || "").trim();
    if (!isValidObjectId(storeId)) return next(new ValidationError("storeId invalide"));

    const products = await Product.find({ storeId }).lean();
    const totalProducts = products.length;

    res.json({
      storeId,
      totalProducts,
      hasData: totalProducts > 0,
    });
  });

/* =====================================================
   POST /api/partner/hash/:hash/verify (existant)
   ===================================================== */
export const partnerVerifyByHash = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const { hash } = req.params;
    if (!hash) return next(new ValidationError("Hash requis"));

    const link = await SharedReportLink.findOne({ dataHash: hash }).lean();

    if (!link) {
      return res.status(404).json({ valid: false, error: "Aucun document trouvé pour ce hash" });
    }

    res.json({
      valid: true,
      storeId: link.storeId,
      month: link.month,
      token: link.token,
      createdAt: link.createdAt,
    });
  });
