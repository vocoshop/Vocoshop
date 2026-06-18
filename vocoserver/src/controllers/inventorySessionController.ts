// controllers/inventorySessionController.ts
import { Request, Response } from "express";
import InventorySession from "../models/InventorySession";
import Product from "../models/Product";
import StockHistory from "../models/StockHistory";
import Order from "../models/Order";
import mongoose from "mongoose";
import { getStoreId } from "../utils/storeId";

function getEmployeeId(req: Request): string | null {
const fromToken = req?.user?.id;
if (typeof fromToken === "string" && fromToken.trim()) {
return fromToken.trim();
}

const fromBody = req?.body?.employeeId;
if (typeof fromBody === "string" && fromBody.trim()) {
return fromBody.trim();
}

return null;
}

async function applyStockToSentOrders({
storeId,
productId,
qtyAdded,
}: {
storeId: string;
productId: string;
qtyAdded: number;
}) {
let remaining = Number(qtyAdded) || 0;
if (!storeId || !productId || remaining <= 0) return;

const productObjectId = new mongoose.Types.ObjectId(productId);

// ✅ On accepte UNIQUEMENT le statut backend standard
const orders: any[] = await Order.find({
storeId: String(storeId),
status: "sent",
}).sort({ createdAt: 1 });

for (const o of orders) {
if (remaining <= 0) break;

let touched = false;

for (const it of o.items || []) {
if (remaining <= 0) break;

if (
it.productId &&
new mongoose.Types.ObjectId(it.productId).equals(productObjectId)
) {
const ordered = Number(it.quantity) || 0;
const received = Number(it.receivedQty) || 0;
const stillNeeded = Math.max(0, ordered - received);

if (stillNeeded > 0) {
const give = Math.min(stillNeeded, remaining);
it.receivedQty = received + give;
remaining -= give;
touched = true;
}
}
}

if (touched) {
const allReceived = o.items.every(
(x: any) =>
(Number(x.receivedQty) || 0) >= (Number(x.quantity) || 0)
);

if (allReceived) {
o.status = "received";
o.receivedAt = new Date();
}

await o.save();
}
}
}
/* ---------------------------------------------------------
1️⃣ DÉMARRER OU RÉCUPÉRER UNE SESSION D’INVENTAIRE (EMPLOYÉ)
POST /api/inventory/session/start
---------------------------------------------------------- */
export const startInventorySession = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
const employeeId = getEmployeeId(req);

if (!storeId) return res.status(400).json({ error: "storeId manquant" });
if (!employeeId) return res.status(400).json({ error: "employeeId manquant" });

let session = await InventorySession.findOne({
storeId,
employeeId,
status: "draft",
});

if (!session) {
session = await InventorySession.create({
storeId,
employeeId,
status: "draft",
lines: [],
});
}

