import { Request, Response } from "express";
import CallProxy from "../models/CallProxy";
import Agent from "../models/Agent";
import Store from "../models/Store";
import { getStoreId } from "../utils/storeId";
import { initiateProxyCall } from "../services/vonageVoiceService";

export const initiateCall = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const { agentCode } = req.body;
if (!agentCode || typeof agentCode !== "string") return res.status(400).json({ error: "code agent requis" });

const agent = await Agent.findOne({ code: agentCode.trim() }).lean();
if (!agent) return res.status(404).json({ error: "Agent introuvable" });
if (!agent.isActive) return res.status(400).json({ error: "Agent indisponible" });

const store = await Store.findById(storeId).lean();
if (!store) return res.status(404).json({ error: "Boutique introuvable" });

const callerPhone = store.phone || "";
if (!callerPhone) return res.status(400).json({ error: "Aucun téléphone associé à cette boutique" });

const agentPhone = agent.phone || "";
if (!agentPhone) return res.status(400).json({ error: "Aucun téléphone pour cet agent" });

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
} catch (err) {
console.error("❌ initiateCall:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};

export const answerWebhook = async (req: Request, res: Response) => {
try {
const { proxyId } = req.params;
const proxy = await CallProxy.findById(proxyId);
if (!proxy) return res.status(404).json({ error: "Session introuvable" });

const { buildAnswerNcco } = await import("../services/vonageVoiceService");
const ncco = buildAnswerNcco(proxy.agentPhone);
return res.json(ncco);
} catch (err) {
console.error("❌ answerWebhook:", err);
return res.status(500).json({ error: "Erreur webhook answer" });
}
};

export const eventWebhook = async (req: Request, res: Response) => {
try {
const { proxyId } = req.params;
const event = req.body;

const proxy = await CallProxy.findById(proxyId);
if (!proxy) return res.status(404).json({ error: "Session introuvable" });

const { handleCallEvent } = await import("../services/vonageVoiceService");
const { status, duration } = handleCallEvent(event);

proxy.status = status as any;
if (duration > 0) proxy.duration = duration;
await proxy.save();

console.log(`📞 Événement appel ${proxyId}: ${event.status} → ${status} (${duration}s)`);

return res.status(200).end();
} catch (err) {
console.error("❌ eventWebhook:", err);
return res.status(500).end();
}
};
