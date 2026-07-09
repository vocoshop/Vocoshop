// controllers/productController.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import Product from "../models/Product";
import { createNotification } from "../services/notificationEngine";
import { getStoreId } from "../utils/storeId";
import { isValidObjectId } from "../utils/helpers";

/* -------------------------------------------------------
🗓 Safe Date Parse
------------------------------------------------------- */
function parseDate(v: any): Date | null {
if (!v) return null;

// si déjà une Date
if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

const s = String(v).trim();
if (!s) return null;

// ✅ format YYYY-MM-DD (recommandé)
if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
const [y, m, d] = s.split("-").map(Number);
const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // midi UTC = anti décalage
return Number.isNaN(dt.getTime()) ? null : dt;
}

// ✅ format DD/MM/YYYY (si ton CreateProduct envoie ça)
if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
const [dd, mm, yyyy] = s.split("/").map(Number);
const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
return Number.isNaN(dt.getTime()) ? null : dt;
}

// fallback natif
const d = new Date(s);
return Number.isNaN(d.getTime()) ? null : d;
}

/* -------------------------------------------------------
🧮 Nearest expiry date within a range
------------------------------------------------------- */
function getNearestDateInRange(dates: any[], start: Date, end: Date): Date | null {
if (!Array.isArray(dates) || dates.length === 0) return null;

const list = dates
.map((x) => new Date(x))
.filter((d) => !isNaN(d.getTime()) && d >= start && d <= end)
.sort((a, b) => a.getTime() - b.getTime());

return list.length ? list[0] : null;
}

/* -------------------------------------------------------
➕ CREATE PRODUCT
POST /products
------------------------------------------------------- */
export const createProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);

if (!storeId) return next(new ValidationError("storeId manquant"));

const {
  name,
  category,
  sellPrice,
  price, // compat ancien champ
  purchasePrice,
  quantity,
  alertLevel,
  barcode,
  expirationDate,
  supplierId,
} = req.body;

if (!name || String(name).trim() === "") {
return next(new ValidationError("Le nom du produit est obligatoire"));
}

// 🔄 Harmonisation prix
const finalSellPrice =
sellPrice !== undefined
? Number(sellPrice)
: price !== undefined
? Number(price)
: 0;

// ✅ accepte plusieurs noms possibles venant du front
const expRaw =
req.body?.expirationDate ??
req.body?.expiryDate ??
req.body?.dateExpiration ??
(Array.isArray(req.body?.expirationDates) ? req.body.expirationDates[0] : undefined);

const parsedDate = parseDate(expRaw);

const product = await Product.create({
storeId,
name: String(name).trim(),
category: category ?? "",
sellPrice: Number(finalSellPrice) || 0,
purchasePrice: Number(purchasePrice) || 0,
quantity: Number(quantity) || 0,
alertLevel: Number(alertLevel) || 3,
barcode: barcode ?? undefined,
supplierId: supplierId ?? undefined,
expirationDates: parsedDate ? [parsedDate] : [],
});

if (req.file) {
product.imageUrl = `/uploads/products/${req.file.filename}`;
await product.save();
}

// ✅ si une date est fournie, on l’ajoute
if (expirationDate) {
const parsed = parseDate(expirationDate); // <- même helper (copie-le dans stockRoutes OU mets-le dans un utils)
if (!parsed) return next(new ValidationError("Date invalide. Format YYYY-MM-DD."));

product.expirationDates = Array.isArray(product.expirationDates) ? product.expirationDates : [];

const isoDay = parsed.toISOString().slice(0, 10);
const exists = product.expirationDates.some((d: any) => {
const dt = new Date(d);
return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === isoDay;
});

if (!exists) product.expirationDates.push(parsed);
}

return res.status(201).json(product);
});

/* -------------------------------------------------------
📦 GET ALL PRODUCTS
GET /products?search=&page=&limit=
------------------------------------------------------- */
export const getProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const search = String(req.query.search || "");
const page = Math.max(Number(req.query.page) || 1, 1);
const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

const filter: any = { storeId };

  if (search.trim() !== "") {
    const es = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: es, $options: "i" } },
      { barcode: { $regex: es, $options: "i" } },
    ];
  }

const total = await Product.countDocuments(filter);

const products = await Product.find(filter)
.sort({ createdAt: -1 })
.skip((page - 1) * limit)
.limit(limit)
.lean();

return res.json({
page,
limit,
total,
totalPages: Math.ceil(total / limit),
products,
});
});

/* -------------------------------------------------------
🏭 PRODUITS PAR FOURNISSEUR
GET /products/by-supplier/:supplierId
------------------------------------------------------- */
export const getProductsBySupplier = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const { supplierId } = req.params;
if (!supplierId) return next(new ValidationError("supplierId manquant"));

const products = await Product.find({ storeId, supplierId }).sort({ name: 1 }).lean();

return res.json(products);
});

/* -------------------------------------------------------
⚠️ LOW STOCK
GET /products/low-stock
------------------------------------------------------- */
export const getLowStock = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

const products = await Product.find({
storeId,
$expr: { $lte: ["$quantity", "$alertLevel"] },
})
.sort({ quantity: 1 })
.limit(limit)
.lean();

return res.json(products);
});

