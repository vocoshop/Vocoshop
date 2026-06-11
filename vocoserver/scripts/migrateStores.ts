import "dotenv/config";
import mongoose from "mongoose";
import Store from "../src/models/Store";
import crypto from "crypto";

function generateShopId(): string {
// Très faible risque de collision
const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
return `VOC-${code}`;
}

async function main() {
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
console.error("❌ MONGO_URI manquant dans .env");
process.exit(1);
}

await mongoose.connect(mongoUri);
console.log("✅ MongoDB connecté");

const stores = await Store.find({
$or: [
{ shopId: { $exists: false } },
{ shopId: null },
{ shopId: "" },
{ referralCode: { $exists: false } },
{ referralCode: null },
{ referralCode: "" },
{ plan: { $exists: false } },
{ referredCount: { $exists: false } },
],
});

console.log(`🔎 Stores à migrer: ${stores.length}`);

let updated = 0;

for (const s of stores) {
// plan
if (!s.plan) s.plan = "Essai gratuit";

// referredCount
if (typeof s.referredCount !== "number") s.referredCount = 0;

// shopId / referralCode
if (!s.shopId) {
// retry en cas de collision unique
for (let i = 0; i < 10; i++) {
const id = generateShopId();
const exists = await Store.exists({ shopId: id });
if (!exists) {
s.shopId = id;
break;
}
}
}

if (!s.referralCode) {
// Par défaut = shopId
s.referralCode = s.shopId;
}

// sauver
await s.save();
updated++;
}

console.log(`✅ Migration terminée. Stores mis à jour: ${updated}`);

await mongoose.disconnect();
process.exit(0);
}

main().catch((e) => {
console.error("❌ Migration error:", e);
process.exit(1);
});
