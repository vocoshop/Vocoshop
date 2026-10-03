import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "";

async function createIndexes() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not found in .env");
    process.exit(1);
  }

  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected!");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("❌ No database connection");
    process.exit(1);
  }

  // Import après connexion : les modèles s'enregistrent sur la connexion par défaut
  const { default: Store } = await import("../models/Store");
  const { default: User } = await import("../models/User");
  const { default: Product } = await import("../models/Product");
  const { default: Sales } = await import("../models/Sales");
  const { default: Order } = await import("../models/Order");
  const { default: InventorySession } = await import("../models/InventorySession");
  const { default: InventoryHistory } = await import("../models/InventoryHistory");
  const { default: StockHistory } = await import("../models/StockHistory");
  const { default: StockLot } = await import("../models/StockLot");
  const { default: Invoice } = await import("../models/Invoice");
  const { default: Notification } = await import("../models/Notification");
  const { default: Commission } = await import("../models/Commission");
  const { default: ActivityLog } = await import("../models/ActivityLog");
  const { default: Agent } = await import("../models/Agent");

  // Les schémas Mongoose sont la source de vérité (évite les champs obsolètes
  // du type `store` / `read` qui ne correspondent plus aux modèles actuels).
  const models = [
    Store,
    User,
    Product,
    Sales,
    Order,
    InventorySession,
    InventoryHistory,
    StockHistory,
    StockLot,
    Invoice,
    Notification,
    Commission,
    ActivityLog,
    Agent,
  ];

  console.log("\n📊 Creating indexes from model schemas...\n");

  let created = 0;
  let failed = 0;

  for (const model of models) {
    const name = model.collection.collectionName;
    try {
      await model.createIndexes();
      const specs = model.schema.indexes();
      created += specs.length;
      console.log(`✅ ${name}: ${specs.length} index(es)`);
    } catch (e: any) {
      failed++;
      console.log(`❌ ${name}: ${e.message}`);
    }
  }

  console.log(`\n🎉 Done: ${created} index(es) ensured, ${failed} collection(s) failed.`);

  await mongoose.disconnect();
  console.log("👋 Disconnected");
  process.exit(failed > 0 ? 1 : 0);
}

createIndexes().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});