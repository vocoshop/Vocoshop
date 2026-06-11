import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
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

// Routes admin (même middleware — token admin = role "owner")
router.get("/admin/demandes", getAllDemandesAdmin);
router.put("/admin/demandes/:id", updateDemandeStatus);

export default router;
