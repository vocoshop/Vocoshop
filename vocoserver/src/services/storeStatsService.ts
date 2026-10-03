import Store from "../models/Store";

/* =====================================================
📊 SERVICE STATS BOUTIQUES — AGRÉGATIONS MONGO
Replaces les full-scan `Store.find()` par des agrégations
indexées qui calculent les compteurs côté serveur.
Chaque fonction retourne les mêmes compteurs que
l'ancienne logique in-memory, sans charger les
collections en mémoire.
===================================================== */

/* =====================================================
Compteurs globaux de boutiques (stats admin)
Retourne le nombre total de boutiques, par statut
d'abonnement.
===================================================== */
export async function getStoreStats(): Promise<Record<string, number>> {
  const now = new Date();

  const result = await Store.aggregate([
    {
      $project: {
        _id: 0,
        _status: {
          $switch: {
            branches: [
              { case: { $and: [{ $ne: [{ $ifNull: ["$paidUntil", null] }, null] }, { $gt: ["$paidUntil", now] }] }, then: "active" },
              { case: { $and: [{ $ne: [{ $ifNull: ["$graceUntil", null] }, null] }, { $gt: ["$graceUntil", now] }] }, then: "grace" },
              { case: { $ne: [{ $ifNull: ["$paidUntil", null] }, null] }, then: "expired" },
              { case: { $and: [{ $ne: [{ $ifNull: ["$trialEnd", null] }, null] }, { $gt: ["$trialEnd", now] }] }, then: "trial" },
              { case: { $ne: [{ $ifNull: ["$trialEnd", null] }, null] }, then: "expired" },
            ],
            default: { $ifNull: ["$subscriptionStatus", "trial"] },
          },
        },
      },
    },
    {
      $group: {
        _id: "$_status",
        count: { $sum: 1 },
      },
    },
  ]);

  const stats: Record<string, number> = {
    active: 0,
    trial: 0,
    grace: 0,
    expired: 0,
    unused: 0,
  };

  (result as any[]).forEach((row) => {
    const key = String(row._id || "unused");
    stats[key] = (stats[key] || 0) + (row.count || 0);
  });

  return stats;
}

/* =====================================================
Compteurs par agent (dashboard manager)
Retourne pour chaque agentCode : total, active, inactives
===================================================== */
export async function getAgentStoreStats(agentCodes?: string[]): Promise<
  Record<string, { total: number; active: number; inactive: number }>
> {
  const pipeline: any[] = [];

  if (Array.isArray(agentCodes)) {
    if (agentCodes.length === 0) return {};
    pipeline.push({ $match: { agentCode: { $in: agentCodes } } });
  }

  const result = await Store.aggregate([
    ...pipeline,
    {
      $group: {
        _id: "$agentCode",
        total: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $eq: ["$subscriptionStatus", "active"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const stats: Record<string, { total: number; active: number; inactive: number }> = {};
  (result as any[]).forEach((row) => {
    const code = (row._id || "").toString();
    if (!code) return;
    stats[code] = {
      total: row.total || 0,
      active: row.active || 0,
      inactive: (row.total || 0) - (row.active || 0),
    };
  });

  return stats;
}

/* =====================================================
Top villes (groupBy city sans regex)
===================================================== */
export async function getTopCities(limit = 10): Promise<
  { city: string; count: number }[]
> {
  const result = await Store.aggregate([
    {
      $match: {
        city: { $exists: true, $nin: ["", null] },
      },
    },
    {
      $group: {
        _id: "$city",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return (result as any[]).map((row) => ({
    city: row._id,
    count: row.count,
  }));
}