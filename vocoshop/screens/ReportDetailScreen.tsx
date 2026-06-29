// screens/ReportDetailScreen.tsx
import React, {
useCallback,
useContext,
useEffect,
useMemo,
useState,
} from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
ActivityIndicator,
Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
useNavigation,
useRoute,
useFocusEffect,
} from "@react-navigation/native";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

/* =====================================================
TYPES
===================================================== */
type RouteParams = { reportId: string };

type ReportSale = {
productName: string;
quantity: number;
unitPrice: number;
totalAmount: number;
};

type DailyReport = {
_id: string;
date: string;
totalSales: number;
totalRevenue: number;
grossProfit: number;
cogs: number;
marginPercent: number;
sales: ReportSale[];
};

/* =====================================================
SCREEN
===================================================== */
export default function ReportDetailScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { reportId } = (route.params || {}) as RouteParams;

const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const [loading, setLoading] = useState(true);
const [report, setReport] = useState<DailyReport | null>(null);

const canLoad = !!reportId && !!token && !!storeId;

/* =====================================================
HELPERS
===================================================== */
const money = (v?: number) =>
`${Math.round(v ?? 0).toLocaleString("fr-FR")} FCFA`;

const formatDate = (d: string) =>
new Date(d).toLocaleDateString("fr-FR", {
day: "2-digit",
month: "2-digit",
year: "numeric",
});

/* =====================================================
LOAD
===================================================== */
const load = useCallback(async () => {
if (!canLoad) {
setLoading(false);
return;
}

try {
setLoading(true);
const res = await API.get<DailyReport>(
`/sales/reports/${reportId}`,
{ headers }
);
setReport(res.data ?? null);
} catch (e: any) {
console.log("❌ ReportDetail load error:", e?.response?.data || e);
setReport(null);
} finally {
setLoading(false);
}
}, [canLoad, reportId, headers]);

useEffect(() => {
load();
}, [load]);

useFocusEffect(
useCallback(() => {
load();
}, [load])
);

/* =====================================================
PDF / SHARE
===================================================== */
const sharePdf = useCallback(async () => {
if (!report) return;

try {
const rows = report.sales
.map(
(s) => `
<tr>
<td>${s.productName}</td>
<td>${s.quantity}</td>
<td>${money(s.unitPrice)}</td>
<td>${money(s.totalAmount)}</td>
</tr>
`
)
.join("");

const html = `
<html>
<body style="font-family: Arial; padding: 16px;">
<h2>Bilan du ${formatDate(report.date)}</h2>
<p><strong>Chiffre d'affaires :</strong> ${money(
report.totalRevenue
)}</p>
<p><strong>Nombre de ventes :</strong> ${
report.totalSales
}</p>

<table width="100%" border="1" cellspacing="0" cellpadding="6">
<tr>
<th>Produit</th>
<th>Qté</th>
<th>PU</th>
<th>Total</th>
</tr>
${rows}
</table>
</body>
</html>
`;

const { uri } = await Print.printToFileAsync({ html });

await Sharing.shareAsync(uri, {
mimeType: "application/pdf",
dialogTitle: "Partager le bilan",
UTI: "com.adobe.pdf",
});
} catch (e) {
Alert.alert("Erreur", "Impossible de générer le PDF.");
}
}, [report]);

const copySummary = useCallback(async () => {
if (!report) return;

const text = `Bilan du ${formatDate(report.date)}
CA: ${money(report.totalRevenue)}
Ventes: ${report.totalSales}`;

await Clipboard.setStringAsync(text);
Alert.alert("Copié", "Résumé copié dans le presse-papiers");
}, [report]);

/* =====================================================
UI
===================================================== */
return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Détails du bilan</Text>

<View style={{ flexDirection: "row" }}>
<TouchableOpacity onPress={copySummary} style={{ marginRight: 14 }}>
<Ionicons name="copy-outline" size={22} color="#A8A3C2" />
</TouchableOpacity>

<TouchableOpacity onPress={sharePdf}>
<Ionicons name="share-outline" size={22} color="#A8A3C2" />
</TouchableOpacity>
</View>
</View>

{loading && (
<ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 30 }} />
)}

{!loading && !report && (
<Text style={styles.empty}>Bilan introuvable.</Text>
)}

{!loading && report && (
<ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
{/* SUMMARY */}
<View style={styles.summaryCard}>
<Text style={styles.date}>{formatDate(report.date)}</Text>

<View style={styles.summaryRow}>
<Text style={styles.summaryLabel}>Chiffre d’affaires</Text>
<Text style={styles.summaryValue}>
{money(report.totalRevenue)}
</Text>
</View>

<View style={styles.summaryRow}>
<Text style={styles.summaryLabel}>Nombre de ventes</Text>
<Text style={styles.summaryValue}>
{report.totalSales}
</Text>
</View>

<View style={[styles.summaryRow, styles.profitRow]}>
<Text style={styles.profitLabel}>Bénéfice</Text>
<Text style={styles.profitValue}>
{money(report.grossProfit ?? 0)}
</Text>
</View>
</View>

{/* ITEMS */}
<Text style={styles.sectionTitle}>Produits vendus</Text>

{report.sales.map((s, idx) => (
<View key={idx} style={styles.itemRow}>
<View style={{ flex: 1 }}>
<Text style={styles.productName}>{s.productName}</Text>
<Text style={styles.productMeta}>
{s.quantity} × {money(s.unitPrice)}
</Text>
</View>

<Text style={styles.amount}>
{money(s.totalAmount)}
</Text>
</View>
))}
</ScrollView>
)}
</View>
);
}

/* =====================================================
STYLES
===================================================== */
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
paddingTop: 60,
paddingHorizontal: 20,
},
headerRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginBottom: 14,
},
title: {
color: "#fff",
fontSize: 18,
fontWeight: "900",
},
summaryCard: {
backgroundColor: "#161228",
padding: 18,
borderRadius: 14,
},
date: {
color: "#C6C0DD",
marginBottom: 10,
fontWeight: "700",
},
summaryRow: {
flexDirection: "row",
justifyContent: "space-between",
marginTop: 8,
},
summaryLabel: {
color: "#9CA3AF",
},
summaryValue: {
color: "#FACC15",
fontWeight: "900",
},
sectionTitle: {
color: "#fff",
fontWeight: "800",
marginTop: 18,
marginBottom: 10,
},
itemRow: {
backgroundColor: "#1E1838",
padding: 14,
borderRadius: 10,
marginTop: 10,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},
productName: {
color: "#fff",
fontWeight: "800",
},
productMeta: {
color: "#9CA3AF",
marginTop: 4,
fontSize: 12,
},
amount: {
color: "#FACC15",
fontWeight: "900",
},
empty: {
color: "#9CA3AF",
marginTop: 20,
},
profitRow: {
borderTopWidth: 1,
borderTopColor: "#2A2040",
paddingTop: 10,
marginTop: 10,
},
profitLabel: {
color: "#4ADE80",
fontWeight: "700",
},
profitValue: {
color: "#4ADE80",
fontWeight: "900",
},
});
