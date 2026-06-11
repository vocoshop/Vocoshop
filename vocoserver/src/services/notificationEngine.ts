import Notification from "../models/Notification";
import { PushNotificationService } from "./pushNotificationService";

/**
=====================================================
🔥 NOTIFICATION ENGINE — V2 ULTRA PRO
✔ Anti duplication
✔ Anti spam
✔ UniqueKey intelligent
✔ Prêt pour automation moteur
=====================================================
*/

type CreateNotifParams = {
storeId: string;
title: string;
message: string;
type:
| "stock_low"
| "product_expiring"
| "subscription"
| "referral_bonus"
| "free_day"
| "system";

// ⭐ IMPORTANT POUR EVITER DUPLICATION
uniqueKey?: string;
};

/* =====================================================
🔥 CREATE NOTIFICATION SAFE
===================================================== */
export const createNotification = async ({
storeId,
title,
message,
type,
uniqueKey,
}: CreateNotifParams) => {
try {
if (!storeId) return;

/* =====================================================
⭐ ANTI DUPLICATE PROTECTION
===================================================== */

if (uniqueKey) {

const exists = await Notification.findOne({
storeId,
uniqueKey,
// Anti spam 12h
createdAt: {
$gte: new Date(Date.now() - 12 * 60 * 60 * 1000),
},
});

if (exists) {
console.log("⚠️ Notification déjà existante:", uniqueKey);
return;
}
}

await Notification.create({
  storeId,
  title,
  message,
  type,
  uniqueKey: uniqueKey || null,
  isRead: false,
});

console.log("🔔 Notification créée:", title);

PushNotificationService.sendToStore(storeId, title, message, { type });

} catch (e) {
console.log("❌ createNotification error", e);
}
};
