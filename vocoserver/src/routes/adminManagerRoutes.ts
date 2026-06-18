import { Router } from "express";
import bcrypt from "bcryptjs";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import AdminManager from "../models/AdminManager";
import { isValidObjectId } from "../utils/helpers";

const router = Router();
router.use(authMiddleware);
router.use(requireOwner);

/* =====================================================
POST /api/admin/admin-managers — Créer un Admin Manager
===================================================== */
router.post("/admin-managers", async (req: any, res: any) => {
  try {
    const { email, password, firstName, lastName, phone, assignedRegions, assignedCities } = req.body;
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "Champs requis: email, password, firstName, lastName" });
    }

    const exists = await AdminManager.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ error: "Cet email est déjà utilisé" });

    const passwordHash = await bcrypt.hash(password, 10);
    const manager = await AdminManager.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone: phone || "",
      assignedRegions: assignedRegions || [],
      assignedCities: assignedCities || [],
    });

    res.status(201).json({
      success: true,
      manager: { id: manager._id, email: manager.email, firstName: manager.firstName, lastName: manager.lastName, phone: manager.phone, assignedRegions: manager.assignedRegions, assignedCities: manager.assignedCities, isActive: manager.isActive, createdAt: manager.createdAt },
    });
  } catch (e) {
    console.error("❌ createManager error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin/admin-managers — Liste des Admin Managers
===================================================== */
router.get("/admin-managers", async (req: any, res: any) => {
  try {
    const managers = await AdminManager.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
    res.json({ managers });
  } catch (e) {
    console.error("❌ listManagers error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
GET /api/admin/admin-managers/:id — Détail
===================================================== */
router.get("/admin-managers/:id", async (req: any, res: any) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "ID manager invalide" });
    const manager = await AdminManager.findById(req.params.id).select("-passwordHash").lean();
    if (!manager) return res.status(404).json({ error: "Manager introuvable" });
    res.json({ manager });
  } catch (e) {
    console.error("❌ getManager error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
PATCH /api/admin/admin-managers/:id — Modifier
===================================================== */
router.patch("/admin-managers/:id", async (req: any, res: any) => {
  try {
    const update: Record<string, unknown> = {};
    if (req.body.firstName !== undefined) update.firstName = "" + req.body.firstName;
    if (req.body.lastName !== undefined) update.lastName = "" + req.body.lastName;
    if (req.body.phone !== undefined) update.phone = "" + req.body.phone;
    if (req.body.assignedRegions !== undefined) update.assignedRegions = req.body.assignedRegions;
    if (req.body.assignedCities !== undefined) update.assignedCities = req.body.assignedCities;
    if (req.body.isActive !== undefined) update.isActive = req.body.isActive;
    if (req.body.password) update.passwordHash = await bcrypt.hash(String(req.body.password), 10);

    if (!req.params.id || typeof req.params.id !== "string") {
      return res.status(400).json({ error: "ID manager invalide" });
    }
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "ID manager invalide" });
    const manager = await AdminManager.findByIdAndUpdate(req.params.id, update, { new: true }).select("-passwordHash");
    if (!manager) return res.status(404).json({ error: "Manager introuvable" });
    res.json({ success: true, manager });
  } catch (e) {
    console.error("❌ updateManager error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

/* =====================================================
DELETE /api/admin/admin-managers/:id — Supprimer
===================================================== */
router.delete("/admin-managers/:id", async (req: any, res: any) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "ID manager invalide" });
    const manager = await AdminManager.findByIdAndDelete(req.params.id);
    if (!manager) return res.status(404).json({ error: "Manager introuvable" });
    res.json({ success: true, message: "Admin Manager supprimé" });
  } catch (e) {
    console.error("❌ deleteManager error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
