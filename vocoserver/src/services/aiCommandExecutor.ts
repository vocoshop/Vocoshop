// services/aiCommandExecutor.ts
import Store from "../models/Store";
import Agent from "../models/Agent";
import Notification from "../models/Notification";
import Invoice from "../models/Invoice";

export interface CommandResult {
  success: boolean;
  action: string;
  message: string;
  details?: any;
}

export const AICommandExecutor = {
  async execute(command: string, params?: any, adminToken?: string): Promise<CommandResult> {
    const cmd = command.toLowerCase();

    // SUSPENDRE BOUTIQUE
    if (cmd === "suspendre_boutique" || cmd === "suspend_store") {
      const store = await Store.findOne({ storeId: params?.storeId || params?.id }).select("_id storeName subscriptionStatus");
      if (!store) return { success: false, action: "suspendre_boutique", message: "Boutique non trouvée" };
      await Store.updateOne({ _id: (store as any)._id }, { $set: { subscriptionStatus: "suspended" } });
      return { success: true, action: "suspendre_boutique", message: `Boutique "${store.storeName}" suspendue avec succès`, details: { storeName: store.storeName } };
    }

    // ACTIVER BOUTIQUE
    if (cmd === "activer_boutique" || cmd === "activate_store") {
      const store = await Store.findOne({ storeId: params?.storeId || params?.id }).select("_id storeName subscriptionStatus");
      if (!store) return { success: false, action: "activer_boutique", message: "Boutique non trouvée" };
      const now = new Date();
      now.setDate(now.getDate() + 30);
      await Store.updateOne({ _id: (store as any)._id }, { $set: { subscriptionStatus: "active", paidUntil: now } });
      return { success: true, action: "activer_boutique", message: `Boutique "${store.storeName}" réactivée pour 30 jours`, details: { storeName: store.storeName, paidUntil: now } };
    }

    // APPROUVER AGENT
    if (cmd === "approuver_agent" || cmd === "approve_agent") {
      const agent = await Agent.findOne({ code: params?.code || params?.id }).select("_id name code isApproved");
      if (!agent) return { success: false, action: "approuver_agent", message: "Agent non trouvé" };
      await Agent.updateOne({ _id: (agent as any)._id }, { $set: { isApproved: true, isActive: true } });
      return { success: true, action: "approuver_agent", message: `Agent "${agent.name}" approuvé avec succès`, details: { name: agent.name, code: agent.code } };
    }

    // REJETER AGENT
    if (cmd === "rejeter_agent" || cmd === "reject_agent") {
      const agent = await Agent.findOne({ code: params?.code || params?.id }).select("_id name code isApproved");
      if (!agent) return { success: false, action: "rejeter_agent", message: "Agent non trouvé" };
      await Agent.updateOne({ _id: (agent as any)._id }, { $set: { isApproved: false, isActive: false } });
      return { success: true, action: "rejeter_agent", message: `Candidature de "${agent.name}" rejetée`, details: { name: agent.name } };
    }

    // SUSPENDRE AGENT
    if (cmd === "suspendre_agent" || cmd === "suspend_agent") {
      const agent = await Agent.findOne({ code: params?.code || params?.id }).select("_id name code isActive");
      if (!agent) return { success: false, action: "suspendre_agent", message: "Agent non trouvé" };
      await Agent.updateOne({ _id: (agent as any)._id }, { $set: { isActive: false } });
      return { success: true, action: "suspendre_agent", message: `Agent "${agent.name}" suspendu`, details: { name: agent.name } };
    }

    // EXTENDRE ABONNEMENT
    if (cmd === "etendre_abonnement" || cmd === "extend_subscription") {
      const store = await Store.findOne({ storeId: params?.storeId || params?.id }).select("_id storeName paidUntil subscriptionStatus");
      if (!store) return { success: false, action: "etendre_abonnement", message: "Boutique non trouvée" };
      const days = params?.days || 30;
      const currentPaid = (store as any).paidUntil ? new Date((store as any).paidUntil) : new Date();
      if (currentPaid < new Date()) currentPaid.setTime(Date.now());
      currentPaid.setDate(currentPaid.getDate() + days);
      await Store.updateOne({ _id: (store as any)._id }, { $set: { paidUntil: currentPaid, subscriptionStatus: "active" } });
      return { success: true, action: "etendre_abonnement", message: `Abonnement de "${store.storeName}" extendu de +${days} jours`, details: { storeName: store.storeName, paidUntil: currentPaid } };
    }

    // ENVOYER NOTIFICATION
    if (cmd === "envoyer_notification" || cmd === "send_notification") {
      if (!params?.storeId) return { success: false, action: "envoyer_notification", message: "ID boutique requis" };
      const store = await Store.findOne({ storeId: params.storeId }).select("_id storeName");
      if (!store) return { success: false, action: "envoyer_notification", message: "Boutique non trouvée" };
      await Notification.create({
        storeId: (store as any)._id,
        title: params.title || "Notification VocoAI",
        message: params.message || "Message de l'administrateur",
        type: "system",
        isRead: false,
      });
      return { success: true, action: "envoyer_notification", message: `Notification envoyée à "${store.storeName}"`, details: { storeName: store.storeName, title: params.title } };
    }

    // SUSPENDRE PAR AGENT CODE
    if (cmd === "suspendre_par_agent" || cmd === "suspend_by_agent") {
      if (!params?.agentCode) return { success: false, action: "suspendre_par_agent", message: "Code agent requis" };
      const result = await Store.updateMany({ agentCode: params.agentCode }, { $set: { subscriptionStatus: "suspended" } });
      return { success: true, action: "suspendre_par_agent", message: `${result.modifiedCount} boutique(s) de l'agent ${params.agentCode} suspendue(s)`, details: { agentCode: params.agentCode, count: result.modifiedCount } };
    }

    return { success: false, action: cmd, message: "Commande inconnue" };
  },

  async parseUserIntent(userMessage: string): Promise<{ command: string; params: any } | null> {
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