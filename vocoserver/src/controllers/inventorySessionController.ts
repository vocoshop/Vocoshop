// controllers/inventorySessionController.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import InventorySession from "../models/InventorySession";
import Product from "../models/Product";
import StockHistory from "../models/StockHistory";
import Order from "../models/Order";
import User from "../models/User";
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
export const startInventorySession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
const employeeId = getEmployeeId(req);

if (!storeId) return next(new ValidationError("storeId manquant"));
if (!employeeId) return next(new ValidationError("employeeId manquant"));

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
});

/* ---------------------------------------------------------
2️⃣ AJOUTER / MODIFIER UNE LIGNE D’INVENTAIRE (EMPLOYÉ)
POST /api/inventory/session/:sessionId/add-line
---------------------------------------------------------- */
export const addInventoryLine = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { sessionId } = req.params;
const { productId, countedQuantity } = req.body;
const employeeId = getEmployeeId(req);

if (!productId || !mongoose.Types.ObjectId.isValid(productId) || countedQuantity == null) {
return next(new ValidationError("productId et countedQuantity nécessaires"));
}

if (!employeeId) return next(new ValidationError("employeeId manquant"));

if (!mongoose.Types.ObjectId.isValid(sessionId)) {
return next(new ValidationError("Session invalide"));
}

const session = await InventorySession.findById(sessionId);
if (!session) return next(new NotFoundError("Session introuvable"));

// Sécurité : éviter d’écrire dans une session non draft
if (session.status !== "draft") {
return next(new ValidationError("Session non modifiable (déjà validée/appliquée)."));
}

const product = await Product.findById(productId).select("name category");
if (!product) return next(new NotFoundError("Produit introuvable"));

// Récupérer le nom de l'employé
let countedByName = "Employé";
if (mongoose.Types.ObjectId.isValid(employeeId)) {
const employeeUser = await User.findById(employeeId).select("name").lean();
if (employeeUser && (employeeUser as any).name) countedByName = (employeeUser as any).name;
}

const existingLine = session.lines.find(
(line: any) => String(line.productId) === String(productId)
);

if (existingLine) {
existingLine.countedQuantity = Number(countedQuantity);
if (mongoose.Types.ObjectId.isValid(employeeId)) {
existingLine.countedBy = new mongoose.Types.ObjectId(employeeId);
existingLine.countedByName = countedByName;
}
} else {
const line: any = {
productId,
countedQuantity: Number(countedQuantity),
productName: product.name,
category: product.category,
countedByName,
};
if (mongoose.Types.ObjectId.isValid(employeeId)) {
line.countedBy = new mongoose.Types.ObjectId(employeeId);
}
session.lines.push(line);
}

await session.save();
return res.json({ message: "Ligne enregistrée", session });
});

/* ---------------------------------------------------------
3️⃣ VALIDER LA SESSION (EMPLOYÉ)
POST /api/inventory/session/:sessionId/validate
---------------------------------------------------------- */
export const validateInventorySession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { sessionId } = req.params;

if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
return next(new ValidationError("Session invalide"));
}

const session = await InventorySession.findById(sessionId)
.populate("lines.productId", "name category quantity")
.lean();

if (!session) return next(new NotFoundError("Session introuvable"));

await InventorySession.findByIdAndUpdate(sessionId, {
status: "validated",
completedAt: new Date(),
});

return res.json({ message: "Inventaire terminé", session });
});

/* ---------------------------------------------------------
✅ 3bis) DISCARD / ANNULER LA SESSION (EMPLOYÉ)
POST /api/inventory/session/:sessionId/discard
- supprime la session draft => plus de “1 produit compté” après annulation
---------------------------------------------------------- */
export const discardInventorySession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { sessionId } = req.params;

const storeId = getStoreId(req);
const employeeId = (req as any).user?.id;

if (!storeId) return next(new ValidationError("storeId manquant"));
if (!employeeId) return next(new ValidationError("employeeId manquant"));
if (!sessionId) return next(new ValidationError("sessionId manquant"));

if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
return next(new ValidationError("Session invalide"));
}

const session = await InventorySession.findById(sessionId).lean();
if (!session) return next(new NotFoundError("Session introuvable"));

// sécurité : doit appartenir à la boutique & employé
if (String((session as any).storeId) !== String(storeId)) {
return next(new ForbiddenError("Accès refusé (store)"));
}
if (String((session as any).employeeId) !== String(employeeId)) {
return next(new ForbiddenError("Accès refusé (employee)"));
}

// on ne discard que les drafts
if ((session as any).status !== "draft") {
return next(new ValidationError("Impossible d’annuler une session non-draft."));
}

// ✅ Option 1 (recommandée) : supprimer la session draft
await InventorySession.deleteOne({ _id: sessionId });

return res.json({ ok: true, message: "Session annulée" });
});

/* ---------------------------------------------------------
4️⃣ VOIR UNE SESSION (DÉTAIL COMPLET)
GET /api/inventory/session/:sessionId
---------------------------------------------------------- */
export const getInventorySession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { sessionId } = req.params;

