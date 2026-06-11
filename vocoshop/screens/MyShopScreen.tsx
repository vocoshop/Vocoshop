// screens/MyShopScreen.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
Alert,
ActivityIndicator,
Modal,
Pressable,
Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Calendar, DateData } from "react-native-calendars";
import { LineChart } from "react-native-chart-kit";

import { AuthContext } from "../src/api/context/AuthContext";
import { getMyStoreProfile, getStoreAnalysis } from "../src/api/services/storeService";

const screenWidth = Dimensions.get("window").width;

/* ================== TYPES ================== */
type Period = { from?: Date; to?: Date };
type PickerTarget = "FROM" | "TO" | null;

type DailyPoint = {
date: string;
totalSales: number;
totalItems: number;
countSales: number;
};

type StoreAnalysis = {
period?: { from: string; to: string; days: number };
summary?: {
totalSales: number;
totalItemsSold: number;
totalTransactions: number;
avgDailySales: number;
};
insights?: string[];
topProducts?: Array<{ productId: string; name: string; quantity: number; amount: number }>;
slowProducts?: Array<{
productId: string;
name: string;
quantity: number;
avgPerDay: number;
daysSinceLastSale: number | null;
}>;
days?: {
bestDay?: { name: string; totalSales: number };
worstDay?: { name: string; totalSales: number };
};
series?: { daily?: DailyPoint[] };
};

