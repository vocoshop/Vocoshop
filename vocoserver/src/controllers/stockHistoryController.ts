// controllers/stockHistoryController.ts
import { Request, Response, NextFunction } from "express";
import StockHistory from "../models/StockHistory";
import InventorySession from "../models/InventorySession";
import InventoryHistory from "../models/InventoryHistory";
import Product from "../models/Product";
import { getStoreId } from "../utils/storeId";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError } from "../utils/AppError";

/* ---------------------------------------------------------
1️⃣ HISTORIQUE COMPLET D'UN MAGASIN
GET /api/stock-history
---------------------------------------------------------- */
export const listStockHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const history = await StockHistory.find({ storeId })
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
});

/* ---------------------------------------------------------
2️⃣ HISTORIQUE PAR SESSION (SÉCURISÉ)
GET /api/stock-history/by-session/:sessionId
---------------------------------------------------------- */
export const historyBySession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const { sessionId } = req.params;

const history = await StockHistory.find({
sessionId,
storeId,
})
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
});

/* ---------------------------------------------------------
3️⃣ HISTORIQUE PAR PRODUIT (SÉCURISÉ)
GET /api/stock-history/product/:productId
---------------------------------------------------------- */
export const historyByProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
const storeId = getStoreId(req);
if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const { productId } = req.params;

const history = await StockHistory.find({
productId,
storeId,
})
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
});

/* ---------------------------------------------------------
4️⃣ LISTE DES INVENTAIRES APPLIQUÉS (RÉSUMÉ PRO)
GET /api/stock-history/sessions
---------------------------------------------------------- */
export const listAppliedInventorySessions = asyncHandler(async (
req: Request,
res: Response,
next: NextFunction
) => {
const storeId = getStoreId(req);
if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const appliedSessions = await InventorySession.find({
storeId,
status: "applied",
})
.sort({ appliedAt: -1 })
.lean();

const result = await Promise.all(
appliedSessions.map(async (session) => {
const modified = await StockHistory.countDocuments({
sessionId: session._id,
storeId,
});

return {
sessionId: session._id,
appliedAt: session.appliedAt,
employeeId: session.employeeId ?? null,
modifiedProducts: modified,
};
})
);

return res.json(result);
});

/* ---------------------------------------------------------
5️⃣ DÉTAIL D’UN INVENTAIRE APPLIQUÉ (PRO)
GET /api/stock-history/session/:sessionId
---------------------------------------------------------- */
export const getAppliedInventoryDetail = asyncHandler(async (
req: Request,
res: Response,
next: NextFunction
) => {
const storeId = getStoreId(req);
if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

const { sessionId } = req.params;

const history = await StockHistory.find({
sessionId,
storeId,
})
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
});

/* ---------------------------------------------------------
6️⃣ HISTORIQUE UNIFIÉ : TOUTES LES OPÉRATIONS STOCK
GET /api/stock-history/all
Retourne les inventaires appliqués + mouvements manuels,
triés par date décroissante.
---------------------------------------------------------- */
export const listAllStockOperations = asyncHandler(async (
req: Request,
res: Response,
next: NextFunction
) => {
const storeId = getStoreId(req);
if (!storeId) {
return next(new ValidationError("storeId manquant"));
}

// 1. Récupérer les inventaires appliqués (StockHistory groupé par session)
const appliedSessions = await InventorySession.find({
storeId,
status: "applied",
})
.sort({ appliedAt: -1 })
.lean();

const inventoryOps = await Promise.all(
appliedSessions.map(async (session) => {
const count = await StockHistory.countDocuments({
sessionId: session._id,
storeId,
});
return {
id: String(session._id),
type: "inventory",
label: "Inventaire appliqué",
date: session.appliedAt || session.createdAt,
modifiedProducts: count,
employeeId: session.employeeId ?? null,
};
})
);

// 2. Récupérer les mouvements manuels (InventoryHistory)
const manualOpsRaw = await InventoryHistory.find({ storeId })
.sort({ createdAt: -1 })
.lean();

// Récupérer les noms des produits
const productIds = manualOpsRaw
.filter((m) => m.productId)
.map((m) => m.productId);
const products = await Product.find({ _id: { $in: productIds } })
.select("name")
.lean();
const productMap = new Map(products.map((p) => [String(p._id), p.name]));

const manualOps = manualOpsRaw.map((m) => ({
id: String(m._id),
type: m.type === "addition" ? "addition" : "withdrawal",
label: m.type === "addition" ? "Ajout manuel" : "Retrait manuel",
date: (m as any).createdAt || new Date(),
productName: m.productId ? productMap.get(String(m.productId)) || "Produit" : "Produit",
quantity: m.quantity,
}));

// 3. Fusionner et trier par date décroissante
const all = [...inventoryOps, ...manualOps].sort((a, b) => {
const da = new Date(a.date).getTime();
const db = new Date(b.date).getTime();
return db - da;
});

return res.json(all);
});
