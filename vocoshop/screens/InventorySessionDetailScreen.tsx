// screens/InventorySessionDetailScreen.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
ActivityIndicator,
Alert,
RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

function shortId(v?: any) {
const s = String(v || "");
if (!s) return "—";
if (s.length <= 10) return s;
return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function prettyDate(d?: any) {
if (!d) return null;
try {
return new Date(d).toLocaleString();
} catch {
return null;
}
}

function getStatusUI(status?: string) {
if (status === "applied") return { label: "Appliqué", icon: "checkmark-done-outline" as const, color: "#9AF5C7" };
if (status === "validated") return { label: "Validé", icon: "checkmark-outline" as const, color: "#A78BFA" };
return { label: "En cours", icon: "time-outline" as const, color: "#FACC15" };
}

export default function InventorySessionDetailScreen() {
const route = useRoute<any>();
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const sessionId: string | undefined = route.params?.sessionId;

const isReady = !!token && !!storeId && !!sessionId;

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
...(storeId ? { "x-store-id": storeId } : {}),
}),
[token, storeId]
);

const [session, setSession] = useState<any>(null);

// ✅ On sépare bien pour éviter les mélanges fragiles
const [analysis, setAnalysis] = useState<any[]>([]);
const [history, setHistory] = useState<any[]>([]);

const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [processing, setProcessing] = useState(false);

const isApplied = session?.status === "applied";
const isValidated = session?.status === "validated";

const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
if (!isReady) return;
const silent = opts?.silent ?? false;

if (!silent) setLoading(true);

try {
// 1) session
const sRes: any = await API.get(`/inventory/session/${sessionId}`, { headers });
const s = sRes?.data;
setSession(s);

// 2) analysis OU history selon statut
if (s?.status === "applied") {
const hRes: any = await API.get(`/inventory/session/${sessionId}/history`, { headers });
const h = Array.isArray(hRes?.data?.history) ? hRes.data.history : [];
setHistory(h);
setAnalysis([]);
} else {
const aRes: any = await API.get(`/inventory/session/${sessionId}/analyze`, { headers });
const a = Array.isArray(aRes?.data?.analysis) ? aRes.data.analysis : [];
setAnalysis(a);
setHistory([]);
}
} catch (err: any) {
console.log("❌ loadAll error:", err?.response?.status, err?.response?.data || err);
Alert.alert("Erreur", "Impossible de charger les détails de l’inventaire.");
} finally {
setLoading(false);
setRefreshing(false);
}
}, [headers, isReady, sessionId]);

// ✅ initial load (quand prêt)
useEffect(() => {
if (!isReady) return;
loadAll();
}, [isReady, loadAll]);

// ✅ reload à chaque retour sur l’écran
useFocusEffect(
useCallback(() => {
if (!isReady) return;
loadAll({ silent: true });
}, [isReady, loadAll])
);

const onRefresh = useCallback(() => {
if (!isReady) return;
setRefreshing(true);
loadAll({ silent: true });
}, [isReady, loadAll]);

const confirmApply = useCallback(() => {
Alert.alert(
"Appliquer l’inventaire",
"Cela va mettre à jour votre stock selon les quantités comptées. Continuer ?",
[
{ text: "Annuler", style: "cancel" },
{ text: "Oui, appliquer", style: "destructive", onPress: () => applyInventory() },
]
);
}, []);

const applyInventory = useCallback(async () => {
if (!isReady) return;
setProcessing(true);

try {
await API.post(`/inventory/session/${sessionId}/apply`, {}, { headers });
Alert.alert("Succès", "Inventaire appliqué au stock ✅");
await loadAll({ silent: true });
} catch (err: any) {
console.log("❌ applyInventory error:", err?.response?.status, err?.response?.data || err);
const msg = err?.response?.data?.error || "Impossible d’appliquer l’inventaire.";
Alert.alert("Erreur", msg);
} finally {
setProcessing(false);
}
}, [headers, isReady, loadAll, sessionId]);

// ✅ Stats résumé (UX)
const summary = useMemo(() => {
if (isApplied) {
// basé sur history
const list = history || [];
const total = list.length;
const pos = list.filter((x) => Number(x?.diff || 0) > 0).length;
const neg = list.filter((x) => Number(x?.diff || 0) < 0).length;
const zero = total - pos - neg;
return { total, pos, neg, zero };
}

const list = analysis || [];
const total = list.length;
const pos = list.filter((x) => Number(x?.diff || 0) > 0).length;
const neg = list.filter((x) => Number(x?.diff || 0) < 0).length;
const zero = total - pos - neg;
return { total, pos, neg, zero };
}, [analysis, history, isApplied]);

// ✅ LOADING
if (!isReady) {
return (
<View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
<Text style={{ color: "#A8A3C2", marginTop: 10, fontSize: 12 }}>
Chargement des informations…
</Text>
</View>
);
}

