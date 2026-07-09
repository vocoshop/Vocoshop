// routes/productRoutes.ts
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import authMiddleware from "../middleware/authMiddleware";
import Product from "../models/Product";

// ✅ permissions
import requirePermission from "../middleware/permissionMiddleware";
import requireAnyPermission from "../middleware/requireAnyPermission";
import { validate, addProductSchema } from "../middleware/validate";

import {
createProduct,
getProducts,
getLowStock,
getAlertCount,
getExpiringProducts,
updateProduct,
deleteProduct,
getProductsByStore,
getProductById,
getProductByBarcode,
getProductsBySupplier,
} from "../controllers/productController";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/products");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(file.originalname.toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Seules les images JPEG, PNG, WebP sont autorisées"));
  },
});

fs.mkdirSync("./uploads/products", { recursive: true });

// 🔐 Auth obligatoire pour tout le module
router.use(authMiddleware);

/* =====================================================
⚠️ ORDRE TRÈS IMPORTANT DES ROUTES
Les routes spécifiques DOIVENT être avant "/:id"
===================================================== */

/* =====================
➕ CRÉER UN PRODUIT
✅ inventory obligatoire
===================== */
router.post("/", requirePermission("inventory"), upload.single("image"), validate(addProductSchema), createProduct);

/* =====================
⚠️ STOCK FAIBLE
✅ sales OU inventory
===================== */
router.get("/low-stock", requireAnyPermission("sales", "inventory"), getLowStock);

/* =====================
🔔 COMPTE ALERTES (léger)
✅ sales OU inventory
===================== */
router.get("/alert-count", requireAnyPermission("sales", "inventory"), getAlertCount);

/* =====================
⏳ PRODUITS BIENTÔT EXPIRÉS
✅ sales OU inventory
===================== */
router.get("/expiring", requireAnyPermission("sales", "inventory"), getExpiringProducts);

/* =====================
🏬 PRODUITS PAR BOUTIQUE
✅ sales OU inventory
===================== */
router.get("/by-store/:storeId", requireAnyPermission("sales", "inventory"), getProductsByStore);

/* =====================
📦 LISTE DE TOUS LES PRODUITS
✅ sales OU inventory
===================== */
router.get("/", requireAnyPermission("sales", "inventory"), getProducts);

/* =====================
🏭 PRODUITS PAR FOURNISSEUR
⚠️ AVANT /:id
✅ sales OU inventory
===================== */
router.get("/by-supplier/:supplierId", requireAnyPermission("sales", "inventory"), getProductsBySupplier);

/* =====================
🔍 PRODUIT PAR CODE-BARRES
⚠️ AVANT /:id
✅ sales OU inventory
===================== */
router.get("/barcode/:barcode", requireAnyPermission("sales", "inventory"), getProductByBarcode);

/* =====================
📦 UN SEUL PRODUIT (ID)
⚠️ TOUJOURS EN DERNIER
✅ sales OU inventory
===================== */
router.get("/:id", requireAnyPermission("sales", "inventory"), getProductById);

/* =====================
✏️ METTRE À JOUR
✅ inventory obligatoire
===================== */
router.patch("/:id", requirePermission("inventory"), updateProduct);

/* =====================
🎙️ METTRE À JOUR LES ALIAS VOCAUX
✅ inventory obligatoire
===================== */
router.patch("/:id/aliases", requirePermission("inventory"), async (req: any, res) => {
  try {
    const storeId = req.user?.storeId;
    if (!storeId) return res.status(400).json({ error: "storeId manquant" });

    const { id } = req.params;
    const { aliases } = req.body;

    if (!Array.isArray(aliases)) {
      return res.status(400).json({ error: "aliases doit être un tableau" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, storeId },
      { $set: { aliases: aliases.map((a: string) => String(a).trim().toLowerCase()).filter(Boolean) } },
      { new: true }
    );

    if (!product) return res.status(404).json({ error: "Produit introuvable" });

    return res.json(product);
  } catch (err) {
    console.error("❌ updateAliases error:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================
🗑️ SUPPRIMER
✅ inventory obligatoire
===================== */
router.delete("/:id", requirePermission("inventory"), deleteProduct);

export default router;
