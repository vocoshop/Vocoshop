// src/routes/stockRoutes.ts
import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import requirePermission from "../middleware/permissionMiddleware";
import Product from "../models/Product";
import InventoryHistory from "../models/InventoryHistory";
import { PushNotificationService } from "../services/pushNotificationService";
import { isValidObjectId } from "../utils/helpers";

const router = Router();

/**
* 🔐 Toutes les routes stock protégées
* Stock = dépend de permission "inventory"
*/
router.use(authMiddleware);
router.use(requirePermission("inventory"));

/** ---------------------------------------
* HELPERS
---------------------------------------- */
function isValidYYYYMMDD(v: string) {
if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

const [y, m, d] = v.split("-").map(Number);
if (!y || !m || !d) return false;

// midi UTC => évite le décalage timezone (la veille)
const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
return (
dt.getUTCFullYear() === y &&
dt.getUTCMonth() + 1 === m &&
dt.getUTCDate() === d
);
}

function toSafeUTCDate(v: string) {
const [y, m, d] = v.split("-").map(Number);
return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
* 🟩 AJOUTER DU STOCK
* POST /api/stocks/add
* body: { productId, quantity, expirationDate? } // YYYY-MM-DD
*/
router.post("/add", async (req: any, res) => {
try {
const storeId = String(req.user?.storeId || "");
if (!storeId) return res.status(400).json({ error: "storeId manquant." });

const { productId, quantity, expirationDate } = req.body;

if (!productId || !isValidObjectId(productId)) {
return res.status(400).json({ error: "Paramètres manquants." });
}

const q = Number(quantity);
if (!Number.isFinite(q) || q <= 0) {
return res.status(400).json({ error: "Quantité invalide." });
}

// ✅ IMPORTANT : ton Product.ts utilise storeId (pas store)
const product: any = await Product.findOne({ _id: productId, storeId });
if (!product) {
return res.status(404).json({ error: "Produit introuvable" });
}

// ✅ 1) stock
product.quantity = Number(product.quantity || 0) + q;

// ✅ 2) expiration date (optionnelle)
const exp = String(expirationDate || "").trim();
if (exp) {
if (!isValidYYYYMMDD(exp)) {
return res.status(400).json({
error: "Date invalide. Format attendu YYYY-MM-DD (ex: 2026-01-31).",
});
}

const safeDate = toSafeUTCDate(exp);

if (!Array.isArray(product.expirationDates)) product.expirationDates = [];

// anti-doublon par jour
const already = product.expirationDates.some((dt: Date) => {
const isoDay = new Date(dt).toISOString().slice(0, 10);
return isoDay === exp;
});

if (!already) {
product.expirationDates.push(safeDate);
// tri croissant
product.expirationDates.sort(
(a: Date, b: Date) =>
new Date(a).getTime() - new Date(b).getTime()
);
}
}

await product.save();

await InventoryHistory.create({
storeId,
productId: product._id,
type: "addition",
quantity: q,
});

return res.json({
message: "Stock ajouté avec succès",
newQuantity: product.quantity,
product,
});
} catch (error) {
console.error("❌ addStock ERROR :", error);
return res
.status(500)
.json({ error: "Erreur serveur lors de l’ajout du stock" });
}
});

/**
* 🟥 RETIRER DU STOCK
* POST /api/stocks/remove
* body: { productId, quantity }
*/
router.post("/remove", async (req: any, res) => {
try {
const storeId = String(req.user?.storeId || "");
if (!storeId) return res.status(400).json({ error: "storeId manquant." });

const { productId, quantity } = req.body;

if (!productId || !isValidObjectId(productId)) {
return res.status(400).json({ error: "ID produit invalide." });
}
if (quantity === undefined || quantity === null) {
return res.status(400).json({ error: "Quantité requise." });
}

const q = Number(quantity);
if (!Number.isFinite(q) || q <= 0) {
return res
.status(400)
.json({ error: "La quantité à retirer doit être positive." });
}

// ✅ IMPORTANT : ton Product.ts utilise storeId
const product: any = await Product.findOne({ _id: productId, storeId });
if (!product) return res.status(404).json({ error: "Produit introuvable" });

product.quantity = Math.max(0, Number(product.quantity || 0) - q);
await product.save();

await InventoryHistory.create({
storeId,
productId: product._id,
type: "withdrawal",
quantity: q,
});

// 🔔 Alerte stock faible → push notification
const alertLevel = Number(product.alertLevel || 0);
if (alertLevel > 0 && product.quantity <= alertLevel) {
  const productName = product.name || "Produit";
  const title = `⚠️ Stock faible : ${productName}`;
  const body = `Il ne reste que ${product.quantity} unité(s) en stock (seuil: ${alertLevel}).`;
  PushNotificationService.sendToStore(storeId, title, body, {
    type: "low_stock",
    productId: String(product._id),
  }).catch(() => {});
}

return res.json({
message: "Stock retiré avec succès",
newQuantity: product.quantity,
product,
});
} catch (error) {
console.error("❌ removeStock ERROR :", error);
return res
.status(500)
.json({ error: "Erreur serveur lors du retrait du stock" });
}
});

export default router;
 