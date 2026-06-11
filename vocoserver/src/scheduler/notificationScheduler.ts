import cron from "node-cron";
import Product from "../models/Product";
import { createNotification } from "../services/notificationEngine";
import { PushNotificationService } from "../services/pushNotificationService";

/**
=====================================================
🔥 NOTIFICATION SCHEDULER — VOCOSHOP CORE
Scan auto produits expirants
=====================================================
*/

export const startNotificationScheduler = () => {

console.log("🚀 Notification Scheduler démarré");

// toutes les 2 heures
cron.schedule("0 */2 * * *", async () => {

console.log("🔄 Scan automatique produits expirants...");

try {
const now = new Date();
const limit = new Date();
limit.setDate(now.getDate() + 7);
const BATCH_SIZE = 500;
let processed = 0;
let hasMore = true;

while (hasMore) {
const products: any[] = await Product.find({
expirationDates: { $exists: true, $not: { $size: 0 } }
})
.skip(processed)
.limit(BATCH_SIZE)
.lean();

if (products.length === 0) {
hasMore = false;
break;
}

for (const product of products) {
const isExpiringSoon = product.expirationDates.some((d: any) => {
const date = new Date(d);
return date >= now && date <= limit;
});

if (isExpiringSoon) {
await createNotification({
storeId: product.storeId,
title: "Produit bientôt expiré",
message: `${product.name} arrive bientôt à expiration.`,
type: "product_expiring",
uniqueKey: `expiring_${product._id}`
});
}
}

processed += products.length;
}

console.log("✅ Scan terminé");

} catch(e){
console.log("❌ scheduler error", e);
}

});

};
