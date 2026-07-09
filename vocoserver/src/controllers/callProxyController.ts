import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from "../utils/AppError";
import CallProxy from "../models/CallProxy";
import Agent from "../models/Agent";
import Store from "../models/Store";
import { getStoreId } from "../utils/storeId";
import { initiateProxyCall } from "../services/vonageVoiceService";

export const initiateCall = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const storeId = getStoreId(req);
if (!storeId) return next(new ValidationError("storeId manquant"));

const { agentCode } = req.body;
if (!agentCode || typeof agentCode !== "string") return next(new ValidationError("code agent requis"));

const agent = await Agent.findOne({ code: agentCode.trim() }).lean();
if (!agent) return next(new NotFoundError("Agent introuvable"));
if (!agent.isActive) return next(new ValidationError("Agent indisponible"));

const store = await Store.findById(storeId).lean();
if (!store) return next(new NotFoundError("Boutique introuvable"));

const callerPhone = store.phone || "";
if (!callerPhone) return next(new ValidationError("Aucun téléphone associé à cette boutique"));

const agentPhone = agent.phone || "";
if (!agentPhone) return next(new ValidationError("Aucun téléphone pour cet agent"));

const proxy = await CallProxy.create({
storeId,
agentCode: agent.code,
agentName: agent.name || "",
callerPhone,
agentPhone,
status: "requested",
});

const baseUrl = process.env.PUBLIC_BASE_URL || "https://vocoshop.onrender.com";
const answerUrl = `${baseUrl}/api/call-proxy/webhook/answer/${proxy._id}`;
const eventUrl = `${baseUrl}/api/call-proxy/webhook/event/${proxy._id}`;

const result = await initiateProxyCall(callerPhone, agentPhone, answerUrl, eventUrl);

if (!result.success) {
proxy.status = "failed";
await proxy.save();
console.error("❌ Échec appel Vonage:", result.error);
return res.status(502).json({ error: "Impossible de lancer l'appel", detail: result.error });
}

proxy.vonageCallUuid = result.uuid || "";
proxy.status = "ringing";
await proxy.save();

console.log(`📞 Appel Vonage initié: ${proxy._id} → ${agent.code} uuid=${result.uuid}`);

return res.json({
message: "Appel en cours. Le système vous connecte à l'agent.",
proxyId: proxy._id,
});
});

export const answerWebhook = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { proxyId } = req.params;
const proxy = await CallProxy.findById(proxyId);
if (!proxy) return next(new NotFoundError("Session introuvable"));

const { buildAnswerNcco } = await import("../services/vonageVoiceService");
const ncco = buildAnswerNcco(proxy.agentPhone);
return res.json(ncco);
});

export const eventWebhook = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

const { proxyId } = req.params;
const event = req.body;

const proxy = await CallProxy.findById(proxyId);
if (!proxy) return next(new NotFoundError("Session introuvable"));

const { handleCallEvent } = await import("../services/vonageVoiceService");
const { status, duration } = handleCallEvent(event);

proxy.status = status as any;
if (duration > 0) proxy.duration = duration;
await proxy.save();

console.log(`📞 Événement appel ${proxyId}: ${event.status} → ${status} (${duration}s)`);

return res.status(200).end();
});
