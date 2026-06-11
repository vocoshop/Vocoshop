import { Request, Response } from "express";
import {
  certifyDocument,
  verifyDocument,
  getStoreCertifications,
} from "../blockchain/documentCertifier";
import { certifyScore, computeScore, getScoreHistory, verifyScore } from "../blockchain/vocoScore";
import { getProofChain } from "../services/blockchainAnchorService";

export async function certifyDocumentHandler(req: Request, res: Response): Promise<void> {
  try {
    const storeId = req.user?.storeId || req.body.storeId;
    if (!storeId) {
      res.status(400).json({ error: "storeId requis" });
      return;
    }

    const { documentType, content, metadata } = req.body;
    if (!documentType || !content) {
      res.status(400).json({ error: "documentType et content requis" });
      return;
    }

    const result = await certifyDocument({ storeId, documentType, content, metadata });
    res.status(201).json(result);
  } catch (err) {
    console.error("❌ certifyDocument:", err);
    res.status(500).json({ error: "Erreur lors de la certification" });
  }
}

export async function verifyDocumentHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const content = req.body?.content || req.query?.content as string | undefined;

    const result = await verifyDocument(id, content);
    res.json(result);
  } catch (err) {
    console.error("❌ verifyDocument:", err);
    res.status(500).json({ error: "Erreur lors de la vérification" });
  }
}

export async function listCertificationsHandler(req: Request, res: Response): Promise<void> {
  try {
    const storeId = req.user?.storeId || req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId requis" });
      return;
    }

    const documentType = req.query.documentType as any || undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await getStoreCertifications(storeId, documentType, limit, offset);
    res.json(result);
  } catch (err) {
    console.error("❌ listCertifications:", err);
    res.status(500).json({ error: "Erreur lors de la récupération" });
  }
}

export async function certifyScoreHandler(req: Request, res: Response): Promise<void> {
  try {
    const storeId = req.user?.storeId || req.body.storeId;
    if (!storeId) {
      res.status(400).json({ error: "storeId requis" });
      return;
    }

    const result = await certifyScore(storeId);
    res.status(201).json(result);
  } catch (err) {
    console.error("❌ certifyScore:", err);
    res.status(500).json({ error: "Erreur lors de la certification du score" });
  }
}

export async function getScoreHandler(req: Request, res: Response): Promise<void> {
  try {
    const storeId = req.user?.storeId || req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId requis" });
      return;
    }

    const score = await computeScore(storeId);
    res.json(score);
  } catch (err) {
    console.error("❌ getScore:", err);
    res.status(500).json({ error: "Erreur lors du calcul du score" });
  }
}

export async function verifyScoreHandler(req: Request, res: Response): Promise<void> {
  try {
    const storeId = req.user?.storeId || req.query.storeId as string || req.params.storeId;
    if (!storeId) {
      res.status(400).json({ error: "storeId requis" });
      return;
    }

    const result = await verifyScore(storeId);
    res.json(result);
  } catch (err) {
    console.error("❌ verifyScore:", err);
    res.status(500).json({ error: "Erreur lors de la vérification du score" });
  }
}

export async function getScoreHistoryHandler(req: Request, res: Response): Promise<void> {
  try {
    const storeId = req.user?.storeId || req.query.storeId as string;
    if (!storeId) {
      res.status(400).json({ error: "storeId requis" });
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const result = await getScoreHistory(storeId, limit, offset);
    res.json(result);
  } catch (err) {
    console.error("❌ getScoreHistory:", err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
}

export async function getPublicProofsHandler(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 200);
    const proofs = await getProofChain(limit);
    res.json({ proofs, count: proofs.length });
  } catch (err) {
    console.error("❌ getPublicProofs:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
}
