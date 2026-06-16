// controllers/storeController.ts
import { Request, Response } from "express";
import Store from "../models/Store";
import Product from "../models/Product";
import Sale from "../models/Sales";
import Agent from "../models/Agent";
import { logActivity } from "./activityController";
import { getStoreId } from "../utils/storeId";

const DEFAULT_MASKED_PHONE = "+242 ** ** ** **";

function safeTrim(v: any) {
return typeof v === "string" ? v.trim() : "";
}

/* =====================================================
PATCH /api/store/onboarding
→ V12 ULTRA PRO
🔥 FIX MAJEUR : ENREGISTRER referralCodeUsed
===================================================== */
export const updateStoreOnboarding = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const { storeName, city, agentCode, referralCode, ownerName, ownerPhone } = req.body as {
storeName?: string;
city?: string;
agentCode?: string;
referralCode?: string;
ownerName?: string;
ownerPhone?: string;
};

const cleanStoreName = safeTrim(storeName);
const cleanCity = safeTrim(city);
const cleanAgentCode = safeTrim(agentCode).toUpperCase();
const cleanReferralCode = safeTrim(referralCode).toUpperCase();
const cleanOwnerName = safeTrim(ownerName);
const cleanOwnerPhone = safeTrim(ownerPhone);

if (!cleanStoreName) {
return res.status(400).json({ error: "storeName obligatoire" });
}

const store: any = await Store.findById(storeId);
if (!store)
return res.status(404).json({ error: "Boutique introuvable" });

/* =====================================================
🔥 UPDATE BASIQUE
===================================================== */
store.storeName = cleanStoreName;

if (cleanCity) {
store.city = cleanCity;
}

/* =====================================================
👤 OWNER (write-once si vide)
===================================================== */
if (cleanOwnerName) {
store.ownerName = cleanOwnerName;
}
if (cleanOwnerPhone) {
store.ownerPhone = cleanOwnerPhone;
}

/* =====================================================
🔒 AGENT CODE WRITE-ONCE
===================================================== */
if (!store.agentCode && cleanAgentCode) {
store.agentCode = cleanAgentCode;
}

/* =====================================================
⭐⭐⭐ FIX ULTRA PRO V12 ⭐⭐⭐
ENREGISTRER referralCodeUsed UNE SEULE FOIS
===================================================== */
if (
!store.referralCodeUsed && // 🔒 lock permanent
cleanReferralCode &&
cleanReferralCode !== store.referralCode // éviter auto-parrainage
) {
store.referralCodeUsed = cleanReferralCode;
console.log("🎯 referralCodeUsed enregistré:", cleanReferralCode);
}

/* =====================================================
ONBOARDING DONE
===================================================== */
store.isOnboarded = true;

await store.save();

if (store.agentCode) {
  logActivity(store.agentCode, "store_onboarded", `${store.storeName} — Installation terminée`, {
    storeId: String(store._id),
    storeName: store.storeName,
  });
}

const isOnboarded =
typeof store.isOnboarded === "boolean"
? !!store.isOnboarded
: !!(store.storeName && String(store.storeName).trim().length > 0);

