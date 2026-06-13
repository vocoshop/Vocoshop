// controllers/agentAdminController.ts
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import Agent from "../models/Agent";
import { getNextSequence } from "../services/counterService";
import { notifyWelcome, notifyText } from "../services/notificationService";
import { normalizePhone } from "../utils/phone";

function randomSuffix(): string {
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const i = Math.floor(Math.random() * letters.length);
return letters[i];
}

function buildAgentCode(n: number, suffix: string) {
const s = String(suffix || "").trim().toUpperCase().slice(0, 1) || "A";
return `AG-${n}-${s}`;
}

function generateAuthCode(len = 6): string {
const min = Math.pow(10, len - 1);
const max = Math.pow(10, len) - 1;
return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function safeAgent(agent: any) {
return {
id: String(agent._id),
name: agent.name,
firstName: agent.firstName || "",
phone: agent.phone,
code: agent.code,
codeNumber: agent.codeNumber,
codeSuffix: agent.codeSuffix,
city: agent.city || "",
country: agent.country || "",
gender: agent.gender || "",
birthDate: agent.birthDate || "",
idType: agent.idType || "",
idNumber: agent.idNumber || "",
isApproved: !!agent.isApproved,
isActive: !!agent.isActive,
mustChangePassword: !!agent.mustChangePassword,
lastLoginAt: agent.lastLoginAt || null,
createdAt: agent.createdAt,
updatedAt: agent.updatedAt,
};
}

/* =====================================================
POST /api/admin/agents
Body: { name, phone, city?, region? }
- Génère code (Counter + suffix auto)
- Génère authCode temporaire auto
- Envoie SMS
===================================================== */
export const createAgent = async (req: Request, res: Response) => {
try {
const name = String(req.body?.name || "").trim();
const phone = normalizePhone(req.body?.phone);
const city = String(req.body?.city || "").trim();
const region = String(req.body?.region || "").trim();

if (!name || !phone) {
return res.status(400).json({ error: "name et phone sont requis" });
}

// unicité téléphone
const exists = await Agent.findOne({ phone }).select("_id").lean();
if (exists) {
return res.status(409).json({ error: "Un agent avec ce téléphone existe déjà" });
}

// ✅ Counter atomic
const seq = await getNextSequence("agent", 1000); // 1001, 1002...

// ✅ suffix auto + collision check (ultra safe)
let suffix = randomSuffix();
let code = buildAgentCode(seq, suffix);

for (let tries = 0; tries < 10; tries++) {
const codeExists = await Agent.findOne({ code }).select("_id").lean();
if (!codeExists) break;

suffix = randomSuffix();
code = buildAgentCode(seq, suffix);

if (tries === 9) {
return res.status(500).json({ error: "Impossible de générer un code agent unique" });
}
}

// ✅ authCode temporaire (PIN) -> hashé
const authCode = generateAuthCode(6);
const authCodeHash = await bcrypt.hash(authCode, 10);

if (process.env.NODE_ENV === "development") {
  console.log("🔐 AUTHCODE (DEV) =", authCode, "| phone =", phone, "| code =", code);
}

const agent = await Agent.create({
name,
phone,
code,
codeNumber: seq,
codeSuffix: suffix,
city,
region,

// ✅ 1ère connexion
passwordHash: null,
authCodeHash,
authCodeIssuedAt: new Date(),
mustChangePassword: true,

isActive: true,
lastLoginAt: null,
});

// ✅ SMS (ne JAMAIS renvoyer authCode en JSON)
const msg =
`Vocoshop Agent ✅\n` +
`Bonjour ${name},\n` +
`Votre accès est prêt.\n` +
`Code: ${agent.code}\n` +
`Code d'accès (1ère connexion): ${authCode}\n` +
`Connectez-vous puis définissez votre mot de passe.`;

const smsOk = await notifyText(phone, msg);

return res.status(201).json({
message: smsOk ? "Agent créé + SMS envoyé" : "Agent créé (SMS non envoyé)",
agent: safeAgent(agent),
smsSent: smsOk,
});
} catch (e: any) {
console.error("❌ createAgent:", e);
if (e?.code === 11000) {
const keys = Object.keys(e?.keyValue || {});
return res.status(409).json({ error: `Doublon: ${keys.join(", ")}` });
}
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
GET /api/admin/agents?q=&status=&page=&limit=
===================================================== */
export const listAgents = async (req: Request, res: Response) => {
try {
console.log("🔍 listAgents called - user:", (req as any).user);
const q = String(req.query?.q || "").trim();
const status = String(req.query?.status || "").trim(); // active | inactive | all
const approved = String(req.query?.approved || "").trim(); // approved | pending | all

const page = Math.max(1, parseInt(String(req.query?.page || "1"), 10) || 1);
const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || "20"), 10) || 20));
const skip = (page - 1) * limit;

// Pour debug - afficher tous les agents
const filter: any = {};
if (status && status !== "all") filter.isActive = status === "active";
// Filtrer par statut d'approbation
if (approved && approved !== "all") {
  if (approved === "pending") filter.isApproved = false;
  else if (approved === "true") filter.isApproved = true;
  else if (approved === "rejected") filter.isRejected = true;
}

if (q) {
filter.$or = [
{ name: { $regex: q, $options: "i" } },
{ phone: { $regex: q, $options: "i" } },
{ code: { $regex: q, $options: "i" } },
{ city: { $regex: q, $options: "i" } },
{ region: { $regex: q, $options: "i" } },
];
}

const [items, total] = await Promise.all([
Agent.find(filter)
.select("name firstName phone code codeNumber codeSuffix city country isApproved isActive mustChangePassword lastLoginAt createdAt updatedAt idType idNumber")
.sort({ createdAt: -1 })
.skip(skip)
.limit(limit)
.lean(),
Agent.countDocuments(filter),
]);

return res.json({
agents: items.map((a: any) => safeAgent(a)),
meta: {
page,
limit,
total,
hasMore: skip + items.length < total,
},
filters: { q, status: status || "all" },
});
} catch (e) {
console.error("❌ listAgents:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
PATCH /api/admin/agents/:id/status
Body: { isActive: boolean }
===================================================== */
export const setAgentStatus = async (req: Request, res: Response) => {
try {
const id = String(req.params?.id || "").trim();
const isActive = Boolean(req.body?.isActive);

if (!id) return res.status(400).json({ error: "id manquant" });

const agent = await Agent.findByIdAndUpdate(id, { isActive }, { new: true })
.select("name phone code codeNumber codeSuffix city region isActive mustChangePassword lastLoginAt createdAt updatedAt")
.lean();

if (!agent) return res.status(404).json({ error: "Agent introuvable" });

return res.json({ message: "Statut mis à jour", agent: safeAgent(agent) });
} catch (e) {
console.error("❌ setAgentStatus:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
PATCH /api/admin/agents/:id/password
- reset en mode "authCode" (1ère connexion)
Body optionnel: { sendSms?: boolean }
===================================================== */
export const resetAgentPassword = async (req: Request, res: Response) => {
try {
const id = String(req.params?.id || "").trim();
const sendSms = req.body?.sendSms !== false;

if (!id) return res.status(400).json({ error: "id manquant" });

const agent = await Agent.findById(id).select("_id name phone code isActive").lean();
if (!agent) return res.status(404).json({ error: "Agent introuvable" });

const authCode = generateAuthCode(6);
const authCodeHash = await bcrypt.hash(authCode, 10);

await Agent.updateOne(
{ _id: id },
{
$set: {
// on force re-activation flow
mustChangePassword: true,
passwordHash: null,
authCodeHash,
authCodeIssuedAt: new Date(),
},
}
);

let smsOk = false;
if (sendSms) {
const msg =
`Vocoshop Agent 🔐\n` +
`Bonjour ${agent.name},\n` +
`Votre accès a été réinitialisé.\n` +
`Code: ${agent.code}\n` +
`Code d'accès (1ère connexion): ${authCode}\n` +
`Connectez-vous puis définissez votre mot de passe.`;

smsOk = await notifyText(String(agent.phone), msg);
}

return res.json({
message: sendSms
? smsOk
? "Accès réinitialisé + SMS envoyé"
: "Accès réinitialisé (SMS non envoyé)"
: "Accès réinitialisé",
smsSent: sendSms ? smsOk : false,
});
} catch (e) {
console.error("❌ resetAgentPassword:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
POST /api/admin/agents/:id/approve
- Approuve + active un candidat
- Envoie SMS avec code agent et instructions
===================================================== */
export const approveAgent = async (req: Request, res: Response) => {
try {
const id = String(req.params?.id || "").trim();
const sendSms = req.body?.sendSms !== false;

if (!id) return res.status(400).json({ error: "id manquant" });

const agent = await Agent.findById(id).select("_id name phone code firstName isApproved isActive").lean();
if (!agent) return res.status(404).json({ error: "Candidat introuvable" });

if (agent.isApproved) {
return res.status(400).json({ error: "Ce candidat est déjà approuvé" });
}

const authCode = generateAuthCode(6);
const authCodeHash = await bcrypt.hash(authCode, 10);

await Agent.findByIdAndUpdate(id, {
isApproved: true,
isActive: true,
authCodeHash,
authCodeIssuedAt: new Date(),
mustChangePassword: true,
});

let notifSent = false;
if (sendSms) {
const firstName = agent.firstName || agent.name.split(" ")[0];
const result = await notifyWelcome(String(agent.phone), firstName, agent.code, authCode);
notifSent = result.whatsapp || result.sms;
}

return res.json({
message: notifSent
? "Candidat approuvé + notification envoyée"
: "Candidat approuvé (notification non envoyée)",
notifSent,
authCode,
agent: {
id: agent._id,
name: agent.name,
code: agent.code,
phone: agent.phone,
firstName: agent.firstName,
},
});
} catch (e) {
console.error("❌ approveAgent:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};

/* =====================================================
POST /api/admin/agents/:id/reject
- Rejette + supprime un candidat
- Envoie SMS de refus
===================================================== */
export const rejectAgent = async (req: Request, res: Response) => {
try {
const id = String(req.params?.id || "").trim();
const reason = String(req.body?.reason || "").trim();
const sendSms = req.body?.sendSms !== false;

if (!id) return res.status(400).json({ error: "id manquant" });

const agent = await Agent.findById(id).select("_id name phone firstName isApproved").lean();
if (!agent) return res.status(404).json({ error: "Candidat introuvable" });

const firstName = agent.firstName || agent.name.split(" ")[0];
let smsSent = false;

if (sendSms) {
const msg =
`Vocoshop 😔\n` +
`Bonjour ${firstName},\n\n` +
`Nous avons examiné votre candidature.\n` +
`Malheureusement, elle n'a pas été retenue.\n` +
(reason ? `Raison: ${reason}\n` : "") +
`Vous pouvez postuler à nouveau plus tard.\n\n` +
`L'équipe Vocoshop`;

smsSent = await notifyText(String(agent.phone), msg);
}

await Agent.findByIdAndDelete(id);

return res.json({
message: smsSent
? "Candidat rejeté + SMS envoyé"
: "Candidat rejeté (SMS non envoyé)",
smsSent,
});
} catch (e) {
console.error("❌ rejectAgent:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};
