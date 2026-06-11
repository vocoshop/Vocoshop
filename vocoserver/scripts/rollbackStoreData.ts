import "dotenv/config";
import mongoose from "mongoose";

import Product from "../src/models/Product";
import StockLot from "../src/models/StockLot";
import StockHistory from "../src/models/StockHistory";

// 🔁 ID ACTUEL (après migration)
const NEW_STORE_ID = "6965a5f57ec159a37e4961ba";

// 🔙 ID À RESTAURER (choisis-en UN)
// ⚠️ Mets celui que tu veux restaurer
const ROLLBACK_TO_STORE_ID = "test-store-1";
// ex possible : "+242066604543"

// 🔐 Sécurité
const DRY_RUN = true;

async function main() {
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
console.error("❌ MONGO_URI manquant dans .env");
process.exit(1);
}

await mongoose.connect(mongoUri);
console.log("✅ MongoDB connecté (ROLLBACK)");

const tasks = [
{ name: "Product", model: Product },
{ name: "StockLot", model: StockLot },
{ name: "StockHistory", model: StockHistory },
] as const;

for (const t of tasks) {
const count = await (t.model as any).countDocuments({
storeId: NEW_STORE_ID,
});

console.log(`🔎 ${t.name}: docs à rollback = ${count}`);

if (count === 0) continue;

if (DRY_RUN) {
const sample = await (t.model as any)
.findOne({ storeId: NEW_STORE_ID })
.select("storeId")
.lean();

console.log(`🧪 Sample ${t.name}:`, sample);
continue;
}

const res = await (t.model as any).updateMany(
{ storeId: NEW_STORE_ID },
{ $set: { storeId: ROLLBACK_TO_STORE_ID } }
);

console.log(`↩️ ${t.name}: restaurés = ${res.modifiedCount}`);
}

await mongoose.disconnect();
console.log("🏁 Rollback terminé");
process.exit(0);
}

main().catch((e) => {
console.error("❌ Rollback error:", e);
process.exit(1);
});
