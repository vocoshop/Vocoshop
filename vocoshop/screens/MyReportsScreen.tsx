// screens/MyReportsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState, useContext, useRef } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
ActivityIndicator,
RefreshControl,
Alert,
Modal,
Pressable,
Share,
Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";

import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

import { onSyncState, getLastSyncFinished } from "../src/api/offline/syncEngine";
/* =======================
TYPES
======================= */
type DailyReport = {
date: string; // YYYY-MM-DD
totalSales?: number;
totalRevenue?: number;

// finance v2
cogs?: number;
grossProfit?: number;
netProfit?: number;
marginPercent?: number;

// legacy fallback
totalProfit?: number;
profitEstimated?: number;
};

type ReportKpisResponse = {
monthlyRevenue: number;
monthlySalesCount: number;

// compat (tu avais monthlyProfit)
monthlyProfit: number;

// finance
monthlyCogs?: number;
monthlyGrossProfit?: number;
monthlyNetProfit?: number;
monthlyMarginPercent?: number;

// stock (optionnel)
totalProducts?: number;
totalQuantity?: number;
totalStockValue?: number;
estimatedResellValue?: number;
totalPotentialProfit?: number;
};

const screenW = Dimensions.get("window").width;

/* =======================
UTILS
======================= */
function pad2(n: number) {
return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(date: Date) {
return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, delta: number) {
return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatMonthLabel(date: Date) {
const months = [
"Jan",
"Fév",
"Mar",
"Avr",
"Mai",
"Juin",
"Juil",
"Aoû",
"Sep",
"Oct",
"Nov",
"Déc",
];
return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function safeNumber(n: any) {
const v = Number(n);
return Number.isFinite(v) ? v : 0;
}

function formatMoney(n: number) {
const v = Math.round(safeNumber(n));
return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatPercent(n: number) {
const v = safeNumber(n);
return `${Math.round(v * 10) / 10}%`;
}

function getProfit(r: DailyReport) {
// priorité finance
return safeNumber(
r.netProfit ??
r.grossProfit ??
r.totalProfit ??
r.profitEstimated ??
0
);
}

/* =====================================================
SCREEN
===================================================== */

export default function MyReportsScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [monthCursor, setMonthCursor] = useState<Date>(() =>
startOfMonth(new Date())
);

const [reports, setReports] = useState<DailyReport[]>([]);

const [kpis, setKpis] = useState({
revenue: 0,
profit: 0,
salesCount: 0,
marginPercent: 0,
});

const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [monthModalOpen, setMonthModalOpen] = useState(false);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId ? String(storeId) : "",
}),
[token, storeId]
);

const canCallApi = Boolean(token && storeId);

const showError = useCallback((title: string, err: any) => {
const status = err?.response?.status;

const msg =
err?.response?.data?.error ||
err?.response?.data?.message ||
(status
? `Erreur (${status}). Réessaie.`
: "Une erreur est survenue. Réessaie.");

console.log(
"❌",
title,
status,
err?.response?.data || err?.message || err
);

Alert.alert(title, msg);
}, []);

const monthRange = useMemo(() => {
const from = toISODate(startOfMonth(monthCursor));
const to = toISODate(endOfMonth(monthCursor));
return { from, to };
}, [monthCursor]);

// 12 derniers mois (modal)
const monthOptions = useMemo(() => {
const base = startOfMonth(new Date());
return Array.from({ length: 12 }).map((_, i) =>
addMonths(base, -i)
);
}, []);

const loadData = useCallback(
async (opts?: { silent?: boolean }) => {
if (!canCallApi) return;

if (!opts?.silent) setLoading(true);

try {
/* ================= KPIs ================= */
const kpisRes = await API.get("/report/kpis", {
headers,
params: {
from: monthRange.from,
to: monthRange.to,
},
});

const k = (kpisRes?.data || {}) as ReportKpisResponse;

setKpis({
revenue: safeNumber(k?.monthlyRevenue),
profit: safeNumber(
k?.monthlyProfit ?? k?.monthlyNetProfit ?? 0
),
salesCount: safeNumber(k?.monthlySalesCount),
marginPercent: safeNumber(k?.monthlyMarginPercent ?? 0),
});

/* ================= HISTORY ================= */
const histRes = await API.get("/report/history", {
headers,
params: {
from: monthRange.from,
to: monthRange.to,
},
});

const raw = histRes?.data;
const list: DailyReport[] = Array.isArray(raw) ? raw : [];

const cleaned = list
.filter(
(r) =>
typeof r?.date === "string" && r.date.length >= 10
)
.sort((a, b) => a.date.localeCompare(b.date))
.map((r) => ({
...r,
totalRevenue: safeNumber(r.totalRevenue),
totalSales: safeNumber(r.totalSales),

cogs: safeNumber((r as any).cogs),
grossProfit: safeNumber((r as any).grossProfit),
netProfit: safeNumber((r as any).netProfit),

marginPercent: safeNumber((r as any).marginPercent),

totalProfit: safeNumber(r.totalProfit),
profitEstimated: safeNumber(r.profitEstimated),
}));

setReports(cleaned);
} catch (err: any) {
setKpis({
revenue: 0,
profit: 0,
salesCount: 0,
marginPercent: 0,
});

setReports([]);

showError("Mes bilans", err);
} finally {
if (!opts?.silent) setLoading(false);
}
},
[canCallApi, headers, monthRange.from, monthRange.to, showError]
);

const onRefresh = useCallback(async () => {
setRefreshing(true);
await loadData({ silent: true });
setRefreshing(false);
}, [loadData]);

/* =====================================================
🔥 AUTO REFRESH APRÈS SYNC OFFLINE — VERSION PROPRE
===================================================== */

const lastSyncRef = useRef<number>(0);

useEffect(() => {
const unsub = onSyncState(() => {
const finished = getLastSyncFinished();

if (finished && finished !== lastSyncRef.current) {
lastSyncRef.current = finished;
loadData({ silent: true });
}
});

return () => {
unsub();
};
}, [loadData]);

/* ================= FIRST LOAD ================= */
useEffect(() => {
loadData();
}, [loadData]);


// Chart — labels = tous les jours du mois (01 → 31)
const chart = useMemo(() => {
const labels = reports.map((r) => r.date.slice(8, 10)); // "01".."31"
const values = reports.map((r) => safeNumber(r.totalRevenue));

return {
labels: labels.length ? labels : ["—"],
values: values.length ? values : [0],
};
}, [reports]);

// ✅ largeur dynamique du graphe (évite les dates serrées)
const chartWidth = useMemo(() => {
const labelsCount = chart.labels.length;
const minWidth = screenW - 32;

return Math.max(minWidth, labelsCount * 60);
}, [chart.labels.length, screenW]);

// Tooltip
const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

const openWhatsApp = useCallback(async (text: string) => {
const encoded = encodeURIComponent(text);

// deep link app
const appUrl = `whatsapp://send?text=${encoded}`;
const webUrl = `https://wa.me/?text=${encoded}`;

try {
const can = await Linking.canOpenURL(appUrl);
if (can) return Linking.openURL(appUrl);
return Linking.openURL(webUrl);
} catch {
return Linking.openURL(webUrl);
}
}, []);

const openSms = useCallback(async (text: string) => {
const encoded = encodeURIComponent(text);
// iOS: sms:&body= ; Android: sms:?body=
const url = Platform.select({
ios: `sms:&body=${encoded}`,
android: `sms:?body=${encoded}`,
default: `sms:?body=${encoded}`,
}) as string;

return Linking.openURL(url);
}, []);

const openEmail = useCallback(async (subject: string, body: string) => {
const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
return Linking.openURL(url);
}, []);

// ✅ Partage par lien sécurisé (crée lien + copie + proposer actions)
const onShare = useCallback(async () => {
if (!canCallApi) return;

try {
type ShareMonthResponse = { url: string };
const resp = await API.post<ShareMonthResponse>(
"/report/share/month",
{ from: monthRange.from, to: monthRange.to, expiresInDays: 30 },
{ headers }
);

const url = String(resp?.data?.url || "");
if (!url) throw new Error("URL de partage manquante");

const message = `📊 Bilan Vocoshop (lecture seule)\nPériode: ${monthRange.from} → ${monthRange.to}\nLien: ${url}`;

const copyOnly = async () => {
await Clipboard.setStringAsync(url);
Alert.alert("Copié ✅", "Lien copié dans le presse-papiers.");
};

const shareNative = async () => {
// Share natif iOS/Android (WhatsApp/SMS/Mail etc. si dispo)
await Share.share({ message, url });
};

Alert.alert("Lien créé ✅", "Choisis comment l’envoyer :", [
{ text: "Copier", onPress: copyOnly },
{ text: "Partager", onPress: shareNative },
{ text: "WhatsApp", onPress: () => openWhatsApp(message) },
{ text: "SMS", onPress: () => openSms(message) },
{ text: "Email", onPress: () => openEmail("Bilan Vocoshop (lecture seule)", message) },
{ text: "Annuler", style: "cancel" },
]);
} catch (err: any) {
showError("Partager", err);
}
}, [canCallApi, headers, monthRange.from, monthRange.to, showError, openWhatsApp, openSms, openEmail]);

const monthTitle = useMemo(() => formatMonthLabel(monthCursor), [monthCursor]);

if (!token || !storeId) {
return (
<View style={[styles.container, styles.center]}>
<ActivityIndicator color="#A78BFA" />
<Text style={styles.muted}>Chargement…</Text>
</View>
);
}

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.headerBtn}>
<Ionicons name="chevron-back" size={22} color="#fff" />
</TouchableOpacity>