/* -------------------------------------------------------
🔔 NOMBRE DE PRODUITS EN ALERTE (léger)
GET /products/alert-count
------------------------------------------------------- */
export const getAlertCount = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const count = await Product.countDocuments({
storeId,
$expr: { $lte: ["$quantity", "$alertLevel"] },
});

return res.json({ count });
});

/* -------------------------------------------------------
🔥 PRODUITS BIENTÔT EXPIRÉS
GET /products/expiring?days=7&limit=50
------------------------------------------------------- */
export const getExpiringProducts = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);
const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const limitDate = new Date(today);
limitDate.setDate(today.getDate() + days);

const products: any[] = await Product.find({
storeId,
expirationDates: { $elemMatch: { $gte: today, $lte: limitDate } },
}).lean();

const enriched = products
.map((p) => {
const nearest = getNearestDateInRange(p.expirationDates, today, limitDate);
return { ...p, nearestExpiry: nearest ? nearest.toISOString() : null };
})
.filter((p) => p.nearestExpiry)
.sort(
(a, b) =>
new Date(a.nearestExpiry).getTime() - new Date(b.nearestExpiry).getTime()
)
.slice(0, limit);

return res.json(enriched);
});

/* -------------------------------------------------------
✏️ UPDATE PRODUCT
PATCH /products/:id
------------------------------------------------------- */
export const updateProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID produit invalide"));
const product: any = await Product.findOne({ _id: id, storeId });
if (!product) return next(new NotFoundError("Produit introuvable"));

const {
  name,
  category,
  sellPrice,
  price,
  purchasePrice,
  quantity,
  alertLevel,
  barcode,
  expirationDate,
  aliases,
  supplierId,
} = req.body;

if (name !== undefined) product.name = String(name);
if (category !== undefined) product.category = category;

if (sellPrice !== undefined) product.sellPrice = Number(sellPrice);
else if (price !== undefined) product.sellPrice = Number(price);

if (purchasePrice !== undefined) product.purchasePrice = Number(purchasePrice);

if (quantity !== undefined) product.quantity = Number(quantity);
if (alertLevel !== undefined) product.alertLevel = Number(alertLevel);
if (barcode !== undefined) product.barcode = barcode;
if (aliases !== undefined) product.aliases = Array.isArray(aliases) ? aliases : [];

if (expirationDate !== undefined) {
const parsed = parseDate(expirationDate);
if (parsed) {
product.expirationDates = Array.isArray(product.expirationDates)
? product.expirationDates
: [];
product.expirationDates.push(parsed);
}
}

if (supplierId !== undefined) {
product.supplierId = supplierId === null || supplierId === "" ? null : supplierId;
}

await product.save();

/* =====================================================
🔔 NOTIFICATION STOCK FAIBLE (SMART ENGINE)
===================================================== */
if (product.quantity <= product.alertLevel) {
await createNotification({
storeId,
title: "Stock faible",
message: `${product.name} est presque en rupture.`,
type: "stock_low",
uniqueKey: `stock_low_${product._id}`,
});
}

/* =====================================================
🔔 NOTIFICATION PRODUIT BIENTÔT EXPIRÉ
===================================================== */

if (product.expirationDates?.length) {

const now = new Date();
const limit = new Date();
limit.setDate(now.getDate() + 7); // 7 jours avant

const isExpiringSoon = product.expirationDates.some((d: any) => {
const date = new Date(d);
return date >= now && date <= limit;
});

if (isExpiringSoon) {
await createNotification({
storeId,
title: "Produit bientôt expiré",
message: `${product.name} arrive bientôt à expiration.`,
type: "product_expiring",
uniqueKey: `expiring_${product._id}`,
});
}
}

return res.json(product);
});

/* -------------------------------------------------------
🗑 DELETE PRODUCT
------------------------------------------------------- */
export const deleteProduct = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID produit invalide"));
const deleted = await Product.findOneAndDelete({ _id: id, storeId });

if (!deleted) return next(new NotFoundError("Produit introuvable"));

return res.json({ message: "Produit supprimé" });
});

/* -------------------------------------------------------
🔍 GET PRODUCT BY ID
------------------------------------------------------- */
export const getProductById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req as any);
if (!storeId) return next(new ValidationError("storeId manquant"));

const { id } = req.params;
if (!isValidObjectId(id)) return next(new ValidationError("ID produit invalide"));
const product = await Product.findOne({ _id: id, storeId }).lean();

if (!product) return next(new NotFoundError("Produit introuvable"));

return res.json(product);
});

/* -------------------------------------------------------
🔍 GET PRODUCT BY BARCODE
GET /products/barcode/:barcode
------------------------------------------------------- */
export const getProductByBarcode = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const storeId = getStoreId(req as any);
    if (!storeId) return next(new ValidationError("storeId manquant"));

    const { barcode } = req.params;
    if (!barcode || String(barcode).trim() === "") {
      return next(new ValidationError("Code-barres requis"));
    }

    const product = await Product.findOne({ storeId, barcode: String(barcode).trim() }).lean();

    if (!product) return next(new NotFoundError("Aucun produit trouvé avec ce code-barres"));

    return res.json(product);
  });

/* -------------------------------------------------------
🏪 GET PRODUCTS BY STORE
------------------------------------------------------- */
export const getProductsByStore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { storeId } = req.params;
if (!storeId)
return next(new ValidationError("storeId manquant dans l'URL"));

const products = await Product.find({ storeId }).sort({ createdAt: -1 }).lean();

return res.json(products);
});