return res.status(200).json({
message: "Onboarding boutique enregistré",
shopName: store.storeName ?? "NOM COMMERCIAL",
phone: store.phone ?? "",
shopId: store.shopId ?? "",
plan: store.plan ?? "Essai gratuit",
referralCode: store.referralCode ?? store.shopId ?? "",
referredCount: store.referredCount ?? 0,
city: store.city ?? "",
agentCode: store.agentCode ?? "",
ownerName: store.ownerName ?? "",
ownerPhone: store.ownerPhone ?? "",
isOnboarded,
});
} catch (err) {
console.error("❌ updateStoreOnboarding", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
GET /api/store/me
===================================================== */
export const getMyStoreProfile = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const store = await Store.findById(storeId)
.select(
"storeName phone shopId plan referralCode referredCount paidReferrals city agentCode isOnboarded ownerName ownerPhone"
)
.lean();

if (!store)
return res.status(404).json({ error: "Boutique introuvable" });

const isOnboarded =
typeof (store as any).isOnboarded === "boolean"
? !!(store as any).isOnboarded
: !!(store.storeName && String(store.storeName).trim().length > 0);

return res.status(200).json({
shopName: store.storeName ?? "NOM COMMERCIAL",
phone: store.phone ?? "",
shopId: store.shopId ?? "",
plan: store.plan ?? "Essai gratuit",
referralCode: store.referralCode ?? store.shopId ?? "",
referredCount: store.referredCount ?? 0,
paidReferrals: (store as any).paidReferrals ?? 0,
city: (store as any).city ?? "",
agentCode: (store as any).agentCode ?? "",
ownerName: (store as any).ownerName ?? "",
ownerPhone: (store as any).ownerPhone ?? "",
isOnboarded,
});
} catch (err) {
console.error("❌ getMyStoreProfile", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
GET /api/store/kpis
= EMA = (no séparateur de require)
===================================================== */
export const getStoreKpis = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res.status(400).json({ error: "storeId manquant" });

const totalProducts = await Product.countDocuments({ storeId });

const agg = await Product.aggregate([
{ $match: { storeId } },
{
$group: {
_id: null,
totalStockQty: { $sum: { $ifNull: ["$quantity", 0] } },
stockValueSell: {
$sum: {
$multiply: [
{ $ifNull: ["$sellPrice", 0] },
{ $ifNull: ["$quantity", 0] },
],
},
},
},
},
]);

const totalStockQty = agg?.[0]?.totalStockQty ?? 0;
const stockValueSell = agg?.[0]?.stockValueSell ?? 0;

const lowStockCount = await Product.countDocuments({
storeId,
$expr: { $lte: ["$quantity", "$alertLevel"] },
});

const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 365);

const now = new Date();
const today = new Date(
now.getFullYear(),
now.getMonth(),
now.getDate()
);
const limitDate = new Date(today);
limitDate.setDate(today.getDate() + days);

const expiringCount = await Product.countDocuments({
storeId,
expirationDates: { $elemMatch: { $gte: today, $lte: limitDate } },
});

// Today's sales
const businessDate = new Intl.DateTimeFormat("fr-CA", {
timeZone: "Africa/Brazzaville",
year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const todaySalesAgg = await Sale.aggregate([
{ $match: { storeId, businessDate } },
{
$group: {
_id: null,
totalSales: { $sum: 1 },
totalRevenue: { $sum: "$totalAmount" },
},
},
]);

const todaySales = todaySalesAgg?.[0]?.totalSales ?? 0;
const todayRevenue = todaySalesAgg?.[0]?.totalRevenue ?? 0;

return res.status(200).json({
totalProducts,
totalStockQty,
stockValueSell,
lowStockCount,
expiringCount,
todaySales,
todayRevenue,
});
} catch (err) {
console.error("❌ getStoreKpis", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
GET /api/store/my-agent
===================================================== */
export const getMyAgent = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId)
return res
.status(401)
.json({ error: "Boutique non authentifiée" });

const store = await Store.findById(storeId)
.select("agentCode")
.lean();

if (!store)
return res.status(404).json({ error: "Boutique introuvable" });

const agentCode = safeTrim((store as any)?.agentCode);
if (!agentCode) {
return res.status(200).json({ agent: null });
}

const agent = await Agent.findOne({ code: agentCode })
.select("name code isActive photoUrl")
.lean();

if (!agent) {
return res.status(200).json({ agent: null });
}

const contactPhone = safeTrim(process.env.VOCOSHOP_CONTACT_PHONE);
if (!contactPhone) {
return res.status(500).json({
error: "VOCOSHOP_CONTACT_PHONE manquant côté serveur",
});
}

const payload = {
name: safeTrim((agent as any)?.name),
code: safeTrim((agent as any)?.code),
photoUrl: (agent as any)?.photoUrl || null,
isActive: !!(agent as any)?.isActive,
displayPhone: DEFAULT_MASKED_PHONE,
contactPhone,
};

return res.status(200).json(payload);
} catch (e) {
console.error("❌ getMyAgent:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};