<View style={{ flex: 1, marginHorizontal: 10 }}>
<Text style={styles.headerTitle}>Mes bilans</Text>
<Text style={styles.headerSub}>{monthTitle}</Text>
</View>

<TouchableOpacity onPress={() => loadData()} activeOpacity={0.85} style={styles.headerBtn}>
<Ionicons name="refresh" size={18} color="#fff" />
</TouchableOpacity>

<TouchableOpacity onPress={onShare} activeOpacity={0.85} style={styles.headerBtn}>
<Ionicons name="share-social" size={18} color="#fff" />
</TouchableOpacity>
</View>

{/* TOP BAR */}
<View style={styles.topBar}>
<TouchableOpacity style={styles.pill} activeOpacity={0.85} onPress={() => setMonthModalOpen(true)}>
<Ionicons name="calendar-outline" size={16} color="#CFC7E8" />
<Text style={styles.pillText}>{monthTitle}</Text>
<Ionicons name="chevron-down" size={14} color="#CFC7E8" />
</TouchableOpacity>

<View style={styles.rangePill}>
<Text style={styles.rangeText}>
{monthRange.from} → {monthRange.to}
</Text>
</View>
</View>

{/* KPI ROW (4) */}
<View style={styles.kpiRow}>
<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>CA</Text>
<Text style={styles.kpiValue}>{formatMoney(kpis.revenue)}</Text>
<Text style={styles.kpiUnit}>FCFA</Text>
</View>

