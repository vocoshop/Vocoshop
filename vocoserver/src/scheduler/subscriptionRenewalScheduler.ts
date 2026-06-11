import cron from "node-cron";
import Store from "../models/Store";
import { createNotification } from "../services/notificationEngine";

export const startSubscriptionRenewalScheduler = () => {
  console.log("🚀 Notification renouvellement abonnement démarré");

  // 8h et 18h chaque jour
  cron.schedule("0 8,18 * * *", async () => {
    console.log("🔄 Vérification abonnements expirants...");

    try {
      const now = new Date();
      const dans3Jours = new Date(now);
      dans3Jours.setDate(dans3Jours.getDate() + 3);
      const BATCH_SIZE = 500;
      let count = 0;
      let processed = 0;
      let hasMore = true;

      while (hasMore) {
        const stores: any[] = await Store.find({
          paidUntil: { $ne: null },
        })
          .skip(processed)
          .limit(BATCH_SIZE)
          .lean();

        if (stores.length === 0) {
          hasMore = false;
          break;
        }

        for (const store of stores) {
          const paidUntil = new Date(store.paidUntil);

          if (paidUntil > now && paidUntil <= dans3Jours) {
            const jours = Math.ceil((paidUntil.getTime() - now.getTime()) / 86400000);
            await createNotification({
              storeId: String(store._id),
              title: "Abonnement bientôt expiré",
              message: `Il vous reste ${jours} jour${jours > 1 ? 's' : ''}. Cliquez ici pour renouveler votre abonnement.`,
              type: "subscription",
              uniqueKey: `expiring_${store._id}`,
            });
            count++;
          }

          if (paidUntil <= now) {
            await createNotification({
              storeId: String(store._id),
              title: "Abonnement expiré",
              message: "Votre abonnement a expiré. Cliquez ici pour le réactiver dès maintenant.",
              type: "subscription",
              uniqueKey: `expired_${store._id}`,
            });
            count++;
          }
        }

        processed += stores.length;
      }

      console.log(`✅ ${count} notification(s) de renouvellement envoyée(s)`);
    } catch (e) {
      console.error("❌ subscriptionRenewalScheduler error", e);
    }
  });
};
