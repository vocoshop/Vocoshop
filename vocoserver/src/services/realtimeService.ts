// Exporté comme singleton — les contrôleurs appellent emitActivity()
// et realtimeRoutes.ts écoute via broadcastSSE

type Listener = (data: any) => void;
const listeners = new Set<Listener>();

export const onRealtimeEvent = (fn: Listener) => { listeners.add(fn); return () => listeners.delete(fn); };

export const emitActivity = (type: string, label: string, detail: string, meta?: any) => {
  const payload = { type, label, detail, meta, _time: new Date().toISOString() };
  listeners.forEach((fn) => { try { fn(payload); } catch {} });
};