<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>Profit</Text>
<Text style={styles.kpiValue}>{formatMoney(kpis.profit)}</Text>
<Text style={styles.kpiUnit}>FCFA</Text>
</View>

<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>Marge</Text>
<Text style={styles.kpiValue}>{formatPercent(kpis.marginPercent)}</Text>
<Text style={styles.kpiUnit}>du CA</Text>
</View>

<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>Ventes</Text>
<Text style={styles.kpiValue}>{kpis.salesCount}</Text>
<Text style={styles.kpiUnit}>tickets</Text>
</View>
</View>

{/* CHART */}
<View style={styles.card}>
<View style={styles.cardHeader}>
<Text style={styles.sectionTitle}>Évolution du chiffre d’affaires</Text>
<Text style={styles.sectionHint}>Tap un point pour voir le montant</Text>
</View>

{loading ? (
<View style={[styles.center, { height: 210 }]}>
<ActivityIndicator color="#A78BFA" />
</View>
) : reports.length === 0 ? (
<View style={[styles.center, { height: 180 }]}>
<Ionicons name="analytics-outline" size={26} color="rgba(255,255,255,0.35)" />
<Text style={styles.muted}>Aucune donnée pour ce mois.</Text>
</View>
) : (
<View style={{ marginTop: 8 }}>
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
<View>
<LineChart
data={{ labels: chart.labels, datasets: [{ data: chart.values }] }}
width={chartWidth}
height={220}
fromZero
withDots
withShadow={false}
withInnerLines={false}
withOuterLines={false}
yAxisLabel=""
yAxisSuffix=""
segments={4}
formatYLabel={(y) => {
const v = Math.round(Number(y || 0));
if (v >= 1000000) return `${Math.round(v / 100000) / 10}M`;
if (v >= 1000) return `${Math.round(v / 100) / 10}K`;
return String(v);
}}
chartConfig={{
backgroundGradientFrom: "#18122B",
backgroundGradientTo: "#18122B",
decimalPlaces: 0,
color: () => "rgba(167,139,250,0.95)",
labelColor: () => "rgba(200,190,230,0.9)",
propsForDots: { r: "4", strokeWidth: "2", stroke: "rgba(167,139,250,0.65)" },
propsForBackgroundLines: { stroke: "rgba(255,255,255,0.06)", strokeDasharray: "0" },
}}
bezier={false}
onDataPointClick={(d) => {
const r = reports[d.index];
if (!r) return;
setTooltip({
x: d.x,
y: d.y,
label: r.date,
value: safeNumber(r.totalRevenue),
});
setTimeout(() => setTooltip(null), 1800);
}}
style={{ borderRadius: 14 }}
/>

{tooltip && (
<View
style={[
styles.tooltip,
{ left: Math.max(10, tooltip.x - 78), top: Math.max(12, tooltip.y - 58) },
]}
>
<Text style={styles.tooltipDate}>{tooltip.label}</Text>
<Text style={styles.tooltipValue}>{formatMoney(tooltip.value)} FCFA</Text>
</View>
)}
</View>
</ScrollView>
</View>
)}
</View>

