// scripts/backfillActivities.ts
// Génère les logs d'activité pour les données existantes
import mongoose from "mongoose";
import Store from "../models/Store";
import Commission from "../models/Commission";
import Withdrawal from "../models/Withdrawal";
import ActivityLog from "../models/ActivityLog";

const MONGO_URI = process.env.MONGO_URI;

async function backfill() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI non définie. Définissez-la dans .env");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log("Connecté à MongoDB");

  let total = 0;

  // 1. Stores onboardés
  const stores = await Store.find({
    agentCode: { $ne: "", $exists: true },
    isOnboarded: true,
  }).lean();

  for (const s of stores as any[]) {
    const exists = await ActivityLog.findOne({
      agentCode: s.agentCode,
      storeId: String(s._id),
      type: "store_onboarded",
    });
    if (!exists) {
      await ActivityLog.create({
        agentCode: s.agentCode,
        storeId: String(s._id),
        storeName: s.storeName || "",
        type: "store_onboarded",
        message: `${s.storeName} — Installation terminée`,
        icon: "✅",
        createdAt: s.updatedAt || s.createdAt || new Date(),
      });
      total++;
    }
  }

  // 2. Abonnements activés (stores avec subscriptionStatus active)
  const activeStores = await Store.find({
    agentCode: { $ne: "", $exists: true },
    subscriptionStatus: "active",
  }).lean();

  for (const s of activeStores as any[]) {
    const exists = await ActivityLog.findOne({
      agentCode: s.agentCode,
      storeId: String(s._id),
      type: "subscription_activated",
    });
    if (!exists) {
      await ActivityLog.create({
        agentCode: s.agentCode,
        storeId: String(s._id),
        storeName: s.storeName || "",
        type: "subscription_activated",
        message: `${s.storeName} — Abonnement activé`,
        icon: "✅",
        createdAt: s.paidUntil || s.updatedAt || new Date(),
      });
      total++;
    }
  }

  // 3. Commissions
  const commissions = await Commission.find({
    agentCode: { $ne: "", $exists: true },
  }).lean();

  for (const c of commissions as any[]) {
    const exists = await ActivityLog.findOne({
      agentCode: c.agentCode,
      type: "commission_earned",
      storeId: String(c.storeId || ""),
      createdAt: c.createdAt || new Date(),
    });
    if (!exists) {
      await ActivityLog.create({
        agentCode: c.agentCode,
        storeId: String(c.storeId || ""),
        storeName: c.storeName || "",
        type: "commission_earned",
        message: `Commission reçue — ${c.storeName}`,
        icon: "💰",
        createdAt: c.createdAt || new Date(),
      });
      total++;
    }
  }

  // 4. Retraits
  const withdrawals = await Withdrawal.find({
    agentCode: { $ne: "", $exists: true },
  }).lean();

  for (const w of withdrawals as any[]) {
    const exists = await ActivityLog.findOne({
      agentCode: w.agentCode,
      type: "withdrawal_requested",
      createdAt: w.createdAt,
    });
    if (!exists) {
      await ActivityLog.create({
        agentCode: w.agentCode,
        type: "withdrawal_requested",
        message: `Retrait de ${(w.amount || 0).toLocaleString()} FCFA demandé`,
        icon: "💳",
        createdAt: w.createdAt || new Date(),
      });
      total++;
    }
  }

  console.log(`✅ Backfill terminé : ${total} activités créées`);
  await mongoose.disconnect();
}

backfill().catch((e) => {
  console.error("❌ Backfill error:", e);
  process.exit(1);
});
