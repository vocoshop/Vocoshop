// controllers/agentController.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import Agent from "../models/Agent";
import Store from "../models/Store";
import DailyReport from "../models/DailyReport";
import { normalizePhone } from "../utils/phone";
import { getAgentCommissions } from "../services/commissionService";
import { notifyAuthCode, notifyPasswordReset } from "../services/notificationService";

/* =====================================================
Helpers
===================================================== */
function toISO(d?: Date | null) {
return d ? new Date(d).toISOString() : null;
}

function computeActivityStatus(lastActiveAt?: Date | null) {
if (!lastActiveAt) return "inactive";
const days = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 86400000);
if (days <= 7) return "active";
if (days <= 30) return "low";
return "inactive";
}

function planToSubscriptionStatus(plan?: string) {
const p = String(plan || "").toLowerCase();
if (!p) return "none";
if (p.includes("essai")) return "trial";
if (p.includes("actif")) return "active";
if (p.includes("expire")) return "expired";
return "active";
}

function escapeRegex(input: string) {
return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAgentJwtSecret() {
return process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || "";
}

function signAgentToken(agentId: string) {
const secret = getAgentJwtSecret();
if (!secret) throw new Error("AGENT_JWT_SECRET manquant");

return jwt.sign(
{ agentId: String(agentId), role: "agent", type: "agent" },
secret,
{ expiresIn: "7d" }
);
}

function getAuthCodeExpiryMinutes(): number {
// tu peux définir AGENT_AUTHCODE_EXP_MINUTES sinon fallback OTP_EXP_MINUTES sinon 10
const raw =
process.env.AGENT_AUTHCODE_EXP_MINUTES ||
process.env.OTP_EXP_MINUTES ||
"10";
const n = Number(raw);
return Number.isFinite(n) && n > 0 ? n : 10;
}

function isAuthCodeExpired(issuedAt?: Date | null) {
if (!issuedAt) return true;
const expMin = getAuthCodeExpiryMinutes();
const ageMs = Date.now() - new Date(issuedAt).getTime();
return ageMs > expMin * 60 * 1000;
}

/* =====================================================
POST /api/agent/auth/otp/send (PUBLIC)
- Envoie un code OTP au téléphone de l'agent
===================================================== */
export const sendAgentOTP = async (req: Request, res: Response) => {
  try {
    const phoneRaw = String(req.body?.phone || "").trim();
    const phone = normalizePhone(phoneRaw);
    if (!phone) return res.status(400).json({ error: "Téléphone requis" });

    const agent = await Agent.findOne({ phone }).lean();
    if (!agent) return res.status(404).json({ error: "Aucun agent trouvé avec ce numéro" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(code, 10);

    await Agent.updateOne(
      { _id: agent._id },
      { $set: { authCodeHash: hashed, authCodeIssuedAt: new Date() } }
    );

    let notifResult = { whatsapp: false, sms: false };
    try {
      notifResult = await notifyAuthCode(phone, code);
    } catch (e) {
      console.error("❌ Notification OTP échouée:", e);
    }

    const sent = notifResult.whatsapp || notifResult.sms;
    const channel = notifResult.whatsapp ? "WhatsApp" : notifResult.sms ? "SMS" : "aucun";
    return res.json({ message: sent ? `Code envoyé par ${channel}` : "Code généré (notification non envoyée)", phone, sent, channel });
  } catch (e) {
    console.error("❌ sendAgentOTP:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
POST /api/agent/auth/otp/verify (PUBLIC)
- Vérifie le code OTP et connecte l'agent
===================================================== */
export const verifyAgentOTP = async (req: Request, res: Response) => {
  try {
    const phoneRaw = String(req.body?.phone || "").trim();
    const code = String(req.body?.code || "").trim();
    const phone = normalizePhone(phoneRaw);

    if (!phone || !code) return res.status(400).json({ error: "Téléphone et code requis" });

    const agent: any = await Agent.findOne({ phone })
      .select("_id name firstName lastName phone code city region country gender birthDate idType idNumber isApproved isActive authCodeHash authCodeIssuedAt createdAt lastLoginAt")
      .lean();

    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    if (!agent.isActive) return res.status(403).json({ error: "Agent désactivé" });
    if (!agent.authCodeHash) return res.status(400).json({ error: "Aucun code envoyé" });
    if (isAuthCodeExpired(agent.authCodeIssuedAt)) return res.status(401).json({ error: "Code expiré" });

    const ok = await bcrypt.compare(code, agent.authCodeHash);
    if (!ok) return res.status(401).json({ error: "Code invalide" });

    await Agent.updateOne(
      { _id: agent._id },
      { $set: { lastLoginAt: new Date() }, $unset: { authCodeHash: "", authCodeIssuedAt: "" } }
    );

    const token = signAgentToken(String(agent._id));

    return res.json({
      token,
      agent: {
        id: String(agent._id),
        firstName: agent.firstName || "",
        lastName: agent.lastName || "",
        name: agent.name,
        phone: agent.phone,
        code: agent.code,
        city: agent.city || "",
        region: agent.region || "",
        country: agent.country || "",
        gender: agent.gender || "",
        birthDate: agent.birthDate || null,
        idType: agent.idType || "",
        idNumber: agent.idNumber || "",
        isApproved: !!agent.isApproved,
        isActive: agent.isActive,
        createdAt: agent.createdAt || null,
        lastLoginAt: agent.lastLoginAt || null,
        role: "agent",
      },
    });
  } catch (e) {
    console.error("❌ verifyAgentOTP:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
POST /api/agent/auth/forgot-password (PUBLIC)
- Génère un mot de passe temporaire et l'envoie par SMS
===================================================== */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const phoneRaw = String(req.body?.phone || "").trim();
    const phone = normalizePhone(phoneRaw);
    if (!phone) return res.status(400).json({ error: "Téléphone requis" });

    const agent = await Agent.findOne({ phone }).lean();
    if (!agent) return res.status(404).json({ error: "Aucun agent trouvé avec ce numéro" });
    if (!agent.isActive) return res.status(403).json({ error: "Agent désactivé" });

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const hashed = await bcrypt.hash(tempPassword, 10);

    await Agent.updateOne(
      { _id: agent._id },
      { $set: { passwordHash: hashed, mustChangePassword: true, lastLoginAt: null } }
    );

    let notifResult = { whatsapp: false, sms: false };
    try {
      const firstName = agent.firstName || agent.name?.split(" ")[0] || "";
      notifResult = await notifyPasswordReset(phone, firstName, tempPassword);
    } catch (e) {
      console.error("❌ Notification forgotPassword échouée:", e);
    }

    const sent = notifResult.whatsapp || notifResult.sms;
    const channel = notifResult.whatsapp ? "WhatsApp" : notifResult.sms ? "SMS" : "aucun";
    return res.json({
      message: sent ? `Mot de passe envoyé par ${channel}` : "Mot de passe réinitialisé (notification non envoyée)",
      phone, sent, channel,
    });
  } catch (e) {
    console.error("❌ forgotPassword:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
POST /api/agent/auth/login (PUBLIC)
Body:
- { codeOrPhone, password } -> login normal
- { codeOrPhone, authCode } -> 1ère connexion
===================================================== */
export const loginAgent = async (req: Request, res: Response) => {
try {
const identifierRaw = String(req.body?.codeOrPhone || "").trim();
const identifierPhone = normalizePhone(identifierRaw);

const password = String(req.body?.password || "");
const authCode = String(req.body?.authCode || "");

if (!identifierRaw) {
return res.status(400).json({ error: "codeOrPhone manquant" });
}

const agent: any = await Agent.findOne({
$or: [{ code: identifierRaw }, { phone: identifierPhone }],
})
.select(
  "_id name firstName lastName phone code codeNumber codeSuffix city region country gender birthDate idType idNumber isApproved isActive passwordHash authCodeHash authCodeIssuedAt mustChangePassword createdAt lastLoginAt"
)
.lean();

if (!agent) return res.status(401).json({ error: "Identifiants invalides" });
if (agent.isActive === false) return res.status(403).json({ error: "Agent désactivé" });

const makeAgentPayload = (a: any, mustChangePwd: boolean) => ({
  id: String(a._id),
  firstName: a.firstName || "",
  lastName: a.lastName || "",
  name: a.name,
  phone: a.phone,
  code: a.code,
  codeNumber: a.codeNumber,
  codeSuffix: a.codeSuffix,
  city: a.city || "",
  region: a.region || "",
  country: a.country || "",
  gender: a.gender || "",
  birthDate: a.birthDate || null,
  idType: a.idType || "",
  idNumber: a.idNumber || "",
  idPhotoPath: a.idPhotoPath || "",
  selfiePhotoPath: a.selfiePhotoPath || "",
  isApproved: !!a.isApproved,
  isActive: a.isActive,
  mustChangePassword: mustChangePwd,
  lastLoginAt: a.lastLoginAt || null,
  createdAt: a.createdAt || null,
  role: "agent",
});

// ✅ 1ère connexion: authCode OU mot de passe temporaire
if (agent.mustChangePassword) {
  // Si un password est fourni et que l'agent a déjà un passwordHash (ex: reset password)
  if (password && agent.passwordHash) {
    const ok = await bcrypt.compare(password, String(agent.passwordHash || ""));
    if (!ok) return res.status(401).json({ error: "Mot de passe invalide" });

    const token = signAgentToken(String(agent._id));
    return res.json({
      token,
      agent: makeAgentPayload(agent, true),
    });
  }

  // Sinon, flow classique avec authCode
  if (!authCode) {
    return res.status(400).json({ error: "authCode requis (première connexion)" });
  }
if (!agent.authCodeHash) {
return res.status(400).json({ error: "Aucun authCode actif. Demande une réinitialisation." });
}
if (isAuthCodeExpired(agent.authCodeIssuedAt)) {
return res.status(401).json({ error: "authCode expiré. Demande une réinitialisation." });
}

const ok = await bcrypt.compare(authCode, String(agent.authCodeHash || ""));
if (!ok) return res.status(401).json({ error: "authCode invalide" });

const token = signAgentToken(String(agent._id));

return res.json({
token,
agent: makeAgentPayload(agent, true),
});
}

// ✅ login normal: password
if (!password) return res.status(400).json({ error: "password requis" });

const ok = await bcrypt.compare(password, String(agent.passwordHash || ""));
if (!ok) return res.status(401).json({ error: "Identifiants invalides" });

const token = signAgentToken(String(agent._id));

// update lastLoginAt (non bloquant)
Agent.updateOne({ _id: agent._id }, { $set: { lastLoginAt: new Date() } }).catch(() => {});

return res.json({
token,
agent: makeAgentPayload(agent, false),
});
} catch (e) {
console.error("❌ loginAgent:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
POST /api/agent/auth/complete-first-login (PROTECTED)
Body: { newPassword, newCode? }
===================================================== */
export const completeFirstLogin = async (req: Request, res: Response) => {
try {
const agentId = String(req.agent?.id || "");
const newPassword = String(req.body?.newPassword || "");
const newCode = String(req.body?.newCode || "").trim().toUpperCase();

if (!agentId) return res.status(401).json({ error: "Agent non authentifié" });
if (newPassword.length < 6) {
return res.status(400).json({ error: "Mot de passe trop court (min 6)" });
}

const agent: any = await Agent.findById(agentId)
.select("_id code mustChangePassword")
.lean();

if (!agent) return res.status(404).json({ error: "Agent introuvable" });

// ✅ évite qu’un agent déjà actif refasse le flow “first login”
if (agent.mustChangePassword === false) {
return res.status(400).json({ error: "Compte déjà activé" });
}

const passwordHash = await bcrypt.hash(newPassword, 10);

const update: any = {
passwordHash,
mustChangePassword: false,
authCodeHash: null,
authCodeIssuedAt: null,
lastLoginAt: new Date(),
};

// personnalisation code (optionnel)
if (newCode) {
if (!newCode.startsWith("AG-") || newCode.length < 6 || newCode.length > 20) {
return res.status(400).json({ error: "Code invalide (ex: AG-1024-F)" });
}

const exists = await Agent.findOne({ code: newCode, _id: { $ne: agentId } })
.select("_id")
.lean();

if (exists) return res.status(409).json({ error: "Ce code est déjà utilisé" });

update.code = newCode;
}

await Agent.updateOne({ _id: agentId }, { $set: update });

return res.json({
message: "Compte agent activé",
code: newCode || agent.code,
});
} catch (e) {
console.error("❌ completeFirstLogin:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
POST /api/agent/auth/set-password (PUBLIC)
Body: { agentId, newPassword }
- Définir le mot de passe après première connexion
===================================================== */
export const setPassword = async (req: Request, res: Response) => {
  try {
    const agentId = String(req.body?.agentId || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!agentId) return res.status(400).json({ error: "agentId manquant" });
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mot de passe trop court (min 6)" });
    }

    const agent: any = await Agent.findById(agentId)
      .select("_id code mustChangePassword authCodeHash isApproved isActive")
      .lean();

    if (!agent) return res.status(404).json({ error: "Agent introuvable" });
    if (!agent.isApproved) return res.status(403).json({ error: "Compte non approuvé" });
    if (agent.mustChangePassword === false) {
      return res.status(400).json({ error: "Compte déjà activé" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await Agent.updateOne({ _id: agentId }, {
      $set: {
        passwordHash,
        mustChangePassword: false,
        authCodeHash: null,
        authCodeIssuedAt: null,
        lastLoginAt: new Date(),
      }
    });

    const token = jwt.sign(
      { agentId: agent._id, role: "agent", type: "agent" },
      getAgentJwtSecret(),
      { expiresIn: "7d" }
    );

    const updatedAgent = await Agent.findById(agentId)
      .select("_id name firstName lastName phone code city country gender birthDate idType idNumber isApproved isActive mustChangePassword lastLoginAt createdAt")
      .lean();

    return res.json({
      message: "Compte activé",
      token,
      agent: {
        id: String(updatedAgent?._id),
        firstName: updatedAgent?.firstName || "",
        lastName: updatedAgent?.lastName || "",
        name: updatedAgent?.name,
        phone: updatedAgent?.phone,
        code: updatedAgent?.code,
        city: updatedAgent?.city || "",
        country: updatedAgent?.country || "",
        isApproved: !!updatedAgent?.isApproved,
        isActive: updatedAgent?.isActive,
        mustChangePassword: false,
        role: "agent",
      },
    });
  } catch (e) {
    console.error("❌ setPassword:", e);
    return res.status(500).json({ error: "Erreur serveur" });
  }
};

/* =====================================================
GET /api/agent/me (PROTECTED)
===================================================== */
export const getAgentMe = async (req: Request, res: Response) => {
return res.json({ agent: req.agent });
};

/* =====================================================
GET /api/agent/stores (PROTECTED)
===================================================== */
export const listAgentStores = async (req: Request, res: Response) => {
try {
const agentCode = String(req.agent?.code || "").trim();
if (!agentCode) return res.status(400).json({ error: "Agent code manquant" });

const qRaw = String(req.query?.q || "").trim();
const q = qRaw ? escapeRegex(qRaw.toLowerCase()) : "";
const status = String(req.query?.status || "").trim();
const sub = String(req.query?.sub || "").trim();

const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10) || 1);
const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || "20"), 10) || 20));

const baseFilter: any = { agentCode };
if (q) {
baseFilter.$or = [
{ storeName: { $regex: q, $options: "i" } },
{ shopId: { $regex: q, $options: "i" } },
{ phone: { $regex: q, $options: "i" } },
{ city: { $regex: q, $options: "i" } },
];
}

const stores = await Store.find(baseFilter)
.select("storeName phone city shopId plan agentCode installedAt lastActiveAt isOnboarded createdAt storeType")
.sort({ createdAt: -1 })
.lean();

const mapped = (stores as any[]).map((s) => {
const activityStatus = computeActivityStatus(s.lastActiveAt);
const subscriptionStatus = planToSubscriptionStatus(s.plan);

      return {
        id: String(s._id),
        storeId: String(s._id),
        shopId: s.shopId || "",
        storeName: s.storeName || "",
        ownerName: s.ownerName || s.storeName || "",
        phone: s.phone || "",
        city: s.city || "",
        storeType: s.storeType ?? null,
        agentCode: s.agentCode || "",
        installedAt: toISO(s.installedAt || s.createdAt),
        createdAt: toISO(s.createdAt),
        lastActiveAt: toISO(s.lastActiveAt),
        isOnboarded: !!s.isOnboarded,
        activityStatus,
        subscriptionStatus,
        plan: s.plan || "",
      };
});

const filtered = mapped.filter((s) => {
if (status && s.activityStatus !== status) return false;
if (sub && s.subscriptionStatus !== sub) return false;
return true;
});

const total = filtered.length;
const start = (page - 1) * limit;
const end = start + limit;

return res.json({
stores: filtered.slice(start, end),
meta: { page, limit, total, hasMore: end < total },
filters: { q: qRaw || "", status: status || "", sub: sub || "" },
});
} catch (e) {
console.error("❌ listAgentStores:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
GET /api/agent/analysis?range=30
OU /api/agent/analysis?from=YYYY-MM-DD&to=YYYY-MM-DD
===================================================== */
export const getAgentAnalysis = async (req: Request, res: Response) => {
try {
const agentCode = String(req.agent?.code || "").trim();
if (!agentCode) return res.status(400).json({ error: "Agent code manquant" });

const stores = await Store.find({ agentCode })
.select("_id storeName shopId city phone plan lastActiveAt installedAt createdAt")
.lean();

const storeIdStrings = (stores as any[]).map((s) => String(s._id)); // ✅ DailyReport.storeId = String

if (storeIdStrings.length === 0) {
return res.json({
period: { mode: "range", rangeDays: 30 },
totals: { revenue: 0, netProfit: 0, tickets: 0, cogs: 0, stores: 0 },
series: [],
topStores: [],
});
}

const from = String(req.query?.from || "").trim();
const to = String(req.query?.to || "").trim();

const rangeDaysRaw = Number(req.query?.range || 30);
const rangeDays = Math.max(1, Math.min(365, Number.isFinite(rangeDaysRaw) ? rangeDaysRaw : 30));

const isYMD = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const ymd = (d: Date) =>
new Intl.DateTimeFormat("fr-CA", {
timeZone: "Africa/Brazzaville",
year: "numeric",
month: "2-digit",
day: "2-digit",
}).format(d);

let startStr = "";
let endStr = "";

if (from || to) {
if (!from || !to) return res.status(400).json({ error: "from et to doivent être fournis ensemble" });
if (!isYMD(from) || !isYMD(to)) return res.status(400).json({ error: "from/to invalides (YYYY-MM-DD)" });
if (from > to) return res.status(400).json({ error: "from doit être <= to" });
startStr = from;
endStr = to;
} else {
const end = new Date();
const start = new Date();
start.setDate(start.getDate() - (rangeDays - 1));
startStr = ymd(start);
endStr = ymd(end);
}

// series par jour
const seriesPipeline: any[] = [
{
$match: {
storeId: { $in: storeIdStrings },
date: { $gte: startStr, $lte: endStr },
},
},
{
$group: {
_id: "$date",
revenue: { $sum: { $ifNull: ["$totalRevenue", 0] } },
netProfit: { $sum: { $ifNull: ["$netProfit", 0] } },
tickets: { $sum: { $ifNull: ["$totalSales", 0] } },
cogs: { $sum: { $ifNull: ["$cogs", 0] } },
},
},
{ $sort: { _id: 1 } },
];

const seriesAgg = await DailyReport.aggregate(seriesPipeline);

const series = (seriesAgg || []).map((d: any) => ({
date: String(d._id),
revenue: Number(d.revenue || 0),
netProfit: Number(d.netProfit || 0),
tickets: Number(d.tickets || 0),
cogs: Number(d.cogs || 0),
}));

const totals = series.reduce(
(acc: any, d: any) => {
acc.revenue += d.revenue;
acc.netProfit += d.netProfit;
acc.tickets += d.tickets;
acc.cogs += d.cogs;
return acc;
},
{ revenue: 0, netProfit: 0, tickets: 0, cogs: 0, stores: storeIdStrings.length }
);

// top stores
const topPipeline: any[] = [
{
$match: {
storeId: { $in: storeIdStrings },
date: { $gte: startStr, $lte: endStr },
},
},
{
$group: {
_id: "$storeId",
revenue: { $sum: { $ifNull: ["$totalRevenue", 0] } },
netProfit: { $sum: { $ifNull: ["$netProfit", 0] } },
tickets: { $sum: { $ifNull: ["$totalSales", 0] } },
},
},
{ $sort: { revenue: -1 } },
{ $limit: 10 },
];

const topAgg = await DailyReport.aggregate(topPipeline);

const storeMap = new Map<string, any>();
(stores as any[]).forEach((s) => storeMap.set(String(s._id), s));

const topStores = (topAgg || []).map((x: any) => {
const s = storeMap.get(String(x._id));
return {
storeId: String(x._id),
shopId: s?.shopId || "",
storeName: s?.storeName || "",
city: s?.city || "",
plan: s?.plan || "",
revenue: Number(x.revenue || 0),
netProfit: Number(x.netProfit || 0),
tickets: Number(x.tickets || 0),
};
});

return res.json({
period: from && to
? { mode: "from_to", from: startStr, to: endStr }
: { mode: "range", rangeDays, from: startStr, to: endStr },
totals,
series,
topStores,
});
} catch (e) {
console.error("❌ getAgentAnalysis:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
GET /api/agent/kpis?range=30 (PROTECTED)
===================================================== */
export const getAgentKpis = async (req: Request, res: Response) => {
try {
const agentCode = String(req.agent?.code || "").trim();
if (!agentCode) return res.status(400).json({ error: "Agent code manquant" });

const rangeDays = Math.max(1, Math.min(180, Number(req.query?.range || 30)));
const since = new Date();
since.setDate(since.getDate() - rangeDays);

const stores = await Store.find({ agentCode })
.select("createdAt installedAt lastActiveAt plan")
.lean();

const totalInstalled = stores.length;

let active = 0;
let inactive = 0;
let low = 0;
let converted = 0;

for (const s of stores as any[]) {
const st = computeActivityStatus(s.lastActiveAt);
if (st === "active") active++;
else if (st === "low") low++;
else inactive++;

const sub = planToSubscriptionStatus(s.plan);
if (sub === "active") converted++;
}

const installedInRange = (stores as any[]).filter((s) => {
const d = s.installedAt || s.createdAt;
return d && new Date(d).getTime() >= since.getTime();
}).length;

const conversionRate = totalInstalled > 0 ? Math.round((converted / totalInstalled) * 100) : 0;

return res.json({
rangeDays,
totals: {
installed: totalInstalled,
installedInRange,
active,
low,
inactive,
converted,
conversionRate,
},
});
} catch (e) {
  console.error("❌ getAgentKpis:", e);
  return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
GET /api/agent/commissions (PROTECTED)
===================================================== */
export const getCommissions = async (req: Request, res: Response) => {
try {
  const agentCode = String(req.agent?.code || "").trim();
  if (!agentCode) return res.status(400).json({ error: "Agent code manquant" });

  const commissions = await getAgentCommissions(agentCode);

  return res.json({ commissions });
} catch (e) {
  console.error("❌ getCommissions:", e);
  return res.status(500).json({ error: "Erreur serveur" });
}
};