{/* LIST */}
<ScrollView
style={{ flex: 1 }}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
contentContainerStyle={{ paddingBottom: 22 }}
>
<View style={styles.listHeader}>
<Text style={styles.sectionTitle}>Détails par jour</Text>
<Text style={styles.sectionHint}>Profit = netProfit</Text>
</View>

{reports.map((r) => (
<View key={r.date} style={styles.row}>
<View style={{ flex: 1 }}>
<Text style={styles.rowTitle}>
{r.date.slice(8, 10)}/{r.date.slice(5, 7)}/{r.date.slice(0, 4)}
</Text>
<Text style={styles.rowSub}>
CA: {formatMoney(safeNumber(r.totalRevenue))} • Ventes: {safeNumber(r.totalSales)} • Marge:{" "}
{formatPercent(safeNumber(r.marginPercent))}
</Text>
</View>

<View style={{ alignItems: "flex-end" }}>
<Text style={styles.rowRight}>{formatMoney(getProfit(r))} FCFA</Text>
<Text style={styles.rowRightHint}>profit</Text>
</View>
</View>
))}
</ScrollView>

{/* MONTH MODAL */}
<Modal visible={monthModalOpen} transparent animationType="fade" onRequestClose={() => setMonthModalOpen(false)}>
<Pressable style={styles.modalOverlay} onPress={() => setMonthModalOpen(false)}>
<Pressable style={styles.modalCard} onPress={() => {}}>
<View style={styles.modalHeader}>
<Text style={styles.modalTitle}>Choisir un mois</Text>
<TouchableOpacity style={styles.modalClose} onPress={() => setMonthModalOpen(false)} activeOpacity={0.85}>
<Ionicons name="close" size={18} color="#fff" />
</TouchableOpacity>
</View>

<ScrollView style={{ maxHeight: 420 }}>
{monthOptions.map((m) => {
const selected = m.getFullYear() === monthCursor.getFullYear() && m.getMonth() === monthCursor.getMonth();

return (
<TouchableOpacity
key={`${m.getFullYear()}-${m.getMonth()}`}
activeOpacity={0.85}
onPress={() => {
setMonthModalOpen(false);
setMonthCursor(startOfMonth(m));
}}
style={[styles.modalItem, selected && styles.modalItemActive]}
>
<Text style={[styles.modalItemText, selected && styles.modalItemTextActive]}>{formatMonthLabel(m)}</Text>
{selected ? <Ionicons name="checkmark" size={18} color="#A78BFA" /> : null}
</TouchableOpacity>
);
})}
</ScrollView>
</Pressable>
</Pressable>
</Modal>
</View>
);
}

