// controllers/agentAdminController.ts
import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import Agent from "../models/Agent";
import { getNextSequence } from "../services/counterService";
import { notifyWelcome, notifyText } from "../services/notificationService";
import { sendSMS } from "../services/smsService";
import { normalizePhone } from "../utils/phone";
import { escapeRegex } from "../utils/helpers";

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
idPhotoPath: agent.idPhotoPath || "",
selfiePhotoPath: agent.selfiePhotoPath || "",
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
export const createAgent = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const name = String(req.body?.name || "").trim();
const phone = normalizePhone(req.body?.phone);
const city = String(req.body?.city || "").trim();
const region = String(req.body?.region || "").trim();

if (!name || !phone) {
return next(new ValidationError("name et phone sont requis"));
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
  // auth code log supprimé (sécurité)
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
});

/* =====================================================
GET /api/admin/agents?q=&status=&page=&limit=
===================================================== */
export const listAgents = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

console.log("🔍 listAgents called - role:", (req as any).user?.role);
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
const eq = escapeRegex(q);
filter.$or = [
{ name: { $regex: eq, $options: "i" } },
{ phone: { $regex: eq, $options: "i" } },
{ code: { $regex: eq, $options: "i" } },
{ city: { $regex: eq, $options: "i" } },
{ region: { $regex: eq, $options: "i" } },
];
}

const [items, total] = await Promise.all([
Agent.find(filter)
.select("name firstName phone code codeNumber codeSuffix city country gender birthDate idType idNumber idPhotoPath selfiePhotoPath isApproved isActive mustChangePassword lastLoginAt createdAt updatedAt")
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
});

/* =====================================================
PATCH /api/admin/agents/:id/status
Body: { isActive: boolean }
===================================================== */
export const setAgentStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const id = String(req.params?.id || "").trim();
const isActive = Boolean(req.body?.isActive);

if (!id) return next(new ValidationError("id manquant"));

const agent = await Agent.findById(id).select("_id name phone code isActive").lean();
if (!agent) return next(new NotFoundError("Agent introuvable"));

if (isActive) {
// Réactivation : générer un nouveau code + mustChangePassword + SMS
const authCode = generateAuthCode(6);
const authCodeHash = await bcrypt.hash(authCode, 10);

await Agent.updateOne(
{ _id: id },
{
$set: {
isActive: true,
mustChangePassword: true,
passwordHash: null,
authCodeHash,
authCodeIssuedAt: null, // jamais expiré tant que l'agent ne s'est pas connecté
},
}
);

const msg =
`Vocoshop - Compte reactive\n` +
`Bonjour ${agent.name},\n` +
`Code: ${agent.code}\n` +
`Code acces: ${authCode}\n` +
`Connectez-vous et creez votre mot de passe.`;

const smsOk = await sendSMS(String(agent.phone), msg);

const updated = await Agent.findById(id)
.select("name phone code codeNumber codeSuffix city region isActive mustChangePassword lastLoginAt createdAt updatedAt")
.lean();

return res.json({
message: smsOk ? "Agent réactivé + SMS envoyé" : "Agent réactivé (SMS non envoyé)",
agent: safeAgent(updated || agent),
smsSent: smsOk,
});
} else {
// Suspension simple
await Agent.updateOne({ _id: id }, { $set: { isActive: false } });

const updated = await Agent.findById(id)
.select("name phone code codeNumber codeSuffix city region isActive mustChangePassword lastLoginAt createdAt updatedAt")
.lean();

return res.json({ message: "Agent suspendu", agent: safeAgent(updated || agent) });
}
});

/* =====================================================
PATCH /api/admin/agents/:id/password
- reset en mode "authCode" (1ère connexion)
Body optionnel: { sendSms?: boolean }
===================================================== */
export const resetAgentPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const id = String(req.params?.id || "").trim();
const sendSms = req.body?.sendSms !== false;

if (!id) return next(new ValidationError("id manquant"));

const agent = await Agent.findById(id).select("_id name phone code isActive").lean();
if (!agent) return next(new NotFoundError("Agent introuvable"));

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
});

/* =====================================================
POST /api/admin/agents/:id/approve
- Approuve + active un candidat
- Envoie SMS avec code agent et instructions
===================================================== */
export const approveAgent = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const id = String(req.params?.id || "").trim();
const sendSms = req.body?.sendSms !== false;

if (!id) return next(new ValidationError("id manquant"));

const agent = await Agent.findById(id).select("_id name phone code firstName isApproved isActive").lean();
if (!agent) return next(new NotFoundError("Candidat introuvable"));

if (agent.isApproved) {
return next(new ValidationError("Ce candidat est déjà approuvé"));
}

const authCode = generateAuthCode(6);
const authCodeHash = await bcrypt.hash(authCode, 10);

await Agent.findByIdAndUpdate(id, {
isApproved: true,
isActive: true,
authCodeHash,
authCodeIssuedAt: null, // null = ne jamais expirer (code d'approbation permanent)
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
});

/* =====================================================
POST /api/admin/agents/:id/reject
- Rejette + supprime un candidat
- Envoie SMS de refus
===================================================== */
export const rejectAgent = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const id = String(req.params?.id || "").trim();
const reason = String(req.body?.reason || "").trim();
const sendSms = req.body?.sendSms !== false;

if (!id) return next(new ValidationError("id manquant"));

const agent = await Agent.findById(id).select("_id name phone firstName isApproved").lean();
if (!agent) return next(new NotFoundError("Candidat introuvable"));

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
});
