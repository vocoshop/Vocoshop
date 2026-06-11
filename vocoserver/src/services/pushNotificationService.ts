// services/pushNotificationService.ts
import PushToken from "../models/PushToken";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export const PushNotificationService = {
  async sendToStore(storeId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    try {
      const tokens = await PushToken.find({ storeId, isActive: true }).select("token").lean();
      if (tokens.length === 0) return;

      const messages = tokens.map((t: any) => ({
        to: t.token,
        title,
        body,
        data: { storeId, ...data },
        priority: "high",
      }));

      await Promise.all(messages.map(msg => this.sendToExpo(msg)));
    } catch (e) {
      console.error("❌ push sendToStore:", e);
    }
  },

  async sendToAllStores(title: string, body: string, data?: Record<string, string>): Promise<{ sent: number; failed: number }> {
    try {
      const tokens = await PushToken.find({ isActive: true }).select("token storeId").lean();
      if (tokens.length === 0) return { sent: 0, failed: 0 };

      const messages = tokens.map((t: any) => ({
        to: t.token,
        title,
        body,
        data: { storeId: String(t.storeId), ...data },
        priority: "high",
      }));

      const results = await Promise.allSettled(messages.map(msg => this.sendToExpo(msg)));
      const sent = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;
      return { sent, failed };
    } catch (e) {
      console.error("❌ push sendToAllStores:", e);
      return { sent: 0, failed: 0 };
    }
  },

  async sendToAgent(agentCode: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    try {
      const Store = require("../models/Store").default;
      const storeIds = await Store.find({ agentCode }).distinct("_id");
      const tokens = await PushToken.find({ storeId: { $in: storeIds }, isActive: true }).select("token").lean();

      const messages = tokens.map((t: any) => ({
        to: t.token,
        title,
        body,
        data: { agentCode, ...data },
        priority: "high",
      }));

      await Promise.all(messages.map(msg => this.sendToExpo(msg)));
    } catch (e) {
      console.error("❌ push sendToAgent:", e);
    }
  },

  async sendToExpo(message: any): Promise<void> {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
    } catch (e) {
      throw e;
    }
  },
};