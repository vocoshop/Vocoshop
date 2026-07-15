import { z } from "zod";
import { Request, Response, NextFunction } from "express";

/* =====================================================
VALIDATION MIDDLEWARE — Zod
===================================================== */

export const storeRegistrationSchema = z.object({
  phone: z.string().min(8, "Numéro de téléphone trop court"),
  password: z.string().min(6, "Mot de passe trop court (min 6 caractères)"),
  storeName: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  deviceId: z.string().optional(),
  referralCodeUsed: z.string().optional(),
});

export const otpRequestSchema = z.object({
  phone: z.string().min(8, "Numéro de téléphone invalide"),
});

export const otpVerifySchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6, "Le code doit contenir 6 chiffres"),
  deviceId: z.string().min(1, "deviceId requis"),
  forceRelink: z.boolean().optional(),
  storeName: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
});

export const addSaleSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive("La quantité doit être positive"),
  unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
  total: z.number().min(0),
  paymentMethod: z.string().optional(),
  customerName: z.string().max(100).optional(),
});

export const addProductSchema = z.object({
  name: z.string().min(1, "Nom du produit requis").max(200),
  sellPrice: z.coerce.number().min(0, "Prix de vente invalide"),
  quantity: z.coerce.number().min(0, "Quantité invalide").default(0),
  category: z.string().max(100).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  unit: z.string().max(20).optional(),
  baseUnit: z.string().max(20).optional(),
  alertLevel: z.coerce.number().min(0).optional(),
  alertThreshold: z.coerce.number().min(0).optional(),
  expirationDate: z.string().optional(),
  purchaseConfigs: z.string().optional(),
  sellConfigs: z.string().optional(),
});

export const addStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive("La quantité doit être positive"),
  expirationDate: z.string().optional(),
  supplierId: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
});

export const createOrderSchema = z.object({
  supplierId: z.string().min(1, "Fournisseur requis"),
  items: z.array(z.object({
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
  })).min(1, "Au moins un produit requis"),
  totalEstimated: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

export const fundingDemandeSchema = z.object({
  amount: z.number().positive().max(10000000, "Montant trop élevé"),
  duration: z.number().positive().max(60, "Durée maximale 60 mois"),
  objective: z.string().min(1, "Objectif requis").max(500),
  partnerId: z.string().min(1, "Partenaire requis"),
  businessName: z.string().min(1).max(200).optional(),
  businessType: z.string().max(100).optional(),
  monthlyRevenue: z.number().min(0).optional(),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: "Le consentement est obligatoire" }),
  }),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

/**
 * Middleware de validation Zod
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return res.status(400).json({
        error: "Données invalides",
        details: errors,
      });
    }
    req.body = result.data;
    next();
  };
}
