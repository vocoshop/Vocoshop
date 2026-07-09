// controllers/stockHistoryController.ts
import { Request, Response, NextFunction } from "express";
import StockHistory from "../models/StockHistory";
import InventorySession from "../models/InventorySession";
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
