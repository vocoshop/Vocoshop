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

  console.log("\n📊 Creating indexes...\n");

  const indexes: { col: string; idx: Record<string, any>; name: string }[] = [
    { col: "users", idx: { store: 1 }, name: "users_store" },
    { col: "users", idx: { isActive: 1 }, name: "users_isActive" },
    { col: "users", idx: { deletedAt: 1 }, name: "users_deletedAt" },
    { col: "products", idx: { store: 1 }, name: "products_store" },
    { col: "products", idx: { store: 1, category: 1 }, name: "products_store_category" },
    { col: "products", idx: { name: "text" }, name: "products_name_text" },
    { col: "products", idx: { barcode: 1 }, name: "products_barcode" },
    { col: "sales", idx: { store: 1, createdAt: -1 }, name: "sales_store_createdAt" },
    { col: "sales", idx: { employee: 1 }, name: "sales_employee" },
    { col: "orders", idx: { store: 1, createdAt: -1 }, name: "orders_store_createdAt" },
    { col: "orders", idx: { status: 1 }, name: "orders_status" },
    { col: "inventorysessions", idx: { store: 1, createdAt: -1 }, name: "inventorysessions_store_createdAt" },
    { col: "invoices", idx: { store: 1, invoiceNumber: 1 }, name: "invoices_store_invoiceNumber" },
    { col: "notifications", idx: { store: 1, read: 1 }, name: "notifications_store_read" },
    { col: "stocklots", idx: { product: 1 }, name: "stocklots_product" },
    { col: "stocklots", idx: { store: 1 }, name: "stocklots_store" },
  ];

  for (const { col, idx, name } of indexes) {
    try {
      await db.collection(col).createIndex(idx, { background: true });
      console.log(`✅ ${col}: ${name}`);
    } catch (e: any) {
      if (e.code === 86) {
        console.log(`⚠️  ${col}: ${name} (already exists)`);
      } else {
        console.log(`❌ ${col}: ${name} - ${e.message}`);
      }
    }
  }

  console.log("\n🎉 Indexes created (or already exist)!");
  console.log("\nNote: Indexes are created in background (non-blocking).\n");
  
  await mongoose.disconnect();
  console.log("👋 Disconnected");
  process.exit(0);
}

createIndexes().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});