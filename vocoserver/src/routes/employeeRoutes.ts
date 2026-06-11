// routes/employeeRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requirePermission from "../middleware/permissionMiddleware";

import {
acceptEmployeeInvite,
createEmployee,
listEmployees,
updateEmployee,
toggleEmployee,
deleteEmployee,
} from "../controllers/employeeController";

const router = Router();

/* =====================================================
🔓 ROUTE PUBLIQUE
- Activation du compte employé via lien
===================================================== */
router.get("/accept", acceptEmployeeInvite);

/* =====================================================
🔐 ROUTES PROTÉGÉES
- Auth obligatoire
- Permission "employees" obligatoire
===================================================== */
router.use(authMiddleware);
router.use(requirePermission("employees"));

/* =====================================================
👥 GESTION DES EMPLOYÉS
===================================================== */
router.get("/", listEmployees); // voir la liste
router.post("/", createEmployee); // créer un employé
router.patch("/:id", updateEmployee); // modifier permissions / nom
router.patch("/:id/toggle", toggleEmployee); // activer / désactiver
router.delete("/:id", deleteEmployee); // suppression logique

export default router;