if (loading || !session) {
return (
<View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
<Text style={{ color: "#A8A3C2", marginTop: 10, fontSize: 12 }}>
Chargement de l’inventaire…
</Text>
</View>
);
}

const ui = getStatusUI(session.status);
const listToRender = isApplied ? history : analysis;

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.header}>
<TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<View style={{ flex: 1 }}>
<Text style={styles.title}>Inventaire #{String(session._id).slice(-5)}</Text>
</View>

<TouchableOpacity style={styles.iconBtn} onPress={() => loadAll({ silent: false })} activeOpacity={0.85}>
<Ionicons name="refresh-outline" size={20} color="#C6C0DD" />
</TouchableOpacity>
</View>

{/* INFO BOX */}
<View style={styles.infoBox}>
<View style={styles.infoRowBoutique}>
<View style={styles.infoRow}>
<Ionicons name="storefront-outline" size={20} color="#A78BFA" />
<Text style={styles.infoText}>Boutique : {shortId(session.storeId)}</Text>
</View>

<View style={[styles.badge, { borderColor: ui.color }]}>
<Ionicons name={ui.icon} size={14} color={ui.color} />
<Text style={[styles.badgeText, { color: ui.color }]}>{ui.label}</Text>
</View>
</View>

<View style={styles.infoRow}>
<Ionicons name="person-circle-outline" size={20} color="#A78BFA" />
<Text style={styles.infoText}>Employé : {shortId(session.employeeId)}</Text>
</View>

{!!prettyDate(session.completedAt) && (
<View style={styles.infoRow}>
<Ionicons name="time-outline" size={20} color="#A78BFA" />
<Text style={styles.infoText}>Terminé : {prettyDate(session.completedAt)}</Text>
</View>
)}

{!!prettyDate(session.appliedAt) && (
<View style={styles.infoRow}>
<Ionicons name="checkmark-done-outline" size={20} color="#9AF5C7" />
<Text style={styles.infoText}>Appliqué : {prettyDate(session.appliedAt)}</Text>
</View>
)}
</View>

{/* SUMMARY */}
<View style={styles.summaryBox}>
<View style={styles.summaryItem}>
<Text style={styles.summaryValue}>{summary.total}</Text>
<Text style={styles.summaryLabel}>Produits</Text>
</View>
<View style={styles.summaryDivider} />
<View style={styles.summaryItem}>
<Text style={[styles.summaryValue, { color: "#4ADE80" }]}>{summary.pos}</Text>
<Text style={styles.summaryLabel}>+</Text>
</View>
<View style={styles.summaryDivider} />
<View style={styles.summaryItem}>
<Text style={[styles.summaryValue, { color: "#F87171" }]}>{summary.neg}</Text>
<Text style={styles.summaryLabel}>-</Text>
</View>
<View style={styles.summaryDivider} />
<View style={styles.summaryItem}>
<Text style={[styles.summaryValue, { color: "#E5E7EB" }]}>{summary.zero}</Text>
<Text style={styles.summaryLabel}>OK</Text>
</View>
</View>

<Text style={styles.sectionTitle}>
{isApplied ? "Historique des mouvements appliqués" : "Analyse des écarts"}
</Text>

<ScrollView
contentContainerStyle={{ paddingBottom: 170 }}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#A78BFA" />}
showsVerticalScrollIndicator={false}
>
{listToRender.length === 0 ? (
<View style={styles.emptyBox}>
<Ionicons name="information-circle-outline" size={22} color="#A78BFA" />
<Text style={styles.emptyText}>
{isApplied ? "Aucun mouvement enregistré." : "Aucun écart trouvé pour le moment."}
</Text>
</View>
) : (
listToRender.map((item, i) => {
const diff = Number(item?.diff || 0);
const name = item?.productName ?? item?.name ?? "Produit";
const category = item?.category ?? "—";

return (
<View key={i} style={styles.card}>
<View style={styles.cardLeft}>
<Ionicons name="cube-outline" size={26} color="#C59CFF" />
</View>

<View style={{ flex: 1 }}>
<Text style={styles.productName}>{name}</Text>
<Text style={styles.productCategory}>{category}</Text>

{!isApplied && item.countedByName && (
<Text style={styles.countedByText}>Compté par : {item.countedByName}</Text>
)}

{isApplied ? (
<>
<Text style={styles.smallText}>Avant : <Text style={styles.valueText}>{item?.previousQuantity ?? 0}</Text></Text>
<Text style={styles.smallText}>Après : <Text style={styles.valueText}>{item?.newQuantity ?? 0}</Text></Text>
<Text style={[styles.diffText, { color: diff > 0 ? "#4ADE80" : diff < 0 ? "#F87171" : "#E5E7EB" }]}>
Écart : {diff > 0 ? `+${diff}` : `${diff}`}
</Text>
{!!prettyDate(item?.appliedAt) && (
<Text style={styles.dateText}>Appliqué : {prettyDate(item.appliedAt)}</Text>
)}
</>
) : (
<>
<Text style={styles.smallText}>Stock actuel : <Text style={styles.valueText}>{item?.stockQuantity ?? 0}</Text></Text>
<Text style={styles.smallText}>Compté : <Text style={styles.valueText}>{item?.countedQuantity ?? 0}</Text></Text>
<Text style={[styles.diffText, { color: diff > 0 ? "#4ADE80" : diff < 0 ? "#F87171" : "#E5E7EB" }]}>
Écart : {diff > 0 ? `+${diff}` : `${diff}`}
</Text>
</>
)}
</View>
</View>
);
})
)}
</ScrollView>

