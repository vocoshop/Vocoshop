// controllers/stockHistoryController.ts
import { Request, Response } from "express";
import StockHistory from "../models/StockHistory";
import InventorySession from "../models/InventorySession";
import { getStoreId } from "../utils/storeId";

/* ---------------------------------------------------------
1️⃣ HISTORIQUE COMPLET D'UN MAGASIN
GET /api/stock-history
---------------------------------------------------------- */
export const listStockHistory = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) {
return res.status(400).json({ error: "storeId manquant" });
}

const history = await StockHistory.find({ storeId })
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
} catch (err) {
console.error("❌ listStockHistory error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
2️⃣ HISTORIQUE PAR SESSION (SÉCURISÉ)
GET /api/stock-history/by-session/:sessionId
---------------------------------------------------------- */
export const historyBySession = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) {
return res.status(400).json({ error: "storeId manquant" });
}

const { sessionId } = req.params;

const history = await StockHistory.find({
sessionId,
storeId,
})
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
} catch (err) {
console.error("❌ historyBySession error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
3️⃣ HISTORIQUE PAR PRODUIT (SÉCURISÉ)
GET /api/stock-history/product/:productId
---------------------------------------------------------- */
export const historyByProduct = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) {
return res.status(400).json({ error: "storeId manquant" });
}

const { productId } = req.params;

const history = await StockHistory.find({
productId,
storeId,
})
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
} catch (err) {
console.error("❌ historyByProduct error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
4️⃣ LISTE DES INVENTAIRES APPLIQUÉS (RÉSUMÉ PRO)
GET /api/stock-history/sessions
---------------------------------------------------------- */
export const listAppliedInventorySessions = async (
req: Request,
res: Response
) => {
try {
const storeId = getStoreId(req);
if (!storeId) {
return res.status(400).json({ error: "storeId manquant" });
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
} catch (err) {
console.error("❌ listAppliedInventorySessions error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
5️⃣ DÉTAIL D’UN INVENTAIRE APPLIQUÉ (PRO)
GET /api/stock-history/session/:sessionId
---------------------------------------------------------- */
export const getAppliedInventoryDetail = async (
req: Request,
res: Response
) => {
try {
const storeId = getStoreId(req);
if (!storeId) {
return res.status(400).json({ error: "storeId manquant" });
}

const { sessionId } = req.params;

const history = await StockHistory.find({
sessionId,
storeId,
})
.sort({ appliedAt: -1 })
.lean();

return res.json(history);
} catch (err) {
console.error("❌ getAppliedInventoryDetail error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
