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
Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type InvSession = {
_id: string;
status?: "draft" | "validated" | "applied";
lines?: any[];
createdAt?: string;
completedAt?: string;
appliedAt?: string;
employeeId?: { _id: string; name: string };
storeId?: { _id: string; storeName: string };
};

function prettyDate(d?: string) {
if (!d) return null;
try {
return new Date(d).toLocaleString();
} catch {
return null;
}
}

function getStatusUI(status?: string) {
if (status === "applied")
return { label: "Appliqué", icon: "checkmark-done-outline" as const, color: "#9AF5C7" };
if (status === "validated")
return { label: "Validé", icon: "checkmark-outline" as const, color: "#A78BFA" };
return { label: "En cours", icon: "time-outline" as const, color: "#FACC15" };
}

export default function InventorySessionsScreen({ navigation }: any) {
const auth: any = useContext(AuthContext);

// ✅ Compat avec ton AuthContext actuel
const token: string | null = auth?.token ?? null;
const storeId: string | null = auth?.storeId ?? null;

// ✅ Compat future (si tu ajoutes isReady/getAuthHeaders)
const isReady: boolean = auth?.isReady ?? (!!token && !!storeId); // fallback
const getAuthHeaders: (() => Record<string, string>) | undefined = auth?.getAuthHeaders;

const headers = useMemo(() => {
if (getAuthHeaders) return getAuthHeaders();
return {
Authorization: token ? `Bearer ${token}` : "",
...(storeId ? { "x-store-id": storeId } : {}),
};
}, [getAuthHeaders, token, storeId]);

const [sessions, setSessions] = useState<InvSession[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

const normalizeList = (data: any): InvSession[] => {
if (Array.isArray(data)) return data;
if (Array.isArray(data?.sessions)) return data.sessions;
return [];
};

const loadSessions = useCallback(
async (opts?: { silent?: boolean }) => {
if (!isReady) return;

const silent = opts?.silent ?? false;
if (!silent) setLoading(true);

try {
const res: any = await API.get("/inventory/sessions", { headers });
const list = normalizeList(res?.data);

// ✅ Tri: plus récent en haut (fallback si createdAt absent)
const sorted = list.slice().sort((a, b) => {
const da = new Date(a.createdAt || a.completedAt || 0).getTime();
const db = new Date(b.createdAt || b.completedAt || 0).getTime();
return db - da;
});

setSessions(sorted);
} catch (err: any) {
console.log("❌ loadSessions error:", err?.response?.status, err?.response?.data || err);

// 400 = storeId manquant (le plus fréquent)
if (err?.response?.status === 400) {
Alert.alert(
"Session non prête",
"La boutique n’est pas encore chargée. Réessaie dans 2 secondes."
);
} else {
Alert.alert("Erreur", "Impossible de charger les inventaires.");
}
} finally {
setLoading(false);
setRefreshing(false);
}
},
[headers, isReady]
);

// ✅ 1) premier chargement (quand ready)
useEffect(() => {
if (!isReady) return;
loadSessions();
}, [isReady, loadSessions]);

// ✅ 2) reload à chaque retour sur l’écran (très important)
useFocusEffect(
useCallback(() => {
if (!isReady) return;
loadSessions({ silent: true });
}, [isReady, loadSessions])
);

const onRefresh = useCallback(() => {
if (!isReady) return;
setRefreshing(true);
loadSessions({ silent: true });
}, [isReady, loadSessions]);

const openSession = useCallback(
(sessionId: string) => {
navigation.navigate("InventorySessionDetail", { sessionId });
},
[navigation]
);

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.header}>
<TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<View style={{ flex: 1 }}>
<Text style={styles.title}>Mes inventaires</Text>
<Text style={styles.subtitle}>Sessions d’inventaire (patron) + écarts + application stock</Text>
</View>

<TouchableOpacity
style={styles.iconBtn}
onPress={() => loadSessions({ silent: false })}
activeOpacity={0.85}
disabled={!isReady}
>
<Ionicons name="refresh-outline" size={20} color="#C6C0DD" />
</TouchableOpacity>
</View>

{/* LOADING */}
{loading ? (
<View style={styles.center}>
<ActivityIndicator size="large" color="#A78BFA" />
<Text style={styles.loadingText}>Chargement des sessions...</Text>
</View>
) : (
<ScrollView
contentContainerStyle={{ paddingBottom: 120 }}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A78BFA" />}
showsVerticalScrollIndicator={false}
>
{/* EMPTY */}
{sessions.length === 0 ? (
<View style={styles.emptyBox}>
<Ionicons name="clipboard-outline" size={26} color="#A78BFA" />
<Text style={styles.emptyTitle}>Aucun inventaire</Text>
<Text style={styles.emptySub}>
Lance un inventaire depuis le module Inventaire (employé) ou crée une session.
</Text>

<TouchableOpacity
style={styles.ctaBtn}
onPress={() => navigation.navigate("Inventory")}
activeOpacity={0.9}
>
<Text style={styles.ctaText}>Aller à l’inventaire</Text>
</TouchableOpacity>
</View>
) : (
sessions.map((item) => {
const counted = item.lines?.length ?? 0;
const ui = getStatusUI(item.status);
const dateLabel =
item.status === "applied"
? prettyDate(item.appliedAt) || prettyDate(item.completedAt) || prettyDate(item.createdAt)
: item.status === "validated"
? prettyDate(item.completedAt) || prettyDate(item.createdAt)
: prettyDate(item.createdAt);

return (
<TouchableOpacity
key={item._id}
style={styles.card}
onPress={() => openSession(item._id)}
activeOpacity={0.9}
>
<View style={styles.cardTop}>
<Text style={styles.cardTitle}>Session #{String(item._id).slice(-5)}</Text>

<View style={[styles.badge, { borderColor: ui.color }]}>
<Ionicons name={ui.icon} size={14} color={ui.color} />
<Text style={[styles.badgeText, { color: ui.color }]}>{ui.label}</Text>
</View>
</View>

<Text style={styles.cardSub}>Produits comptés : {counted}</Text>

<View style={styles.cardEmployeeRow}>
<Ionicons name="person-outline" size={12} color="#7A7393" />
<Text style={styles.cardEmployee}>{item.employeeId?.name || "Employé"}{item.storeId?.storeName ? ` · ${item.storeId.storeName}` : ""}</Text>
</View>

{!!dateLabel && (
<Text style={styles.cardDate}>
{item.status === "applied"
? `Appliqué : ${dateLabel}`
: item.status === "validated"
? `Terminé : ${dateLabel}`
: `Créé : ${dateLabel}`}
</Text>
)}

<View style={styles.cardFooter}>
<Text style={styles.linkText}>
{item.status === "applied"
? "Voir l’historique appliqué"
: item.status === "validated"
? "Voir les écarts & appliquer"
: "Continuer / analyser"}
</Text>
<Ionicons name="chevron-forward" size={18} color="#7A7393" />
</View>
</TouchableOpacity>
);
})
)}
</ScrollView>
)}
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 50, paddingHorizontal: 20 },

