// routes/adminSupportRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import { getTickets, updateTicket, replyTicket, seedTickets } from "../controllers/adminSupportController";

const router = Router();

router.use(authMiddleware);
router.use(requireOwner);

router.get("/", getTickets);
router.patch("/:id", updateTicket);
router.post("/:id/reply", replyTicket);
router.post("/seed", seedTickets);

export default router;
