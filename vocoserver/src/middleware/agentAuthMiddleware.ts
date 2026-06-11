// middleware/agentAuthMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import Agent from "../models/Agent";

function getAgentJwtSecret() {
return process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || "";
}

export default async function agentAuthMiddleware(req: Request, res: Response, next: NextFunction) {
try {
const auth = String(req.headers.authorization || "");
const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : "";

if (!token) return res.status(401).json({ error: "Token manquant" });

const secret = getAgentJwtSecret();
if (!secret) return res.status(500).json({ error: "Secret JWT agent manquant" });

const decoded: any = jwt.verify(token, secret);

const agentId = String(decoded?.agentId || "");
const type = String(decoded?.type || "");
const role = String(decoded?.role || "");

if (!agentId || type !== "agent" || role !== "agent") {
return res.status(401).json({ error: "Token agent invalide" });
}

const agent = await Agent.findById(agentId)
.select("-passwordHash -authCodeHash -authCodeIssuedAt -__v")
.lean();

if (!agent) return res.status(401).json({ error: "Agent invalide" });
if ((agent as any).isActive === false) return res.status(403).json({ error: "Agent désactivé" });

req.agent = {
id: String(agent._id),
name: agent.name,
firstName: (agent as any).firstName || "",
lastName: (agent as any).lastName || "",
phone: agent.phone,
code: agent.code,
codeNumber: (agent as any).codeNumber,
codeSuffix: (agent as any).codeSuffix,
city: (agent as any).city || "",
region: (agent as any).region || "",
country: (agent as any).country || "",
gender: (agent as any).gender || "",
birthDate: (agent as any).birthDate || null,
idType: (agent as any).idType || "",
idNumber: (agent as any).idNumber || "",
idPhotoPath: (agent as any).idPhotoPath || "",
selfiePhotoPath: (agent as any).selfiePhotoPath || "",
isApproved: (agent as any).isApproved || false,
isActive: (agent as any).isActive,
mustChangePassword: !!(agent as any).mustChangePassword,
lastLoginAt: (agent as any).lastLoginAt || null,
createdAt: (agent as any).createdAt || null,
role: "agent",
type: "agent",
};

return next();
} catch (e) {
console.error("❌ agentAuthMiddleware:", e);
return res.status(401).json({ error: "Token agent invalide ou expiré" });
}
}
