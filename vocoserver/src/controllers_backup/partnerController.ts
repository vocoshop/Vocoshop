import { Request, Response } from "express";
import Partner from "../models/Partner";
import SharedReportLink from "../models/SharedReportLink";
import Product from "../models/Product";
import { isValidObjectId } from "../utils/helpers";

/* =====================================================
   GET /api/admin/partners
   ===================================================== */
export const getPartners = async (req: Request, res: Response) => {
  try {
    const partners = await Partner.find().sort({ order: 1, createdAt: 1 }).lean();
    return res.json({ partners });
  } catch (err: any) {
    console.error("❌ getPartners:", err?.message || err);
    return res.status(500).json({ error: "Erreur serveur", partners: [] });
  }
};

/* =====================================================
   GET /api/admin/partners/:id
   ===================================================== */
export const getPartner = async (req: Request, res: Response) => {
  try {
    const partner = await Partner.findById(req.params.id).lean();
    if (!partner) return res.status(404).json({ error: "Partenaire introuvable" });
    res.json(partner);
  } catch (err) {
    console.error("❌ getPartner:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   POST /api/admin/partners
   ===================================================== */
export const createPartner = async (req: Request, res: Response) => {
  try {
    const { name, type, email, phone, min, max, responseTime, rate, active, order } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Nom et email requis" });
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
  } catch (err) {
    console.error("❌ createPartner:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   PUT /api/admin/partners/:id
   ===================================================== */
export const updatePartner = async (req: Request, res: Response) => {
  try {
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

    if (!partner) return res.status(404).json({ error: "Partenaire introuvable" });
    res.json(partner);
  } catch (err) {
    console.error("❌ updatePartner:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   DELETE /api/admin/partners/:id
   ===================================================== */
export const deletePartner = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!isValidObjectId(id)) return res.status(400).json({ error: "ID invalide" });
    const partner = await Partner.findByIdAndDelete(id).lean();
    if (!partner) return res.status(404).json({ error: "Partenaire introuvable" });
    res.json({ message: "Partenaire supprimé" });
  } catch (err) {
    console.error("❌ deletePartner:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   POST /api/partner/documents/verify (existant)
   ===================================================== */
export const partnerVerifyDocument = async (req: Request, res: Response) => {
  try {
    const storeId = String(req.body?.storeId || "").trim();
    if (!isValidObjectId(storeId)) return res.status(400).json({ error: "storeId invalide" });
    const reportMonth = req.body?.reportMonth;

    const month = String(reportMonth || new Date().toISOString().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Format de mois invalide (attendu YYYY-MM)" });
    }
    const link = await SharedReportLink.findOne({ storeId, month, isActive: true }).lean();

    if (!link) {
      return res.status(404).json({ error: "Aucun bilan disponible pour ce mois" });
    }

    res.json({
      valid: true,
      storeId,
      month,
      token: link.token,
      dataHash: link.dataHash,
      expiresAt: link.expiresAt,
    });
  } catch (err) {
    console.error("❌ partnerVerifyDocument:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   GET /api/partner/score/:storeId (existant)
   ===================================================== */
export const partnerVerifyScore = async (req: Request, res: Response) => {
  try {
    const storeId = String(req.params.storeId || "").trim();
    if (!isValidObjectId(storeId)) return res.status(400).json({ error: "storeId invalide" });

    const products = await Product.find({ storeId }).lean();
    const totalProducts = products.length;

    res.json({
      storeId,
      totalProducts,
      hasData: totalProducts > 0,
    });
  } catch (err) {
    console.error("❌ partnerVerifyScore:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
   POST /api/partner/hash/:hash/verify (existant)
   ===================================================== */
export const partnerVerifyByHash = async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    if (!hash) return res.status(400).json({ error: "Hash requis" });

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
  } catch (err) {
    console.error("❌ partnerVerifyByHash:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
};
