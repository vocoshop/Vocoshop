// controllers/storeAgentController.ts
import { Request, Response } from "express";
import Agent from "../models/Agent";

/* =====================================================
GET /api/store/my-agent
===================================================== */
export const getMyAgent = async (req: Request, res: Response) => {
try {
const agentCode = String(req.user?.agentCode || "").trim();

if (!agentCode) {
return res.json({
hasAgent: false,
message: "Aucun agent assigné",
});
}

const agent = await Agent.findOne({ code: agentCode })
.select("name phone code city region lastLoginAt")
.lean();

if (!agent) {
return res.json({
hasAgent: false,
message: "Agent introuvable",
});
}

return res.json({
hasAgent: true,
agent: {
name: agent.name,
phone: agent.phone,
code: agent.code,
city: agent.city || "",
region: agent.region || "",
lastLoginAt: agent.lastLoginAt || null,
},
});
} catch (e) {
console.error("❌ getMyAgent:", e);
return res.status(500).json({ error: "Erreur serveur" });
}
};
