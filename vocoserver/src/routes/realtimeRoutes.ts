import { Router } from "express";
import { onRealtimeEvent } from "../services/realtimeService";

const router = Router();

// Clients SSE connectés
const clients = new Set<any>();

/* =====================================================
GET /api/realtime/events — Flux SSE
===================================================== */
router.get("/events", (req: any, res: any) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const keepalive = setInterval(() => res.write(": keepalive\n\n"), 30000);

  clients.add(res);

  // Envoie l'historique récent (5 derniers events)
  const recent = recentEvents.slice(-5);
  recent.forEach((ev) => {
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  });

  res.write(`data: ${JSON.stringify({ type: "connected", message: "Connecté au flux temps réel" })}\n\n`);

  req.on("close", () => {
    clients.delete(res);
    clearInterval(keepalive);
  });
});

/* =====================================================
Historique des events (garder max 50)
===================================================== */
const recentEvents: any[] = [];
const MAX_HISTORY = 50;

/* =====================================================
Broadcast un event à tous les clients SSE
===================================================== */
export const broadcastSSE = (data: any) => {
  const payload = { ...data, _time: new Date().toISOString() };
  recentEvents.push(payload);
  if (recentEvents.length > MAX_HISTORY) recentEvents.shift();
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => {
    try { client.write(msg); } catch { clients.delete(client); }
  });
};

export default router;

// Pont entre le bus d'events et les clients SSE
onRealtimeEvent((data) => broadcastSSE(data));

