import { Request, Response, NextFunction } from "express";
import { DocumentType } from "../blockchain/types";
import {
  certifyDocument,
  verifyDocument,
  getStoreCertifications,
} from "../blockchain/documentCertifier";
import { certifyScore, computeScore, getScoreHistory, verifyScore } from "../blockchain/vocoScore";
import { getProofChain } from "../services/blockchainAnchorService";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError } from "../utils/AppError";

export const certifyDocumentHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = String(req.user?.storeId || req.body.storeId || "").trim();
  if (!storeId) return next(new ValidationError("storeId requis"));

  const { documentType, content, metadata } = req.body;
  if (!documentType || !content) return next(new ValidationError("documentType et content requis"));

  const result = await certifyDocument({ storeId, documentType, content, metadata });
  res.status(201).json(result);
});

export const verifyDocumentHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : typeof req.query?.content === "string" ? req.query.content.trim() : undefined;

  const result = await verifyDocument(id, content);
  res.json(result);
});

export const listCertificationsHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = String(req.user?.storeId || req.query.storeId || "").trim();
  if (!storeId) return next(new ValidationError("storeId requis"));

  const documentType = typeof req.query.documentType === "string" ? req.query.documentType as DocumentType : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const result = await getStoreCertifications(storeId, documentType, limit, offset);
  res.json(result);
});

export const certifyScoreHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = String(req.user?.storeId || req.body.storeId || "").trim();
  if (!storeId) return next(new ValidationError("storeId requis"));

  const result = await certifyScore(storeId);
  res.status(201).json(result);
});

export const getScoreHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = String(req.user?.storeId || req.query.storeId || "").trim();
  if (!storeId) return next(new ValidationError("storeId requis"));

  const score = await computeScore(storeId);
  res.json(score);
});

export const verifyScoreHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = String(req.user?.storeId || req.query.storeId || req.params.storeId || "").trim();
  if (!storeId) return next(new ValidationError("storeId requis"));

  const result = await verifyScore(storeId);
  res.json(result);
});

export const getScoreHistoryHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const storeId = String(req.user?.storeId || req.query.storeId || "").trim();
  if (!storeId) return next(new ValidationError("storeId requis"));

  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const result = await getScoreHistory(storeId, limit, offset);
  res.json(result);
});

export const getPublicProofsHandler = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 200);
  const proofs = await getProofChain(limit);
  res.json({ proofs, count: proofs.length });
});
