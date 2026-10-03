import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import Store from "../models/Store";
import Agent from "../models/Agent";
import Notification from "../models/Notification";
import Invoice from "../models/Invoice";
import { isValidObjectId } from "../utils/helpers";

const CONFIRMATION_ISSUER = "voco-ai";
const CONFIRMATION_AUDIENCE = "voco-ai-admin";
const CONFIRMATION_TTL = "2m";
const MAX_PARAMS_BYTES = 4096;
const MAX_PARAM_VALUE_LENGTH = 2000;

const SUPPORTED_COMMANDS = new Set([
  "suspendre_boutique",
  "suspend_store",
  "activer_boutique",
  "activate_store",
  "approuver_agent",
  "approve_agent",
  "rejeter_agent",
  "reject_agent",
  "suspendre_agent",
  "suspend_agent",
  "etendre_abonnement",
  "extend_subscription",
  "envoyer_notification",
  "send_notification",
  "suspendre_par_agent",
  "suspend_by_agent",
]);

const ALLOWED_PARAM_KEYS = new Set([
  "storeId",
  "id",
  "code",
  "days",
  "title",
  "message",
  "agentCode",
]);

function str(v: any): string {
  return typeof v === "string" ? v.trim() : String(v || "").trim();
}

function boundedText(v: any, maxLength: number, fallback = ""): string {
  const value = str(v);
  return value ? value.slice(0, maxLength) : fallback;
}

function safeInt(v: any, def: number, min: number, max: number): number {
  const parsed = parseInt(v, 10);
  const value = Number.isFinite(parsed) ? parsed : def;
  return Math.min(max, Math.max(min, value));
}

