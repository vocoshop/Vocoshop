// controllers/callProxyController.ts
import { Request, Response } from "express";
import CallProxy from "../models/CallProxy";
import Agent from "../models/Agent";
import { getStoreId } from "../utils/storeId";

export const initiateCall = async (req: Request, res: Response) => {
try {
const storeId = getStoreId(req);
if (!storeId) return res.status(400).json({ error: "storeId manquant" });

const { agentCode } = req.body;
if (!agentCode) return res.status(400).json({ error: "code agent requis" });

const agent = await Agent.findOne({ code: agentCode }).lean();
if (!agent) return res.status(404).json({ error: "Agent introuvable" });

if (!agent.isActive) return res.status(400).json({ error: "Agent indisponible" });

const proxy = await CallProxy.create({
storeId,
agentCode: agent.code,
agentName: agent.name || "",
status: "requested",
});

console.log(`📞 Appel proxy créé: ${storeId} → ${agent.code} (${proxy._id})`);

return res.json({
message: "Session d'appel créée. Le système Vocoshop va connecter votre appel.",
proxyId: proxy._id,
});
} catch (err) {
console.error("❌ initiateCall:", err);
return res.status(500).json({ error: "Erreur serveur" });
}
};
