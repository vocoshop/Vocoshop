import { Router } from "express";
import requireManager from "../middleware/requireManager";
import SupportTicket from "../models/SupportTicket";
import { getTickets, updateTicket, replyTicket } from "../controllers/adminSupportController";

const router = Router();

router.use(requireManager);

router.get("/", getTickets);

router.patch("/:id", updateTicket);

router.post("/:id/reply", replyTicket);

export default router;