/* =======================
STYLES
======================= */
const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617" },
center: { justifyContent: "center", alignItems: "center" },
muted: { color: "#A8A3C2", marginTop: 8 },

header: {
paddingTop: 56,
paddingHorizontal: 16,
paddingBottom: 10,
flexDirection: "row",
alignItems: "center",
},
headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
headerSub: { color: "#A8A3C2", fontSize: 12, marginTop: 2, fontWeight: "700" },
headerBtn: {
width: 38,
height: 38,
borderRadius: 12,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
marginLeft: 8,
},

topBar: {
paddingHorizontal: 16,
paddingBottom: 8,
flexDirection: "row",
alignItems: "center",
gap: 10,
},
pill: {
flexDirection: "row",
alignItems: "center",
gap: 8,
paddingVertical: 10,
paddingHorizontal: 12,
borderRadius: 999,
backgroundColor: "#18122B",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
pillText: { color: "#fff", fontWeight: "900", fontSize: 13 },
rangePill: {
flex: 1,
paddingVertical: 10,
paddingHorizontal: 12,
borderRadius: 999,
backgroundColor: "rgba(255,255,255,0.04)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.05)",
alignItems: "center",
},
rangeText: { color: "#A8A3C2", fontSize: 11, fontWeight: "700" },

// 4 cards: on wrap pour petits écrans
kpiRow: {
paddingHorizontal: 16,
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
marginTop: 6,
},
kpiCard: {
width: "48%",
backgroundColor: "#18122B",
borderRadius: 14,
paddingVertical: 12,
paddingHorizontal: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
kpiLabel: { color: "#A8A3C2", fontSize: 11, fontWeight: "900" },
kpiValue: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 8 },
kpiUnit: { color: "#A8A3C2", fontSize: 10, fontWeight: "800", marginTop: 4 },

card: {
marginHorizontal: 16,
marginTop: 12,
backgroundColor: "#18122B",
borderRadius: 14,
padding: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
sectionTitle: { color: "#C6C0DD", fontWeight: "900", fontSize: 13 },
sectionHint: { color: "#A8A3C2", fontSize: 11, fontWeight: "700" },

tooltip: {
position: "absolute",
paddingVertical: 8,
paddingHorizontal: 10,
borderRadius: 12,
backgroundColor: "rgba(10,6,23,0.95)",
borderWidth: 1,
borderColor: "rgba(167,139,250,0.35)",
},
tooltipDate: { color: "#CFC7E8", fontSize: 11, fontWeight: "900" },
tooltipValue: { color: "#fff", fontSize: 12, fontWeight: "900", marginTop: 2 },

listHeader: {
paddingHorizontal: 16,
marginTop: 10,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "baseline",
},

row: {
marginHorizontal: 16,
marginTop: 10,
backgroundColor: "#18122B",
borderRadius: 14,
padding: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
rowTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
rowSub: { color: "#A8A3C2", marginTop: 4, fontSize: 12 },
rowRight: { color: "#C59CFF", fontWeight: "900" },
rowRightHint: { color: "#A8A3C2", marginTop: 4, fontSize: 10, fontWeight: "800" },

modalOverlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.6)",
alignItems: "center",
justifyContent: "center",
paddingHorizontal: 16,
},
modalCard: {
width: "100%",
maxWidth: 420,
backgroundColor: "#120C24",
borderRadius: 16,
padding: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
modalTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
modalClose: {
width: 34,
height: 34,
borderRadius: 10,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
},
modalItem: {
paddingVertical: 12,
paddingHorizontal: 12,
borderRadius: 12,
backgroundColor: "rgba(255,255,255,0.04)",
marginBottom: 8,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
modalItemActive: {
backgroundColor: "rgba(167,139,250,0.12)",
borderWidth: 1,
borderColor: "rgba(167,139,250,0.35)",
},
modalItemText: { color: "#CFC7E8", fontWeight: "900" },
modalItemTextActive: { color: "#fff" },
});
