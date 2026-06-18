import { Router } from "express";
import bcrypt from "bcryptjs";
import authMiddleware from "../middleware/authMiddleware";
import requireOwner from "../middleware/requireOwner";
import AdminManager from "../models/AdminManager";

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
    const { firstName, lastName, phone, assignedRegions, assignedCities, isActive, password } = req.body;
    const update: any = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (phone !== undefined) update.phone = phone;
    if (assignedRegions !== undefined) update.assignedRegions = assignedRegions;
    if (assignedCities !== undefined) update.assignedCities = assignedCities;
    if (isActive !== undefined) update.isActive = isActive;
    if (password) update.passwordHash = await bcrypt.hash(password, 10);

    if (!req.params.id || typeof req.params.id !== "string") {
      return res.status(400).json({ error: "ID manager invalide" });
    }
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
    const manager = await AdminManager.findByIdAndDelete(req.params.id);
    if (!manager) return res.status(404).json({ error: "Manager introuvable" });
    res.json({ success: true, message: "Admin Manager supprimé" });
  } catch (e) {
    console.error("❌ deleteManager error", e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
