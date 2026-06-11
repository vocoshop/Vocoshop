import Commission from "../models/Commission";
import Store from "../models/Store";

const COMMISSION_PER_STORE = 800;

export async function generateCommissions(agentCode: string, month?: number, year?: number) {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();

  const stores = await Store.find({
    agentCode,
    subscriptionStatus: "active",
  }).select("_id storeName").lean();

  for (const store of stores) {
    try {
      await Commission.updateOne(
        { agentCode, storeId: store._id, month: m, year: y },
        {
          $setOnInsert: {
            agentCode,
            storeId: store._id,
            storeName: store.storeName || "",
            amount: COMMISSION_PER_STORE,
            month: m,
            year: y,
            status: "pending",
          },
        },
        { upsert: true }
      );
    } catch {
      // doublon ignoré
    }
  }
}

export async function getAgentCommissions(agentCode: string) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Mois courant
  await generateCommissions(agentCode, currentMonth, currentYear);

  // Backfill historique
  const stores = await Store.find({
    agentCode,
    subscriptionStatus: "active",
  }).select("_id storeName billingCycleCount createdAt").lean();

  for (const store of stores) {
    const monthsBack = Math.min(store.billingCycleCount || 0, 12);
    for (let i = 0; i <= monthsBack; i++) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) { m += 12; y -= 1; }
      if (y < 2024) continue;

      try {
        await Commission.updateOne(
          { agentCode, storeId: store._id, month: m, year: y },
          {
            $setOnInsert: {
              agentCode,
              storeId: store._id,
              storeName: store.storeName || "",
              amount: COMMISSION_PER_STORE,
              month: m,
              year: y,
              status: "pending",
            },
          },
          { upsert: true }
        );
      } catch {
        // doublon ignoré
      }
    }
  }

  const commissions = await Commission.find({ agentCode })
    .sort({ year: -1, month: -1, createdAt: -1 })
    .lean();

  return commissions.map((c) => ({
    id: String(c._id),
    storeId: String(c.storeId),
    storeName: c.storeName,
    amount: c.amount,
    type: "Abonnement",
    month: c.month,
    year: c.year,
    status: c.status,
    paidAt: c.paidAt,
    createdAt: c.createdAt,
  }));
}
