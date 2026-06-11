// src/routes/orderRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requirePermission from "../middleware/permissionMiddleware";
import { validate, createOrderSchema } from "../middleware/validate";

import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  confirmOrder,
  markOrderReceived,
} from "../controllers/orderController";

const router = Router();

/**
* 🔐 ROUTES COMMANDES
* - Auth obligatoire
* - Permission "orders" obligatoire
* Base mount: /api/orders
*/
router.use(authMiddleware);
router.use(requirePermission("orders"));

/* =========================
➕ / 📄 COMMANDES
========================= */
router.post("/", validate(createOrderSchema), createOrder);
router.get("/", getOrders);

/* =========================
WORKFLOW
⚠️ DOIT ÊTRE AVANT "/:id"
========================= */
router.post("/:id/confirm", confirmOrder);
router.post("/:id/received", markOrderReceived);

/* =========================
CRUD SUR UNE COMMANDE
⚠️ toujours en bas
========================= */
router.get("/:id", getOrderById);
router.patch("/:id", updateOrder);
router.delete("/:id", deleteOrder);

export default router;