header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
},
iconBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
},

title: { fontSize: 24, color: "#fff", fontWeight: "900" },
subtitle: { color: "#A8A3C2", marginTop: 4, fontSize: 12, lineHeight: 16 },

center: { flex: 1, alignItems: "center", justifyContent: "center" },
loadingText: { marginTop: 10, color: "#A8A3C2", fontSize: 12 },

card: {
backgroundColor: "#18122B",
padding: 16,
borderRadius: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
marginBottom: 12,
},
cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
cardTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },

badge: {
flexDirection: "row",
alignItems: "center",
gap: 6,
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 999,
borderWidth: 1,
backgroundColor: "rgba(255,255,255,0.04)",
},
badgeText: { fontSize: 12, fontWeight: "900" },

cardSub: { color: "#C6C0DD", marginTop: 10, fontSize: 12 },
cardEmployeeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
cardEmployee: { color: "#7A7393", fontSize: 11 },
cardDate: { color: "#7A7393", marginTop: 6, fontSize: 11 },

cardFooter: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
linkText: { color: "#A78BFA", fontWeight: "800", fontSize: 12 },

emptyBox: {
marginTop: 30,
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 18,
padding: 16,
alignItems: "center",
},
emptyTitle: { marginTop: 10, color: "#fff", fontWeight: "900", fontSize: 16 },
emptySub: { marginTop: 6, color: "#A8A3C2", fontSize: 12, textAlign: "center", lineHeight: 18 },

ctaBtn: {
marginTop: 14,
width: "100%",
backgroundColor: "#8A4DFF",
paddingVertical: 12,
borderRadius: 14,
alignItems: "center",
},
ctaText: { color: "#fff", fontWeight: "900" },
});