{/* BOTTOM BAR */}
{!isApplied && (
<View style={styles.bottomBar}>
<Text style={styles.bottomTitle}>
{isValidated ? "Inventaire validé" : "Inventaire en cours"}
</Text>
<Text style={styles.bottomSubtitle}>
{summary.total} produit(s)
</Text>

{isValidated ? (
<TouchableOpacity
style={[styles.actionBtn, processing && { opacity: 0.8 }]}
onPress={confirmApply}
disabled={processing}
activeOpacity={0.9}
>
{processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>Mettre à jour le stock</Text>}
</TouchableOpacity>
) : (
<View style={[styles.actionBtnDisabled]}>
<Text style={styles.actionTextDisabled}>En attente de validation</Text>
</View>
)}
</View>
)}

{isApplied && (
<View style={styles.bottomBarApplied}>
<Text style={styles.bottomAppliedText}>✔ Cet inventaire est déjà appliqué</Text>
</View>
)}
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 50, paddingHorizontal: 20 },

header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
backBtn: {
width: 42, height: 42, borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center", justifyContent: "center",
},
iconBtn: {
width: 42, height: 42, borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center", justifyContent: "center",
},

title: { fontSize: 24, color: "#fff", fontWeight: "900" },
badge: {
alignSelf: "flex-start",
marginTop: 6,
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

infoBox: { backgroundColor: "#161228", padding: 16, borderRadius: 14, marginBottom: 12 },
infoRowBoutique: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
infoText: { color: "#fff", fontSize: 13 },

summaryBox: {
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 16,
paddingVertical: 12,
paddingHorizontal: 10,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginBottom: 16,
},
summaryItem: { flex: 1, alignItems: "center" },
summaryDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.08)" },
summaryValue: { color: "#fff", fontWeight: "900", fontSize: 16 },
summaryLabel: { color: "#A8A3C2", fontSize: 11, marginTop: 2, fontWeight: "700" },

sectionTitle: { color: "#C6C0DD", fontWeight: "800", fontSize: 14, marginBottom: 10 },

emptyBox: {
marginTop: 12,
backgroundColor: "rgba(255,255,255,0.04)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 14,
padding: 14,
flexDirection: "row",
alignItems: "center",
gap: 10,
},
emptyText: { color: "#A8A3C2", fontSize: 12, flex: 1, lineHeight: 18 },

card: {
backgroundColor: "#18122B",
padding: 16,
borderRadius: 14,
flexDirection: "row",
alignItems: "flex-start",
marginBottom: 12,
},
cardLeft: {
width: 48, height: 48, borderRadius: 14,
backgroundColor: "#1E1838",
alignItems: "center", justifyContent: "center",
marginRight: 12,
},
productName: { color: "#fff", fontSize: 16, fontWeight: "900" },
productCategory: { color: "#A8A3C2", fontSize: 12, marginBottom: 8 },

smallText: { color: "#C6C0DD", marginTop: 2, fontSize: 12 },
valueText: { color: "#fff", fontWeight: "900" },

diffText: { marginTop: 8, fontSize: 14, fontWeight: "900" },
countedByText: { color: "#A78BFA", marginTop: 4, fontSize: 11, fontWeight: "600" },
dateText: { marginTop: 6, color: "#7A7393", fontSize: 11 },

bottomBar: {
position: "absolute",
bottom: 0, left: 0, right: 0,
backgroundColor: "#140E26",
padding: 18,
paddingBottom: 28,
borderTopWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
bottomTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
bottomSubtitle: { color: "#A8A3C2", marginTop: 4, marginBottom: 12, fontSize: 12 },

actionBtn: {
backgroundColor: "#7C3AED",
paddingVertical: 14,
borderRadius: 12,
alignItems: "center",
},
actionText: { color: "#fff", fontSize: 15, fontWeight: "900" },

actionBtnDisabled: {
backgroundColor: "rgba(255,255,255,0.08)",
paddingVertical: 14,
borderRadius: 12,
alignItems: "center",
},
actionTextDisabled: { color: "#A8A3C2", fontSize: 14, fontWeight: "800" },

bottomBarApplied: {
position: "absolute",
bottom: 0, left: 0, right: 0,
backgroundColor: "#0F0A1A",
padding: 18,
paddingBottom: 28,
borderTopWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
bottomAppliedText: { textAlign: "center", color: "#4ADE80", fontWeight: "900", fontSize: 14 },
});
