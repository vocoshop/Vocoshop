// screens/AppliedInventoryDetailScreen.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
ActivityIndicator,
ScrollView,
TouchableOpacity,
Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type HistoryLine = {
_id?: string;
productId?: string;
productName?: string;
category?: string;
previousQuantity?: number;
newQuantity?: number;
diff?: number;
appliedAt?: string | Date;
};

export default function AppliedInventoryDetailScreen() {
const route = useRoute<any>();
const navigation = useNavigation<any>();
const { token } = useContext(AuthContext);

// ✅ sessionId peut venir de "sessionId" (normal) ou "_id" (fallback)
const sessionId: string = useMemo(() => {
const p = route.params || {};
return String(p.sessionId || p._id || "").trim();
}, [route.params]);

const [history, setHistory] = useState<HistoryLine[]>([]);
const [loading, setLoading] = useState(true);
const [onlyDiff, setOnlyDiff] = useState(true);

// ✅ IMPORTANT : on ne dépend PAS de storeId côté front
const canLoad = Boolean(token && sessionId);

const load = useCallback(async () => {
if (!canLoad) {
setLoading(false);
return;
}

try {
setLoading(true);

const res = await API.get(`/inventory/session/${sessionId}/history`, {
headers: {
Authorization: `Bearer ${token}`,
},
});

const raw = (res as any)?.data?.history ?? [];
const safe: HistoryLine[] = Array.isArray(raw) ? raw : [];
setHistory(safe);
} catch (err: any) {
console.log(
"❌ loadHistory error:",
err?.response?.status,
err?.response?.data || err
);
Alert.alert("Erreur", "Impossible de charger l’historique de cet inventaire.");
} finally {
setLoading(false);
}
}, [canLoad, sessionId, token]);

useFocusEffect(
useCallback(() => {
load();
}, [load])
);

const sortedHistory = useMemo(() => {
const arr = [...history];

arr.sort((a, b) => {
const da = Number(a?.diff ?? 0);
const db = Number(b?.diff ?? 0);

const rank = (d: number) => (d < 0 ? 0 : d > 0 ? 1 : 2);
const ra = rank(da);
const rb = rank(db);
if (ra !== rb) return ra - rb;

const aa = Math.abs(da);
const ab = Math.abs(db);
if (aa !== ab) return ab - aa;

return String(a?.productName || "").localeCompare(String(b?.productName || ""));
});

return arr;
}, [history]);

const visibleHistory = useMemo(() => {
if (!onlyDiff) return sortedHistory;
return sortedHistory.filter((x) => Number(x?.diff ?? 0) !== 0);
}, [onlyDiff, sortedHistory]);

const kpis = useMemo(() => {
const total = history.length;
let plus = 0;
let minus = 0;
let zero = 0;

for (const h of history) {
const d = Number(h?.diff ?? 0);
if (d > 0) plus += 1;
else if (d < 0) minus += 1;
else zero += 1;
}

return { total, plus, minus, zero };
}, [history]);

const titleId = useMemo(() => {
const s = String(sessionId || "");
return s ? s.slice(-5) : "—";
}, [sessionId]);

const formatDate = (d?: string | Date) => {
if (!d) return "";
const dt = typeof d === "string" ? new Date(d) : d;
if (Number.isNaN(dt.getTime())) return "";
return dt.toLocaleString();
};

if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
<Text style={{ color: "#A8A3C2", marginTop: 10 }}>
Chargement de l’historique…
</Text>
</View>
);
}

if (!canLoad) {
return (
<View style={styles.container}>
<TouchableOpacity
style={styles.backBtn}
onPress={() => navigation.goBack()}
activeOpacity={0.85}
>
<Ionicons name="chevron-back" size={22} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Inventaire</Text>
<Text style={styles.subtitle}>
Données manquantes (sessionId / token). Reviens en arrière et réessaie.
</Text>
</View>
);
}

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.topRow}>
<TouchableOpacity
style={styles.backBtn}
onPress={() => navigation.goBack()}
activeOpacity={0.85}
>
<Ionicons name="chevron-back" size={22} color="#fff" />
</TouchableOpacity>

<TouchableOpacity style={styles.refreshBtn} onPress={load} activeOpacity={0.85}>
<Ionicons name="refresh" size={18} color="#C6C0DD" />
<Text style={styles.refreshText}>Rafraîchir</Text>
</TouchableOpacity>
</View>

<Text style={styles.title}>Détails inventaire #{titleId}</Text>
<Text style={styles.subtitle}>Tous les mouvements de stock suite à cet inventaire</Text>

{/* KPI */}
<View style={styles.kpiRow}>
<View style={styles.kpiBox}>
<Text style={styles.kpiLabel}>Produits</Text>
<Text style={styles.kpiValue}>{kpis.total}</Text>
</View>
<View style={styles.kpiBox}>
<Text style={styles.kpiLabel}>+</Text>
<Text style={styles.kpiValue}>{kpis.plus}</Text>
</View>
<View style={styles.kpiBox}>
<Text style={styles.kpiLabel}>-</Text>
<Text style={styles.kpiValue}>{kpis.minus}</Text>
</View>
<View style={styles.kpiBox}>
<Text style={styles.kpiLabel}>0</Text>
<Text style={styles.kpiValue}>{kpis.zero}</Text>
</View>
</View>