/* ================== HELPERS ================== */
function startOfDay(d: Date) {
return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toYMD(d: Date) {
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
}

function formatFR(d?: Date) {
if (!d) return "—";
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${day}/${m}/${y}`;
}

function clampDate(d: Date, min?: Date, max?: Date) {
let x = d;
if (min && x < min) x = min;
if (max && x > max) x = max;
return x;
}

function buildMarks(from?: Date, to?: Date) {
// V1: on marque juste début + fin
const marks: Record<string, any> = {};
if (from) {
marks[toYMD(from)] = {
selected: true,
selectedColor: "#8A4DFF",
selectedTextColor: "#fff",
};
}
if (to) {
marks[toYMD(to)] = {
selected: true,
selectedColor: "#8A4DFF",
selectedTextColor: "#fff",
};
}
return marks;
}

function formatCompactNumber(n: number) {
const v = Math.round(Number(n || 0));
if (v >= 1000000) return `${Math.round(v / 100000) / 10}M`;
if (v >= 1000) return `${Math.round(v / 100) / 10}K`;
return String(v);
}

function safeNum(n: any) {
const x = Number(n);
return Number.isFinite(x) ? x : 0;
}

function buildFullDailySeries(params: {
daily: DailyPoint[];
fromISO: string;
toISO: string;
maxLabels?: number;
}) {
const { daily, fromISO, toISO, maxLabels = 7 } = params;

const byDate = new Map<string, number>();
for (const d of daily) {
const key = String(d.date).slice(0, 10); // YYYY-MM-DD
byDate.set(key, safeNum(d.totalSales));
}

const start = new Date(`${fromISO}T00:00:00`);
const end = new Date(`${toISO}T00:00:00`);
if (start > end) {
return { labels: ["—"], data: [0] };
}

const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
const step = Math.max(1, Math.ceil(totalDays / maxLabels));

const labels: string[] = [];
const data: number[] = [];

for (let i = 0; i < totalDays; i++) {
const cur = new Date(start);
cur.setDate(start.getDate() + i);

const yyyy = cur.getFullYear();
const mm = String(cur.getMonth() + 1).padStart(2, "0");
const dd = String(cur.getDate()).padStart(2, "0");
const key = `${yyyy}-${mm}-${dd}`;

data.push(byDate.get(key) ?? 0);
labels.push(i % step === 0 ? `${dd}/${mm}` : "");
}

return {
labels: labels.length ? labels : ["—"],
data: data.length ? data : [0],
};
}

/* ================== SMALL COMPONENTS ================== */
function EmptyLine({ children }: { children: string }) {
return <Text style={styles.analysisLine}>{children}</Text>;
}

type SimpleSheetProps = {
visible: boolean;
title: string;
onClose: () => void;
children: React.ReactNode;
};

function SimpleSheet({ visible, title, onClose, children }: SimpleSheetProps) {
return (
<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
<Pressable style={styles.modalOverlay} onPress={onClose} />
<View style={styles.sheetCard}>
<View style={styles.sheetHeader}>
<Text style={styles.sheetTitle}>{title}</Text>
<TouchableOpacity onPress={onClose} activeOpacity={0.8}>
<Ionicons name="close" size={22} color="#C6C0DD" />
</TouchableOpacity>
</View>

{children}

<TouchableOpacity
style={[styles.btn, { marginTop: 12 }]}
onPress={onClose}
activeOpacity={0.9}
>
<Text style={styles.btnText}>Fermer</Text>
</TouchableOpacity>
</View>
</Modal>
);
}

/* ================== SCREEN ================== */
export default function MyShopScreen() {
const navigation = useNavigation<any>();
const { token } = useContext(AuthContext);

const headers = useMemo(
() => ({ Authorization: token ? `Bearer ${token}` : "" }),
[token]
);

// bornes calendrier
const [minDate, setMinDate] = useState<Date | undefined>(undefined);
const maxDate = useMemo(() => startOfDay(new Date()), []);

// période (début/fin)
const [period, setPeriod] = useState<Period>({});
const [viewMode, setViewMode] = useState<"DAY" | "PERIOD">("DAY");

// modals
const [pickerOpen, setPickerOpen] = useState(false);
const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
const [topModalOpen, setTopModalOpen] = useState(false);
const [slowModalOpen, setSlowModalOpen] = useState(false);

// data
const [analysis, setAnalysis] = useState<StoreAnalysis | null>(null);
const [loadingAnalysis, setLoadingAnalysis] = useState(false);
const [loadingCompare, setLoadingCompare] = useState(false);

/* =====================================================
1) Charger date création boutique => minDate
===================================================== */
useEffect(() => {
const loadCreatedAt = async () => {
try {
if (!token) return;

const profile: any = await getMyStoreProfile(headers);

// ⚠️ /store/me ne renvoie pas createdAt actuellement → fallback 90 jours
const raw =
profile?.createdAt ||
profile?.storeCreatedAt ||
profile?.store?.createdAt ||
null;

if (raw) {
const d = startOfDay(new Date(raw));
setMinDate(clampDate(d, undefined, maxDate));
return;
}

const fb = new Date(maxDate);
fb.setDate(fb.getDate() - 90);
setMinDate(startOfDay(fb));
} catch {
const fb = new Date(maxDate);
fb.setDate(fb.getDate() - 90);
setMinDate(startOfDay(fb));
}
};

loadCreatedAt();
}, [headers, maxDate, token]);

/* =====================================================
2) Charger l’analyse du jour (par défaut)
===================================================== */
const loadDayAnalysis = useCallback(async () => {
if (!token) return;

try {
setLoadingAnalysis(true);
const data = await getStoreAnalysis<StoreAnalysis>(headers);
setAnalysis(data);
setViewMode("DAY");
} catch (e: any) {
console.log("❌ loadDayAnalysis", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", "Impossible de charger l’analyse du jour.");
} finally {
setLoadingAnalysis(false);
}
}, [headers, token]);

useEffect(() => {
loadDayAnalysis();
}, [loadDayAnalysis]);

/* =====================================================
Calendar helpers
===================================================== */
const openPicker = useCallback(
(target: PickerTarget) => {
if (!minDate) return;
setPickerTarget(target);
setPickerOpen(true);
},
[minDate]
);

const closePicker = useCallback(() => {
setPickerOpen(false);
setPickerTarget(null);
}, []);

const onSelectDay = useCallback(
(day: DateData) => {
if (!pickerTarget || !minDate) return;

const selected = startOfDay(new Date(day.dateString));
const safe = clampDate(selected, minDate, maxDate);

setPeriod((prev) => {
const next: Period = { ...prev };

if (pickerTarget === "FROM") {
next.from = safe;
if (next.to && next.to < safe) next.to = undefined;
} else {
next.to = safe;
if (next.from && next.from > safe) next.from = undefined;
}
return next;
});

closePicker();
},
[pickerTarget, minDate, maxDate, closePicker]
);

/* =====================================================
Compare (API réelle)
===================================================== */
const onCompare = useCallback(async () => {
if (loadingCompare) return;

const from = period.from ? startOfDay(period.from) : undefined;
const to = period.to ? startOfDay(period.to) : undefined;

if (!from || !to) {
Alert.alert("Période incomplète", "Choisis une date de début et une date de fin.");
return;
}
if (from > to) {
Alert.alert("Période invalide", "La date de début doit être avant la date de fin.");
return;
}

try {
setLoadingCompare(true);
setLoadingAnalysis(true);

const params = { from: toYMD(from), to: toYMD(to) };
const data = await getStoreAnalysis<StoreAnalysis>(headers, params);

setAnalysis(data);
setViewMode("PERIOD");
} catch (e: any) {
console.log("❌ onCompare", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", "Impossible de charger l’analyse de cette période.");
} finally {
setLoadingCompare(false);
setLoadingAnalysis(false);
}
}, [headers, loadingCompare, period.from, period.to]);

/* =====================================================
Derived UI values
===================================================== */
const minDateString = useMemo(() => (minDate ? toYMD(minDate) : undefined), [minDate]);
const maxDateString = useMemo(() => toYMD(maxDate), [maxDate]);

const calendarCurrent = useMemo(() => {
const base = period.from || period.to || maxDate;
return toYMD(base);
}, [period.from, period.to, maxDate]);

const markedDates = useMemo(() => buildMarks(period.from, period.to), [period.from, period.to]);

const summary = analysis?.summary;
const insights = analysis?.insights ?? [];
const topProducts = analysis?.topProducts ?? [];
const slowProducts = analysis?.slowProducts ?? [];

const periodLabel = useMemo(() => {
if (viewMode === "DAY") return "";
return `Période : ${formatFR(period.from)} → ${formatFR(period.to)}`;
}, [period.from, period.to, viewMode]);

/* =====================================================
CHART DATA
- DAY : on utilise les points renvoyés (pas besoin de "remplir")
- PERIOD: on remplit la période (jours manquants => 0) pour éviter les écarts
===================================================== */
const chart = useMemo(() => {
const daily = (analysis?.series?.daily ?? []).slice();

// Garde uniquement les jours où totalSales > 0 (comme "Mes bilans")
const filtered = daily.filter((d) => safeNum(d.totalSales) > 0);

if (!filtered.length) {
return { labels: ["—"], values: [0] };
}

const labelsRaw = filtered.map((d) => {
const dd = String(d.date).slice(8, 10);
const mm = String(d.date).slice(5, 7);
return `${dd}/${mm}`;
});

const values = filtered.map((d) => safeNum(d.totalSales));

// Limite le nombre de labels visibles pour éviter "collé-collé"
const maxLabels = 7;
const step = Math.max(1, Math.ceil(labelsRaw.length / maxLabels));

// ✅ force aussi le dernier label à apparaître
const compactLabels = labelsRaw.map((l, i) =>
i % step === 0 || i === labelsRaw.length - 1 ? l : ""
);

return {
labels: compactLabels.length ? compactLabels : ["—"],
values: values.length ? values : [0],
};
}, [analysis?.series?.daily]);

const chartData = useMemo(
() => ({
labels: chart.labels,
datasets: [{ data: chart.values }],
}),
[chart.labels, chart.values]
);

// largeur dynamique basée sur le nombre de points (pas sur 31 jours)
const chartWidth = useMemo(() => {
const pointsCount = chart.values.length || 0;
const minWidth = screenWidth - 40;
return Math.max(minWidth, pointsCount * 70); // 70px/point => bien lisible
}, [chart.values.length]);

/* =====================================================
CTA handlers (Top / Slow)
===================================================== */
const openTop = useCallback(() => {
if (!topProducts.length) {
Alert.alert("Top produits", "Aucune donnée pour l’instant.");
return;
}
setTopModalOpen(true);
}, [topProducts.length]);

const openSlow = useCallback(() => {
if (!slowProducts.length) {
Alert.alert("Produits moins performants", "Aucune donnée pour l’instant.");
return;
}
setSlowModalOpen(true);
}, [slowProducts.length]);

const closeTop = useCallback(() => setTopModalOpen(false), []);
const closeSlow = useCallback(() => setSlowModalOpen(false), []);

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Ma boutique</Text>
<View style={{ width: 26 }} />
</View>

<ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
{/* COMPARE CARD */}
<View style={styles.card}>
<Text style={styles.cardTitle}>Comparer mes ventes</Text>
<Text style={styles.cardSub}>
Voir si ta boutique progresse ou baisse selon une période.
</Text>

<Text style={styles.blockTitle}>Période</Text>

<View style={styles.row}>
<TouchableOpacity
style={styles.dateBox}
activeOpacity={0.85}
onPress={() => openPicker("FROM")}
disabled={!minDate}
>
<Text style={styles.dateLabel}>Début</Text>
<Text style={styles.dateValue}>{formatFR(period.from)}</Text>
</TouchableOpacity>

<TouchableOpacity
style={styles.dateBox}
activeOpacity={0.85}
onPress={() => openPicker("TO")}
disabled={!minDate}
>
<Text style={styles.dateLabel}>Fin</Text>
<Text style={styles.dateValue}>{formatFR(period.to)}</Text>
</TouchableOpacity>
</View>

<TouchableOpacity
style={[styles.btn, loadingCompare ? { opacity: 0.75 } : null]}
onPress={onCompare}
activeOpacity={0.9}
disabled={loadingCompare}
>
{loadingCompare ? (
<View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
<ActivityIndicator color="#fff" />
<Text style={styles.btnText}>Comparaison...</Text>
</View>
) : (
<Text style={styles.btnText}>Comparer</Text>
)}
</TouchableOpacity>
</View>

{/* ANALYSE */}
<View style={styles.card}>
<View style={styles.rowBetween}>
<Text style={styles.cardTitle}>
{viewMode === "DAY" ? "Analyse du jour" : "Analyse de la période"}
</Text>

{viewMode === "PERIOD" ? (
<TouchableOpacity activeOpacity={0.85} onPress={loadDayAnalysis} style={styles.smallChip}>
<Text style={styles.smallChipText}>Analyse du jour</Text>
</TouchableOpacity>
) : null}
</View>

<Text style={styles.cardSub}>
{viewMode === "DAY"
? "Résumé clair de ta boutique aujourd’hui (graphique + conseils)."
: periodLabel}
</Text>

{loadingAnalysis ? (
<ActivityIndicator color="#fff" style={{ marginTop: 14 }} />
) : (
<>
{!!summary && (
<View style={styles.kpiRow}>
<View style={styles.kpiBox}>
<Text style={styles.kpiLabel}>Ventes (FCFA)</Text>
<Text style={styles.kpiValue}>{summary.totalSales ?? 0}</Text>
</View>

<View style={styles.kpiBox}>
<Text style={styles.kpiLabel}>Moy./jour</Text>
<Text style={styles.kpiValue}>{summary.avgDailySales ?? 0}</Text>
</View>

<View style={styles.kpiBox}>
<Text style={styles.kpiLabel}>Transactions</Text>
<Text style={styles.kpiValue}>{summary.totalTransactions ?? 0}</Text>
</View>
</View>
)}

{/* GRAPHIQUE */}
<View style={{ marginTop: 16 }}>
<Text style={styles.blockTitle}>Évolution des ventes</Text>

<ScrollView
horizontal
showsHorizontalScrollIndicator={false}
nestedScrollEnabled
contentContainerStyle={{ paddingRight: 16 }}
>
<LineChart
data={chartData}
width={chartWidth}
height={220}
fromZero
withDots
withShadow={false}
withInnerLines={false}
withOuterLines={false}
segments={4}
formatYLabel={(y) => formatCompactNumber(Number(y || 0))}
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
style={{ borderRadius: 14 }}
/>
</ScrollView>
</View>

{/* CTA Top / Slow */}
<View style={styles.ctaGroup}>
<TouchableOpacity style={styles.ctaRow} activeOpacity={0.85} onPress={openTop}>
<View style={styles.ctaLeft}>
<Text style={styles.ctaTitle}>Top produits</Text>
<Text style={styles.ctaSub}>Voir les produits les plus vendus</Text>
</View>
<Ionicons name="chevron-forward" size={18} color="#C6C0DD" />
</TouchableOpacity>

<TouchableOpacity style={styles.ctaRow} activeOpacity={0.85} onPress={openSlow}>
<View style={styles.ctaLeft}>
<Text style={styles.ctaTitle}>Produits moins performants</Text>
<Text style={styles.ctaSub}>Voir ceux qui sortent le moins</Text>
</View>
<Ionicons name="chevron-forward" size={18} color="#C6C0DD" />
</TouchableOpacity>
</View>

{/* INSIGHTS */}
<View style={styles.analysisBox}>
{insights.length === 0 ? (
<EmptyLine>
Aucune donnée pour l’instant. Enregistre des ventes pour débloquer l’analyse.
</EmptyLine>
) : (
insights.map((t, idx) => (
<Text key={`${idx}-${t}`} style={styles.analysisLine}>
• {t}
</Text>
))
)}
</View>
</>
)}
</View>
</ScrollView>

{/* MODAL CALENDRIER */}
<Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={closePicker}>
<Pressable style={styles.modalOverlay} onPress={closePicker} />

<View style={styles.modalCard}>
<View style={styles.modalHeader}>
<Text style={styles.modalTitle}>
{pickerTarget === "FROM" ? "Choisir la date de début" : "Choisir la date de fin"}
</Text>
<TouchableOpacity onPress={closePicker} activeOpacity={0.8}>
<Ionicons name="close" size={22} color="#C6C0DD" />
</TouchableOpacity>
</View>

<Calendar
current={calendarCurrent}
onDayPress={onSelectDay}
minDate={minDateString}
maxDate={maxDateString}
markedDates={markedDates}
hideExtraDays
enableSwipeMonths
disableMonthChange={false}
firstDay={1}
theme={{
backgroundColor: "transparent",
calendarBackground: "transparent",
textSectionTitleColor: "rgba(255,255,255,0.55)",
dayTextColor: "#fff",
monthTextColor: "#fff",
textDisabledColor: "rgba(255,255,255,0.18)",
arrowColor: "#8A4DFF",
todayTextColor: "#9AF5C7",
selectedDayBackgroundColor: "#8A4DFF",
selectedDayTextColor: "#fff",
}}
/>

<View style={styles.modalFooter}>
<Text style={styles.modalHint}>
Dates possibles : du {minDate ? formatFR(minDate) : "—"} au {formatFR(maxDate)}
</Text>
</View>
</View>
</Modal>

{/* SHEET: TOP PRODUITS */}
<SimpleSheet visible={topModalOpen} title="Top produits" onClose={closeTop}>
<ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
{topProducts.map((p, idx) => (
<View key={`${p.productId}-${idx}`} style={styles.itemRow}>
<View style={{ flex: 1 }}>
<Text style={styles.itemName} numberOfLines={1}>
{idx + 1}. {p.name}
</Text>
<Text style={styles.itemMeta}>
{p.quantity} vendu(s) • {Math.round(p.amount || 0)} FCFA
</Text>
</View>
</View>
))}
</ScrollView>
</SimpleSheet>

{/* SHEET: PRODUITS MOINS PERFORMANTS */}
<SimpleSheet visible={slowModalOpen} title="Produits moins performants" onClose={closeSlow}>
<ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
{slowProducts.map((p, idx) => (
<View key={`${p.productId}-${idx}`} style={styles.itemRow}>
<View style={{ flex: 1 }}>
<Text style={styles.itemName} numberOfLines={1}>
{idx + 1}. {p.name}
</Text>
<Text style={styles.itemMeta}>
{p.quantity} vendu(s) • {p.avgPerDay}/jour
{typeof p.daysSinceLastSale === "number" ? ` • ${p.daysSinceLastSale}j sans vente` : ""}
</Text>
</View>
</View>
))}
</ScrollView>
</SimpleSheet>
</View>
);
}

/* ================== STYLES ================== */
const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617" },

header: {
paddingTop: 60,
paddingHorizontal: 20,
paddingBottom: 16,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},
headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },

card: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginTop: 14,
padding: 16,
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},

cardTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
cardSub: { color: "#A8A3C2", fontSize: 12, marginTop: 6, lineHeight: 18 },

blockTitle: {
color: "#C6C0DD",
fontSize: 13,
fontWeight: "900",
marginTop: 14,
marginBottom: 10,
},

row: { flexDirection: "row", gap: 12 },
rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

dateBox: {
flex: 1,
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
borderRadius: 14,
paddingHorizontal: 14,
paddingVertical: 12,
},
dateLabel: { color: "#A8A3C2", fontSize: 12, fontWeight: "800" },
dateValue: { marginTop: 8, color: "#fff", fontSize: 18, fontWeight: "900" },

btn: {
marginTop: 14,
width: "100%",
backgroundColor: "#8A4DFF",
paddingVertical: 14,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },

kpiRow: { marginTop: 12, flexDirection: "row", gap: 10 },
kpiBox: {
flex: 1,
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 14,
padding: 10,
},
kpiLabel: { color: "#A8A3C2", fontSize: 11, fontWeight: "800" },
kpiValue: { marginTop: 6, color: "#fff", fontSize: 16, fontWeight: "900" },

analysisBox: {
marginTop: 12,
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 14,
padding: 12,
},
analysisLine: { color: "#C6C0DD", fontSize: 12, lineHeight: 18, marginBottom: 8 },

smallChip: {
paddingVertical: 8,
paddingHorizontal: 10,
borderRadius: 12,
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
smallChipText: { color: "#C6C0DD", fontWeight: "900", fontSize: 12 },

/* CTA group */
ctaGroup: { marginTop: 14, gap: 10 },
ctaRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 14,
paddingHorizontal: 12,
paddingVertical: 12,
},
ctaLeft: { flex: 1, paddingRight: 10 },
ctaTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
ctaSub: { marginTop: 4, color: "#A8A3C2", fontSize: 11, lineHeight: 16 },

/* MODAL */
modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
modalCard: {
position: "absolute",
left: 16,
right: 16,
top: 140,
backgroundColor: "#18122B",
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
padding: 14,
},
modalHeader: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 10,
},
modalTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
modalFooter: { marginTop: 10 },
modalHint: { color: "#A8A3C2", fontSize: 11 },

/* Sheet */
sheetCard: {
position: "absolute",
left: 16,
right: 16,
bottom: 26,
backgroundColor: "#18122B",
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
padding: 14,
},
sheetHeader: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 10,
},
sheetTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },

itemRow: {
paddingVertical: 10,
borderBottomWidth: 1,
borderBottomColor: "rgba(255,255,255,0.06)",
},
itemName: { color: "#fff", fontWeight: "900", fontSize: 13 },
itemMeta: { marginTop: 4, color: "#A8A3C2", fontSize: 11, lineHeight: 16 },
});