return res.json({ sessionId: session._id, status: session.status });
} catch (err) {
console.error("❌ startInventorySession error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
2️⃣ AJOUTER / MODIFIER UNE LIGNE D’INVENTAIRE (EMPLOYÉ)
POST /api/inventory/session/:sessionId/add-line
---------------------------------------------------------- */
export const addInventoryLine = async (req: Request, res: Response) => {
try {
const { sessionId } = req.params;
const { productId, countedQuantity } = req.body;

if (!productId || !mongoose.Types.ObjectId.isValid(productId) || countedQuantity == null) {
return res.status(400).json({ error: "productId et countedQuantity nécessaires" });
}

if (!mongoose.Types.ObjectId.isValid(sessionId)) {
return res.status(400).json({ error: "Session invalide" });
}

const session = await InventorySession.findById(sessionId);
if (!session) return res.status(404).json({ error: "Session introuvable" });

// Sécurité : éviter d’écrire dans une session non draft
if (session.status !== "draft") {
return res.status(400).json({ error: "Session non modifiable (déjà validée/appliquée)." });
}

const product = await Product.findById(productId).select("name category");
if (!product) return res.status(404).json({ error: "Produit introuvable" });

const existingLine = session.lines.find(
(line: any) => String(line.productId) === String(productId)
);

if (existingLine) {
existingLine.countedQuantity = Number(countedQuantity);
} else {
session.lines.push({
productId,
countedQuantity: Number(countedQuantity),
productName: product.name,
category: product.category,
} as any);
}

await session.save();
return res.json({ message: "Ligne enregistrée", session });
} catch (err) {
console.error("❌ addInventoryLine error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
3️⃣ VALIDER LA SESSION (EMPLOYÉ)
POST /api/inventory/session/:sessionId/validate
---------------------------------------------------------- */
export const validateInventorySession = async (req: Request, res: Response) => {
try {
const { sessionId } = req.params;

const session = await InventorySession.findById(sessionId)
.populate("lines.productId", "name category quantity")
.lean();

if (!session) return res.status(404).json({ error: "Session introuvable" });

await InventorySession.findByIdAndUpdate(sessionId, {
status: "validated",
completedAt: new Date(),
});

return res.json({ message: "Inventaire terminé", session });
} catch (err) {
console.error("❌ validateInventorySession error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
✅ 3bis) DISCARD / ANNULER LA SESSION (EMPLOYÉ)
POST /api/inventory/session/:sessionId/discard
- supprime la session draft => plus de “1 produit compté” après annulation
---------------------------------------------------------- */
export const discardInventorySession = async (req: Request, res: Response) => {
try {
const { sessionId } = req.params;

const storeId = getStoreId(req);
const employeeId = (req as any).user?.id;

if (!storeId) return res.status(400).json({ error: "storeId manquant" });
if (!employeeId) return res.status(400).json({ error: "employeeId manquant" });
if (!sessionId) return res.status(400).json({ error: "sessionId manquant" });

const session = await InventorySession.findById(sessionId).lean();
if (!session) return res.status(404).json({ error: "Session introuvable" });

// sécurité : doit appartenir à la boutique & employé
if (String((session as any).storeId) !== String(storeId)) {
return res.status(403).json({ error: "Accès refusé (store)" });
}
if (String((session as any).employeeId) !== String(employeeId)) {
return res.status(403).json({ error: "Accès refusé (employee)" });
}

// on ne discard que les drafts
if ((session as any).status !== "draft") {
return res.status(400).json({ error: "Impossible d’annuler une session non-draft." });
}

// ✅ Option 1 (recommandée) : supprimer la session draft
await InventorySession.deleteOne({ _id: sessionId });

return res.json({ ok: true, message: "Session annulée" });
} catch (err) {
console.error("❌ discardInventorySession error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
4️⃣ VOIR UNE SESSION (DÉTAIL COMPLET)
GET /api/inventory/session/:sessionId
---------------------------------------------------------- */
export const getInventorySession = async (req: Request, res: Response) => {
try {
const { sessionId } = req.params;

const session = await InventorySession.findById(sessionId).populate(
"lines.productId",
"name category quantity"
);

if (!session) return res.status(404).json({ error: "Session introuvable" });
return res.json(session);
} catch (err) {
console.error("❌ getInventorySession error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
5️⃣ LISTE DES SESSIONS (PATRON)
GET /api/inventory/sessions
---------------------------------------------------------- */
export const listInventorySessions = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const sessions = await InventorySession.find({ storeId })
.sort({ createdAt: -1 })
.lean();

return res.json(sessions);
} catch (err) {
console.error("❌ listInventorySessions error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
6️⃣ ANALYSE DES ÉCARTS (PATRON)
GET /api/inventory/session/:sessionId/analyze
---------------------------------------------------------- */
export const analyzeInventorySession = async (req: Request, res: Response) => {
try {
const { sessionId } = req.params;

const session = await InventorySession.findById(sessionId).lean();
if (!session) return res.status(404).json({ error: "Session introuvable" });

const productIds = (session.lines || []).map((l: any) => l.productId);
const products = await Product.find({ _id: { $in: productIds } })
.select("name category quantity")
.lean();

const productMap = new Map<string, any>();
for (const p of products) productMap.set(String(p._id), p);

const analysis = (session.lines || [])
.map((line: any) => {
const product = productMap.get(String(line.productId));
if (!product) return null;

const stockQuantity = Number(product.quantity ?? 0);
const countedQuantity = Number(line.countedQuantity ?? 0);

return {
productId: product._id,
name: product.name,
category: product.category ?? line.category,
stockQuantity,
countedQuantity,
diff: countedQuantity - stockQuantity,
};
})
.filter(Boolean);

return res.json({ sessionId, analysis });
} catch (err) {
console.error("❌ analyzeInventorySession error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
7️⃣ APPLIQUER STOCK + HISTORIQUE (PATRON)
POST /api/inventory/session/:sessionId/apply
---------------------------------------------------------- */
export const applyInventorySession = async (req: Request, res: Response) => {
try {
const { sessionId } = req.params;
const userId = (req as any).user?.id || null;

const session = await InventorySession.findById(sessionId).populate(
"lines.productId",
"name category quantity"
);

if (!session) return res.status(404).json({ error: "Session introuvable" });

if (session.status === "applied") {
return res
.status(400)
.json({ error: "Cet inventaire a déjà été appliqué au stock." });
}

const s: any = session;

for (const line of s.lines) {

const product = line.productId as any;
if (!product) continue;

const productDoc = await Product.findById(product._id).select("quantity");
const before = Number(productDoc?.quantity ?? 0);

const counted =
typeof line.countedQuantity === "number" && !isNaN(line.countedQuantity)
? Number(line.countedQuantity)
: null;

if (counted === null) continue;

const diff = counted - before;

await Product.findByIdAndUpdate(product._id, { quantity: counted });

/* =====================================================
🔥 LOGIQUE HYBRIDE COMMANDES
===================================================== */
if (diff > 0) {
await applyStockToSentOrders({
storeId: String(s.storeId),
productId: String(product._id),
qtyAdded: diff,
});
}

/* =====================================================
📝 HISTORIQUE STOCK
===================================================== */
await StockHistory.create({
storeId: s.storeId,
sessionId: s._id,
productId: product._id,
productName: product.name,
category: product.category,
previousQuantity: before,
newQuantity: counted,
diff,
appliedAt: new Date(),
validatedBy: userId,
});
}

s.status = "applied";
s.appliedAt = new Date();
await s.save();

return res.json({
message: "Inventaire appliqué au stock avec succès",
sessionId,
appliedAt: s.appliedAt,
});

} catch (err) {
console.error("❌ applyInventorySession error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
8️⃣ HISTORIQUE EMPLOYÉ (SES SESSIONS)
GET /api/inventory/my-sessions
---------------------------------------------------------- */
export const listEmployeeInventorySessions = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
const employeeId = getEmployeeId(req);

if (!storeId) return res.status(400).json({ error: "storeId manquant" });
if (!employeeId) return res.status(400).json({ error: "employeeId manquant" });

const sessions = await InventorySession.find({ storeId, employeeId })
.sort({ createdAt: -1 })
.lean();

return res.json(sessions);
} catch (err) {
console.error("❌ listEmployeeInventorySessions error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
9️⃣ HISTORIQUE DÉTAILLÉ D’UNE SESSION APPLIQUÉE (PATRON)
GET /api/inventory/session/:sessionId/history
---------------------------------------------------------- */
export const getInventoryAppliedHistory = async (req: Request, res: Response) => {
try {
const { sessionId } = req.params;

const session = await InventorySession.findById(sessionId).select("_id").lean();
if (!session) return res.status(404).json({ error: "Session introuvable" });

const history = await StockHistory.find({ sessionId })
.sort({ appliedAt: -1 })
.lean();

return res.json({ sessionId, history });
} catch (err) {
console.error("❌ getInventoryAppliedHistory error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* ---------------------------------------------------------
🔟 LISTE DES INVENTAIRES APPLIQUÉS (PATRON)
GET /api/inventory/applied-sessions
---------------------------------------------------------- */
export const listAppliedInventorySessions = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const sessions = await InventorySession.find({ storeId, status: "applied" })
.sort({ appliedAt: -1 })
.lean();

const list = await Promise.all(
sessions.map(async (s: any) => {
const count = await StockHistory.countDocuments({ sessionId: String(s._id) });
return {
sessionId: s._id,
appliedAt: s.appliedAt,
modifiedProducts: count,
};
})
);

return res.json(list);
} catch (err) {
console.error("❌ listAppliedInventorySessions error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