{/* Toggle */}
<View style={styles.chipsRow}>
<TouchableOpacity
style={[styles.chip, onlyDiff ? styles.chipActive : null]}
onPress={() => setOnlyDiff(true)}
activeOpacity={0.85}
>
<Text style={[styles.chipText, onlyDiff ? styles.chipTextActive : null]}>
Écarts seulement
</Text>
</TouchableOpacity>

<TouchableOpacity
style={[styles.chip, !onlyDiff ? styles.chipActive : null]}
onPress={() => setOnlyDiff(false)}
activeOpacity={0.85}
>
<Text style={[styles.chipText, !onlyDiff ? styles.chipTextActive : null]}>
Tout afficher
</Text>
</TouchableOpacity>
</View>

{visibleHistory.length === 0 ? (
<View style={styles.emptyBox}>
<Ionicons name="information-circle-outline" size={22} color="#A8A3C2" />
<Text style={styles.empty}>
{history.length === 0
? "Aucun mouvement enregistré pour cet inventaire."
: "Aucun écart à afficher (tout est à 0)."}
</Text>
</View>
) : (
<ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
{visibleHistory.map((item, index) => {
const diff = Number(item?.diff ?? 0);
const isPlus = diff > 0;
const isMinus = diff < 0;

const diffColor = isPlus ? "#4ADE80" : isMinus ? "#F87171" : "#E5E7EB";
const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;

return (
<View key={item?._id || `${index}-${item?.productName || "row"}`} style={styles.card}>
<View style={styles.cardLeft}>
<Ionicons name="cube-outline" size={26} color="#C59CFF" />
</View>

<View style={{ flex: 1 }}>
<View style={styles.rowBetween}>
<Text style={styles.productName} numberOfLines={1}>
{item.productName || "Produit"}
</Text>

<View style={[styles.badge, { borderColor: diffColor }]}>
<Text style={[styles.badgeText, { color: diffColor }]}>{diffLabel}</Text>
</View>
</View>

<Text style={styles.category} numberOfLines={1}>
{item.category || "—"}
</Text>

<View style={styles.qtyRow}>
<Text style={styles.small}>
Avant : <Text style={styles.value}>{Number(item.previousQuantity ?? 0)}</Text>
</Text>

<Text style={styles.small}>
Après : <Text style={styles.value}>{Number(item.newQuantity ?? 0)}</Text>
</Text>
</View>

{!!item.appliedAt && <Text style={styles.date}>{formatDate(item.appliedAt)}</Text>}
</View>
</View>
);
})}
</ScrollView>
)}
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 50, paddingHorizontal: 20 },

topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },

backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
},

refreshBtn: {
flexDirection: "row",
alignItems: "center",
gap: 8,
paddingHorizontal: 12,
paddingVertical: 10,
borderRadius: 14,
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
refreshText: { color: "#C6C0DD", fontWeight: "800", fontSize: 12 },

title: { fontSize: 24, color: "#fff", fontWeight: "900" },
subtitle: { color: "#A8A3C2", marginTop: 4, marginBottom: 14, lineHeight: 18 },

kpiRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
kpiBox: {
flex: 1,
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 14,
padding: 10,
},
kpiLabel: { color: "#A8A3C2", fontSize: 11, fontWeight: "900" },
kpiValue: { marginTop: 6, color: "#fff", fontSize: 16, fontWeight: "900" },

chipsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
chip: {
flex: 1,
paddingVertical: 10,
borderRadius: 14,
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
alignItems: "center",
},
chipActive: { backgroundColor: "rgba(167,139,250,0.18)", borderColor: "rgba(167,139,250,0.45)" },
chipText: { color: "#A8A3C2", fontWeight: "900", fontSize: 12 },
chipTextActive: { color: "#E9D5FF" },

emptyBox: {
marginTop: 18,
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 16,
padding: 14,
flexDirection: "row",
alignItems: "center",
gap: 10,
},
empty: { flex: 1, color: "#A8A3C2", lineHeight: 18 },

card: {
backgroundColor: "#18122B",
padding: 14,
borderRadius: 16,
flexDirection: "row",
alignItems: "flex-start",
marginBottom: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
cardLeft: {
width: 50,
height: 50,
borderRadius: 14,
backgroundColor: "#1E1838",
alignItems: "center",
justifyContent: "center",
marginRight: 12,
},

rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },

productName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "900" },
category: { color: "#A8A3C2", fontSize: 12, marginTop: 4, marginBottom: 10 },

qtyRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
small: { color: "#C6C0DD" },
value: { color: "#fff", fontWeight: "900" },

badge: {
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 999,
borderWidth: 1,
backgroundColor: "rgba(0,0,0,0.18)",
},
badgeText: { fontWeight: "900", fontSize: 12 },

date: { marginTop: 10, color: "#7A7393", fontSize: 11 },
});
