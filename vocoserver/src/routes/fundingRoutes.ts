import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import {
  getScore,
  getDemandes,
  createDemande,
  getOpportunities,
  getPartners,
  getAllDemandesAdmin,
  updateDemandeStatus,
} from "../controllers/fundingController";

const router = Router();

// Route publique — pas besoin d'auth pour voir les partenaires
router.get("/partners", getPartners);

// Routes protégées (store/employee)
router.use(authMiddleware);

router.get("/score", getScore);
router.get("/opportunities", getOpportunities);
router.get("/demandes", getDemandes);
router.post("/demandes", createDemande);

// Routes admin — owner uniquement
router.get("/admin/demandes", requireOwner, getAllDemandesAdmin);
router.put("/admin/demandes/:id", requireOwner, updateDemandeStatus);

export default router;
