import "dotenv/config";
import mongoose from "mongoose";

import Product from "../src/models/Product";
import StockLot from "../src/models/StockLot";
import StockHistory from "../src/models/StockHistory";

const NEW_STORE_ID = "6965a5f57ec159a37e4961ba";
const OLD_IDS = ["test-store-1", "+242066604543", " +242066604543 "];

// ✅ sécurité
const DRY_RUN = true;

async function main() {
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
console.error("❌ MONGO_URI manquant dans .env");
process.exit(1);
}

await mongoose.connect(mongoUri);
console.log("✅ MongoDB connecté");

const tasks = [
{ name: "Product", model: Product },
{ name: "StockLot", model: StockLot },
{ name: "StockHistory", model: StockHistory },
] as const;

for (const t of tasks) {
const count = await (t.model as any).countDocuments({
storeId: { $in: OLD_IDS },
});

console.log(`🔎 ${t.name}: docs à migrer = ${count}`);

if (count === 0) continue;

if (DRY_RUN) {
// Debug simple (sans prise de tête TS)
const sample = await (t.model as any)
.findOne({ storeId: { $in: OLD_IDS } })
.select("storeId")
.lean();

console.log(`🧪 Sample ${t.name}:`, sample);
continue;
}

const res = await (t.model as any).updateMany(
{ storeId: { $in: OLD_IDS } },
{ $set: { storeId: NEW_STORE_ID } }
);

console.log(`✅ ${t.name}: modifiés = ${res.modifiedCount}`);
}

await mongoose.disconnect();
console.log("🏁 Terminé");
process.exit(0);
}

main().catch((e) => {
console.error("❌ Migration error:", e);
process.exit(1);
});