if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
return next(new ValidationError("Session invalide"));
}

const session = await InventorySession.findById(sessionId)
.populate("lines.productId", "name category quantity");

if (!session) return next(new NotFoundError("Session introuvable"));
return res.json(session);
});

/* ---------------------------------------------------------
5️⃣ LISTE DES SESSIONS (PATRON)
GET /api/inventory/sessions
---------------------------------------------------------- */
export const listInventorySessions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const sessions = await InventorySession.find({ storeId })
.sort({ createdAt: -1 })
.lean();

return res.json(sessions);
});

/* ---------------------------------------------------------
6️⃣ ANALYSE DES ÉCARTS (PATRON)
GET /api/inventory/session/:sessionId/analyze
---------------------------------------------------------- */
export const analyzeInventorySession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { sessionId } = req.params;

if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
return next(new ValidationError("Session invalide"));
}

const session = await InventorySession.findById(sessionId).lean();
if (!session) return next(new NotFoundError("Session introuvable"));

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
countedBy: line.countedBy,
countedByName: line.countedByName,
};
})
.filter(Boolean);

return res.json({ sessionId, analysis });
});

/* ---------------------------------------------------------
7️⃣ APPLIQUER STOCK + HISTORIQUE (PATRON)
POST /api/inventory/session/:sessionId/apply
---------------------------------------------------------- */
export const applyInventorySession = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { sessionId } = req.params;
const userId = (req as any).user?.id || null;

const session = await InventorySession.findById(sessionId).populate(
"lines.productId",
"name category quantity"
);

if (!session) return next(new NotFoundError("Session introuvable"));

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

});

/* ---------------------------------------------------------
8️⃣ HISTORIQUE EMPLOYÉ (SES SESSIONS)
GET /api/inventory/my-sessions
---------------------------------------------------------- */
export const listEmployeeInventorySessions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
const employeeId = getEmployeeId(req);

if (!storeId) return next(new ValidationError("storeId manquant"));
if (!employeeId) return next(new ValidationError("employeeId manquant"));

const sessions = await InventorySession.find({ storeId, employeeId })
.sort({ createdAt: -1 })
.lean();

return res.json(sessions);
});

/* ---------------------------------------------------------
9️⃣ HISTORIQUE DÉTAILLÉ D’UNE SESSION APPLIQUÉE (PATRON)
GET /api/inventory/session/:sessionId/history
---------------------------------------------------------- */
export const getInventoryAppliedHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { sessionId } = req.params;

const session = await InventorySession.findById(sessionId).select("_id").lean();
if (!session) return next(new NotFoundError("Session introuvable"));

const history = await StockHistory.find({ sessionId })
.sort({ appliedAt: -1 })
.lean();

return res.json({ sessionId, history });
});

/* ---------------------------------------------------------
🔟 LISTE DES INVENTAIRES APPLIQUÉS (PATRON)
GET /api/inventory/applied-sessions
---------------------------------------------------------- */
export const listAppliedInventorySessions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

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
});

/* ---------------------------------------------------------
🔄 CONSOLIDATED — toutes les lignes de toutes les sessions
GET /api/inventory/consolidated
→ retourne toutes les lignes de toutes les sessions (draft+validated)
  avec countedByName pour savoir qui a compté quoi
---------------------------------------------------------- */
export const getConsolidatedInventory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const sessions = await InventorySession.find({
storeId,
status: { $in: ["draft", "validated"] },
})
.lean();

// Lookup employee names
const allEmployeeIds = [...new Set(sessions.map(s => String((s as any).employeeId || "")))]
  .filter(Boolean);
const employeeUsers = await User.find({ _id: { $in: allEmployeeIds } })
  .select("name")
  .lean();
const employeeNameMap = new Map<string, string>();
for (const u of employeeUsers) employeeNameMap.set(String(u._id), (u as any).name || "Employé");

const allProductIds: any[] = [];
for (const s of sessions) {
for (const line of (s as any).lines || []) {
if (line.productId) allProductIds.push(line.productId);
}
}

const products = await Product.find({ _id: { $in: allProductIds } })
.select("name category quantity")
.lean();
const productMap = new Map<string, any>();
for (const p of products) productMap.set(String(p._id), p);

const lines: any[] = [];

for (const s of sessions) {
const employeeName = employeeNameMap.get(String((s as any).employeeId)) || "Employé";

for (const line of (s as any).lines || []) {
const product = productMap.get(String(line.productId));
const stockQuantity = Number(product?.quantity ?? 0);
const countedQuantity = Number(line.countedQuantity ?? 0);

lines.push({
sessionId: s._id,
sessionStatus: s.status,
productId: line.productId,
productName: line.productName || product?.name || "Produit",
category: line.category || product?.category,
stockQuantity,
countedQuantity,
diff: countedQuantity - stockQuantity,
countedBy: line.countedBy,
countedByName: line.countedByName || employeeName,
});
}
}

return res.json({ lines, sessionCount: sessions.length });
});
