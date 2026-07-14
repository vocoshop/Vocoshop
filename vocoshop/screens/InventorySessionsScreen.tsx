// screens/InventorySessionsScreen.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type InvSession = {
  _id: string;
  status?: "draft" | "validated" | "applied";
  lines?: any[];
  createdAt?: string;
  completedAt?: string;
  appliedAt?: string;
  employeeName?: string;
  totalProducts?: number;
  totalDiscrepancies?: number;
};

function formatDate(d?: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch { return ""; }
}

function formatTime(d?: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch { return ""; }
}

function getStatusUI(status?: string) {
  if (status === "applied")
    return { label: "Appliqué", icon: "checkmark-done-outline" as const, color: "#22c55e", bg: "rgba(34,197,94,0.10)" };
  if (status === "validated")
    return { label: "Validé", icon: "checkmark-outline" as const, color: "#A78BFA", bg: "rgba(167,139,250,0.10)" };
  return { label: "En cours", icon: "time-outline" as const, color: "#F59E0B", bg: "rgba(245,158,11,0.10)" };
}

const FILTER_TABS = [
  { key: "all", label: "Tous" },
  { key: "draft", label: "En cours" },
  { key: "validated", label: "Validés" },
  { key: "applied", label: "Appliqués" },
];

export default function InventorySessionsScreen() {
  const navigation = useNavigation<any>();
  const auth = useContext(AuthContext);
  const token = auth?.token ?? null;
  const storeId = auth?.storeId ?? null;
  const isReady = !!token && !!storeId;

  const headers = useMemo(() => ({
    Authorization: token ? `Bearer ${token}` : "",
    ...(storeId ? { "x-store-id": storeId } : {}),
  }), [token, storeId]);

  const [sessions, setSessions] = useState<InvSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const loadSessions = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isReady) return;
    if (!opts?.silent) setLoading(true);
    try {
      const res: any = await API.get("/inventory/sessions", { headers });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.sessions) ? res.data.sessions : [];
      list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setSessions(list);
    } catch (err: any) {
      if (err?.response?.status !== 400) {
        setSessions([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers, isReady]);

  useEffect(() => { if (isReady) loadSessions(); }, [isReady, loadSessions]);
  useFocusEffect(useCallback(() => { if (isReady) loadSessions({ silent: true }); }, [isReady, loadSessions]));

  const filtered = activeFilter === "all" ? sessions : sessions.filter(s => (s.status || "draft") === activeFilter);

  const counts = useMemo(() => ({
    all: sessions.length,
    draft: sessions.filter(s => !s.status || s.status === "draft").length,
    validated: sessions.filter(s => s.status === "validated").length,
    applied: sessions.filter(s => s.status === "applied").length,
  }), [sessions]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#A78BFA" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Mes inventaires</Text>
        <TouchableOpacity onPress={() => loadSessions()} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color="#A8A3C2" />
        </TouchableOpacity>
      </View>

      {/* STATS ROW */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{counts.all}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: "#F59E0B" }]}>{counts.draft}</Text>
          <Text style={styles.statLabel}>En cours</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: "#A78BFA" }]}>{counts.validated}</Text>
          <Text style={styles.statLabel}>Validés</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: "#22c55e" }]}>{counts.applied}</Text>
          <Text style={styles.statLabel}>Appliqués</Text>
        </View>
      </View>

      {/* FILTER TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8 }}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* LIST */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions({ silent: true }); }} tintColor="#A78BFA" />}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="clipboard-outline" size={40} color="#4B5563" />
            <Text style={styles.emptyTitle}>Aucun inventaire</Text>
            <Text style={styles.emptySub}>
              {activeFilter !== "all"
                ? `Aucune session avec le statut "${FILTER_TABS.find(t => t.key === activeFilter)?.label}".`
                : "Lancez un inventaire depuis le module Inventaire."}
            </Text>
            {activeFilter === "all" && (
              <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate("Inventory")}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.ctaText}>Nouvel inventaire</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filtered.map((item) => {
            const counted = item.lines?.length ?? item.totalProducts ?? 0;
            const ui = getStatusUI(item.status);
            const dateStr = item.status === "applied"
              ? formatDate(item.appliedAt) || formatDate(item.completedAt) || formatDate(item.createdAt)
              : item.status === "validated"
              ? formatDate(item.completedAt) || formatDate(item.createdAt)
              : formatDate(item.createdAt);
            const timeStr = item.status === "applied"
              ? formatTime(item.appliedAt)
              : formatTime(item.createdAt);

            return (
              <TouchableOpacity
                key={item._id}
                style={styles.card}
                onPress={() => navigation.navigate("InventorySessionDetail", { sessionId: item._id })}
                activeOpacity={0.85}
              >
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIcon, { backgroundColor: ui.bg }]}>
                    <Ionicons name={ui.icon} size={20} color={ui.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardDate}>{dateStr || "Date inconnue"}</Text>
                    {timeStr ? <Text style={styles.cardTime}>{timeStr}</Text> : null}
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardProducts}>{counted} produit{counted > 1 ? "s" : ""} compté{counted > 1 ? "s" : ""}</Text>
                      {item.employeeName ? (
                        <Text style={styles.cardEmployee}>· {item.employeeName}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <View style={[styles.statusBadge, { backgroundColor: ui.bg, borderColor: ui.color }]}>
                    <Text style={[styles.statusText, { color: ui.color }]}>{ui.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#4B5563" style={{ marginTop: 8 }} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 55, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, color: "#fff", fontWeight: "900", flex: 1 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#161228",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  statNumber: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
  statLabel: {
    color: "#6B7280",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Filters
  filterRow: {
    marginBottom: 12,
    maxHeight: 36,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  filterTabActive: {
    backgroundColor: "rgba(167,139,250,0.15)",
    borderColor: "rgba(167,139,250,0.3)",
  },
  filterTabText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#A78BFA",
  },

  // Cards
  card: {
    backgroundColor: "#161228",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDate: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  cardTime: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 1,
  },
  cardMeta: {
    flexDirection: "row",
    marginTop: 4,
  },
  cardProducts: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  cardEmployee: {
    color: "#6B7280",
    fontSize: 12,
  },
  cardRight: {
    alignItems: "center",
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Empty
  emptyBox: {
    marginTop: 20,
    alignItems: "center",
    padding: 30,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },
  emptySub: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  ctaBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
