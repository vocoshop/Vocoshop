import { Router, Request, Response } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import { getProofChain } from "../services/blockchainAnchorService";

const router = Router();
router.use(authMiddleware);
router.use(requireOwner);

router.get("/proofs", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const proofs = await getProofChain(limit);
    return res.json({ proofs, count: proofs.length });
  } catch (err) {
    console.error("❌ admin blockchain proofs:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
