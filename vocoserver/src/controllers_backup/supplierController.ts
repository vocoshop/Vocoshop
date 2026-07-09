// src/controllers/supplierController.ts
import { Request, Response } from "express";
import Supplier from "../models/Supplier";
import Order from "../models/Order";
import { getStoreId } from "../utils/storeId";

function cleanStr(v: any): string {
return typeof v === "string" ? v.trim() : "";
}

function escapeRegex(s: string): string {
return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const createSupplier = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const name = cleanStr(req.body?.name);
if (!name) return res.status(400).json({ error: "Nom fournisseur requis" });

const supplier = await Supplier.create({
storeId,
name,
phone: cleanStr(req.body?.phone),
phone2: cleanStr(req.body?.phone2),
whatsapp: cleanStr(req.body?.whatsapp),
email: cleanStr(req.body?.email),
address: cleanStr(req.body?.address),
note: cleanStr(req.body?.note),
});

return res.status(201).json(supplier);
} catch (err) {
console.error("❌ createSupplier error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* -----------------------
LIST
GET /api/suppliers?q=
------------------------ */
export const getSuppliers = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const qRaw = String(req.query?.q ?? "").trim();
const filter: any = { storeId };

if (qRaw) {
const q = escapeRegex(qRaw);
filter.$or = [
{ name: { $regex: q, $options: "i" } },
{ phone: { $regex: q, $options: "i" } },
{ phone2: { $regex: q, $options: "i" } },
{ whatsapp: { $regex: q, $options: "i" } },
{ email: { $regex: q, $options: "i" } },
{ address: { $regex: q, $options: "i" } },
];
}

const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean();
return res.json(suppliers);
} catch (err) {
console.error("❌ getSuppliers error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* -----------------------
GET ONE
GET /api/suppliers/:id
------------------------ */
export const getSupplierById = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
const supplier = await Supplier.findOne({ _id: id, storeId }).lean();
if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable" });

return res.json(supplier);
} catch (err) {
console.error("❌ getSupplierById error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* -----------------------
UPDATE
PATCH /api/suppliers/:id
------------------------ */
export const updateSupplier = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;

const supplier: any = await Supplier.findOne({ _id: id, storeId });
if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable" });

if (req.body?.name !== undefined) {
const name = cleanStr(req.body?.name);
if (!name) return res.status(400).json({ error: "Nom fournisseur requis" });
supplier.name = name;
}

if (req.body?.phone !== undefined) supplier.phone = cleanStr(req.body?.phone);
if (req.body?.phone2 !== undefined) supplier.phone2 = cleanStr(req.body?.phone2);
if (req.body?.whatsapp !== undefined) supplier.whatsapp = cleanStr(req.body?.whatsapp);
if (req.body?.email !== undefined) supplier.email = cleanStr(req.body?.email);
if (req.body?.address !== undefined) supplier.address = cleanStr(req.body?.address);
if (req.body?.note !== undefined) supplier.note = cleanStr(req.body?.note);

await supplier.save();
return res.json(supplier);
} catch (err) {
console.error("❌ updateSupplier error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* -----------------------
DELETE
DELETE /api/suppliers/:id
------------------------ */
export const deleteSupplier = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const { id } = req.params;
const supplier: any = await Supplier.findOne({ _id: id, storeId });
if (!supplier) return res.status(404).json({ error: "Fournisseur introuvable" });

await supplier.deleteOne();
return res.json({ message: "Fournisseur supprimé" });
} catch (err) {
console.error("❌ deleteSupplier error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* -----------------------
DASHBOARD
GET /api/suppliers/dashboard
------------------------ */
export const getSupplierDashboard = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const suppliers = await Supplier.find({ storeId }).sort({ name: 1 }).lean();

const supplierIds = suppliers.map((s) => s._id);

const orderAggs = await Order.aggregate([
{ $match: { storeId, supplierId: { $in: supplierIds } } },
{
$group: {
_id: "$supplierId",
totalOrders: { $sum: 1 },
activeOrders: {
$sum: { $cond: [{ $in: ["$status", ["sent", "draft"]] }, 1, 0] },
},
pendingOrders: {
$sum: { $cond: [{ $eq: ["$status", "received"] }, 1, 0] },
},
lastOrder: { $max: "$createdAt" },
},
},
]);

const orderMap = new Map<string, any>();
for (const agg of orderAggs) {
orderMap.set(String(agg._id), agg);
}

const enriched = suppliers.map((s) => {
const id = String(s._id);
const o = orderMap.get(id);
return {
...s,
totalOrders: o?.totalOrders ?? 0,
activeOrders: o?.activeOrders ?? 0,
pendingOrders: o?.pendingOrders ?? 0,
lastOrder: o?.lastOrder ?? s.lastOrderAt ?? null,
hasRecentOrder: o?.lastOrder
? Date.now() - new Date(o.lastOrder).getTime() < 30 * 24 * 60 * 60 * 1000
: false,
};
});

return res.json(enriched);
} catch (err) {
console.error("❌ getSupplierDashboard error:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
