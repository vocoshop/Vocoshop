// routes/supplierRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requireAnyPermission from "../middleware/requireAnyPermission";

import {
createSupplier,
getSuppliers,
getSupplierById,
updateSupplier,
deleteSupplier,
getSupplierDashboard,
} from "../controllers/supplierController";

const router = Router();

/**
* 🔐 ROUTES FOURNISSEURS
* - Auth obligatoire
* - Permission "orders" OU "sales"
* Base mount: /api/suppliers
*/
router.use(authMiddleware);
router.use(requireAnyPermission("orders", "sales"));

/* =====================
➕ CRÉER UN FOURNISSEUR
===================== */
router.post("/", createSupplier);

/* =====================
📦 LISTE DES FOURNISSEURS
===================== */
router.get("/", getSuppliers);

/* =====================
📊 TABLEAU DE BORD
===================== */
router.get("/dashboard", getSupplierDashboard);

/* =====================
📄 DÉTAIL FOURNISSEUR
===================== */
router.get("/:id", getSupplierById);

/* =====================
✏️ METTRE À JOUR
===================== */
router.patch("/:id", updateSupplier);

/* =====================
🗑️ SUPPRIMER
===================== */
router.delete("/:id", deleteSupplier);

export default router;
