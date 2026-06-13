import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import {
  getPartners,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
} from "../controllers/partnerController";

const router = Router();
router.use(authMiddleware, requireOwner);

router.get("/partners", getPartners);
router.get("/partners/:id", getPartner);
router.post("/partners", createPartner);
router.put("/partners/:id", updatePartner);
router.delete("/partners/:id", deletePartner);

export default router;