function normalizeCommand(command: any): string {
  return str(command)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isSupportedCommand(command: any): command is string {
  return SUPPORTED_COMMANDS.has(normalizeCommand(command));
}

function pickStoreQuery(params?: any): { storeId: string } | { _id: string } | null {
  const raw = params?.storeId || params?.id;
  if (!raw) return null;
  const s = str(raw);
  if (isValidObjectId(s)) return { _id: s };
  return { storeId: s };
}

function pickAgentQuery(params?: any): { code: string } | { _id: string } | null {
  const raw = params?.code || params?.id;
  if (!raw) return null;
  const s = str(raw);
  if (isValidObjectId(s)) return { _id: s };
  return { code: s };
}

function sanitizeParams(params: any): Record<string, any> {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params).slice(0, 12)) {
    if (!ALLOWED_PARAM_KEYS.has(key)) continue;
    if (key === "days") {
      sanitized[key] = safeInt(value, 30, 1, 365);
    } else if (typeof value === "string") {
      sanitized[key] = value.slice(0, MAX_PARAM_VALUE_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function confirmationSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET manquant");
  return secret;
}

async function executeAction(command: string, params?: any): Promise<CommandResult> {
  const cmd = normalizeCommand(command);
  const safeParams = sanitizeParams(params);

  if (cmd === "suspendre_boutique" || cmd === "suspend_store") {
    const q = pickStoreQuery(safeParams);
    if (!q) return { success: false, action: "suspendre_boutique", message: "ID boutique requis" };
    const store = await Store.findOne(q).select("_id storeName subscriptionStatus");
    if (!store) return { success: false, action: "suspendre_boutique", message: "Boutique non trouvée" };
    await Store.updateOne({ _id: (store as any)._id }, { $set: { subscriptionStatus: "suspended" } });
    return { success: true, action: "suspendre_boutique", message: `Boutique "${store.storeName}" suspendue avec succès`, details: { storeName: store.storeName } };
  }

  if (cmd === "activer_boutique" || cmd === "activate_store") {
    const q = pickStoreQuery(safeParams);
    if (!q) return { success: false, action: "activer_boutique", message: "ID boutique requis" };
    const store = await Store.findOne(q).select("_id storeName subscriptionStatus");
    if (!store) return { success: false, action: "activer_boutique", message: "Boutique non trouvée" };
    const now = new Date();
    now.setDate(now.getDate() + 30);
    await Store.updateOne({ _id: (store as any)._id }, { $set: { subscriptionStatus: "active", paidUntil: now } });
    return { success: true, action: "activer_boutique", message: `Boutique "${store.storeName}" réactivée pour 30 jours`, details: { storeName: store.storeName, paidUntil: now } };
  }

  if (cmd === "approuver_agent" || cmd === "approve_agent") {
    const q = pickAgentQuery(safeParams);
    if (!q) return { success: false, action: "approuver_agent", message: "Code ou ID agent requis" };
    const agent = await Agent.findOne(q).select("_id name code isApproved");
    if (!agent) return { success: false, action: "approuver_agent", message: "Agent non trouvé" };
    await Agent.updateOne({ _id: (agent as any)._id }, { $set: { isApproved: true, isActive: true } });
    return { success: true, action: "approuver_agent", message: `Agent "${agent.name}" approuvé avec succès`, details: { name: agent.name, code: agent.code } };
  }

  if (cmd === "rejeter_agent" || cmd === "reject_agent") {
    const q = pickAgentQuery(safeParams);
    if (!q) return { success: false, action: "rejeter_agent", message: "Code ou ID agent requis" };
    const agent = await Agent.findOne(q).select("_id name code isApproved");
    if (!agent) return { success: false, action: "rejeter_agent", message: "Agent non trouvé" };
    await Agent.updateOne({ _id: (agent as any)._id }, { $set: { isApproved: false, isActive: false } });
    return { success: true, action: "rejeter_agent", message: `Candidature de "${agent.name}" rejetée`, details: { name: agent.name } };
  }

  if (cmd === "suspendre_agent" || cmd === "suspend_agent") {
    const q = pickAgentQuery(safeParams);
    if (!q) return { success: false, action: "suspendre_agent", message: "Code ou ID agent requis" };
    const agent = await Agent.findOne(q).select("_id name code isActive");
    if (!agent) return { success: false, action: "suspendre_agent", message: "Agent non trouvé" };
    await Agent.updateOne({ _id: (agent as any)._id }, { $set: { isActive: false } });
    return { success: true, action: "suspendre_agent", message: `Agent "${agent.name}" suspendu`, details: { name: agent.name } };
  }

  if (cmd === "etendre_abonnement" || cmd === "extend_subscription") {
    const q = pickStoreQuery(safeParams);
    if (!q) return { success: false, action: "etendre_abonnement", message: "ID boutique requis" };
    const store = await Store.findOne(q).select("_id storeName paidUntil subscriptionStatus");
    if (!store) return { success: false, action: "etendre_abonnement", message: "Boutique non trouvée" };
    const days = safeInt(safeParams.days, 30, 1, 365);
    const currentPaid = (store as any).paidUntil ? new Date((store as any).paidUntil) : new Date();
    if (currentPaid < new Date()) currentPaid.setTime(Date.now());
    currentPaid.setDate(currentPaid.getDate() + days);
    await Store.updateOne({ _id: (store as any)._id }, { $set: { paidUntil: currentPaid, subscriptionStatus: "active" } });
    return { success: true, action: "etendre_abonnement", message: `Abonnement de "${store.storeName}" extendu de +${days} jours`, details: { storeName: store.storeName, paidUntil: currentPaid } };
  }

  if (cmd === "envoyer_notification" || cmd === "send_notification") {
    const storeId = str(safeParams.storeId);
    if (!storeId) return { success: false, action: "envoyer_notification", message: "ID boutique requis" };
    const q = isValidObjectId(storeId) ? { _id: storeId } : { storeId };
    const store = await Store.findOne(q).select("_id storeName");
    if (!store) return { success: false, action: "envoyer_notification", message: "Boutique non trouvée" };
    await Notification.create({
      storeId: (store as any)._id,
      title: boundedText(safeParams.title, 120, "Notification VocoAI"),
      message: boundedText(safeParams.message, MAX_PARAM_VALUE_LENGTH, "Message de l'administrateur"),
      type: "system",
      isRead: false,
    });
    return { success: true, action: "envoyer_notification", message: `Notification envoyée à "${store.storeName}"`, details: { storeName: store.storeName, title: boundedText(safeParams.title, 120) } };
  }

  if (cmd === "suspendre_par_agent" || cmd === "suspend_by_agent") {
    const agentCode = str(safeParams.agentCode);
    if (!agentCode) return { success: false, action: "suspendre_par_agent", message: "Code agent requis" };
    const result = await Store.updateMany({ agentCode }, { $set: { subscriptionStatus: "suspended" } });
    return { success: true, action: "suspendre_par_agent", message: `${result.modifiedCount} boutique(s) de l'agent ${agentCode} suspendue(s)`, details: { agentCode, count: result.modifiedCount } };
  }

  return { success: false, action: cmd, message: "Commande inconnue" };
}

export interface CommandResult {
  success: boolean;
  action: string;
  message: string;
  details?: any;
}

export interface PendingAIAction {
  command: string;
  params: Record<string, any>;
  actorId: string;
}

export const AICommandExecutor = {
  isSupportedCommand,

  createConfirmationToken(command: string, params: any, actorId: string): string {
    if (!isSupportedCommand(command) || !actorId) throw new Error("Commande non autorisée");

    const safeParams = sanitizeParams(params);
    const payload = JSON.stringify(safeParams);
    if (Buffer.byteLength(payload, "utf8") > MAX_PARAMS_BYTES) {
      throw new Error("Paramètres trop volumineux");
    }

    return jwt.sign(
      {
        type: "voco_ai_action",
        command: normalizeCommand(command),
        params: safeParams,
        actorId,
      },
      confirmationSecret(),
      {
        audience: CONFIRMATION_AUDIENCE,
        issuer: CONFIRMATION_ISSUER,
        expiresIn: CONFIRMATION_TTL,
        jwtid: randomUUID(),
      }
    );
  },

  verifyConfirmationToken(token: any, actorId: string): PendingAIAction | null {
    if (typeof token !== "string" || token.length === 0 || token.length > 8192 || !actorId) return null;

    try {
      const decoded: any = jwt.verify(token, confirmationSecret(), {
        audience: CONFIRMATION_AUDIENCE,
        issuer: CONFIRMATION_ISSUER,
      });
      if (
        decoded?.type !== "voco_ai_action" ||
        decoded?.actorId !== actorId ||
        !isSupportedCommand(decoded?.command)
      ) {
        return null;
      }

      return {
        command: normalizeCommand(decoded.command),
        params: sanitizeParams(decoded.params),
        actorId,
      };
    } catch {
      return null;
    }
  },

  async executeConfirmed(token: string, actorId: string): Promise<CommandResult> {
    const pending = AICommandExecutor.verifyConfirmationToken(token, actorId);
    if (!pending) {
      return { success: false, action: "confirmation", message: "Confirmation invalide ou expirée" };
    }
    return executeAction(pending.command, pending.params);
  },

  async parseUserIntent(userMessage: string): Promise<{ command: string; params: any } | null> {
    if (typeof userMessage !== "string" || userMessage.length > 4000) return null;
    const msg = userMessage.toLowerCase();

    const patterns: { regex: RegExp; command: string; extract: (m: RegExpMatchArray) => any }[] = [
      { regex: /suspendre.*boutique.*(?:id[:\s]*)?(\w+)/i, command: "suspendre_boutique", extract: m => ({ storeId: m[1] }) },
      { regex: /suspendre.*(?:boutique\s+)?(\w+)/i, command: "suspendre_boutique", extract: m => ({ storeId: m[1] }) },
      { regex: /activer.*(?:boutique\s+)?(\w+)/i, command: "activer_boutique", extract: m => ({ storeId: m[1] }) },
      { regex: /approuver.*agent\s+(.+)/i, command: "approuver_agent", extract: m => ({ code: m[1].trim() }) },
      { regex: /rejeter.*agent\s+(.+)/i, command: "rejeter_agent", extract: m => ({ code: m[1].trim() }) },
      { regex: /suspendre.*agent\s+(.+)/i, command: "suspendre_agent", extract: m => ({ code: m[1].trim() }) },
      { regex: /etendre.*(\d+)\s*jours?/i, command: "etendre_abonnement", extract: m => ({ days: parseInt(m[1]) }) },
      { regex: /etendre\s+(?:boutique\s+)?(\w+).*(\d+)\s*jours?/i, command: "etendre_abonnement", extract: m => ({ storeId: m[1], days: parseInt(m[2]) }) },
      { regex: /notifier\s+(?:\w+).*[:\s]*(.+)/i, command: "envoyer_notification", extract: m => ({ message: m[1] }) },
      { regex: /suspendre toutes les boutiques de ([\w]+)/i, command: "suspendre_par_agent", extract: m => ({ agentCode: m[1] }) },
    ];

    for (const p of patterns) {
      const match = msg.match(p.regex);
      if (match) {
        return { command: p.command, params: p.extract(match) };
      }
    }

    return null;
  },
};
