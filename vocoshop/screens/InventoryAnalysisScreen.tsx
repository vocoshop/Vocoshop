// screens/InventoryAnalysisScreen.tsx
import React, { useEffect, useState, useContext } from "react";
import {
View,
Text,
StyleSheet,
ActivityIndicator,
ScrollView,
TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

/* TYPES alignés au BACK */
interface Summary {
movementsCount: number;
gainsValue: number;
lossesValue: number;
netImpact: number;
}

interface InventoryItem {
productId: string;
productName: string;
diff: number;
unitPrice: number;
totalValue: number;
date: string | null;
}

interface BackendResponse {
summary: Summary;
list: InventoryItem[];
}

export default function InventoryAnalysisScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [summary, setSummary] = useState<Summary | null>(null);
const [list, setList] = useState<InventoryItem[]>([]);
const [loading, setLoading] = useState(true);

const headers = {
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
};

const loadData = async () => {
try {
const res = await API.get("/report/inventory-diffs", { headers });

const data = res.data as BackendResponse;
setSummary(data.summary);
setList(data.list);
} catch (err) {
console.log("❌ loadData error:", err);
} finally {
setLoading(false);
}
};

useEffect(() => {
loadData();
}, []);

const formatAmount = (v?: number) => {
if (!v || isNaN(v)) return "0 FCFA";
return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
};

const formatDate = (d: string | null) => {
if (!d) return "--";
return new Date(d).toLocaleDateString("fr-FR");
};

const isPositive = (n: number) => n > 0;

if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
);
}

return (
<View style={styles.container}>
{/* BACK */}
<TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Impact Inventaire</Text>

{/* ------------------ SUMMARY ------------------ */}
{summary && (
<View style={styles.block}>
<Text style={styles.blockTitle}>📊 Résumé Général</Text>

<View style={styles.row}>
<Text style={styles.label}>Nombre d'ajustements</Text>
<Text style={styles.value}>{summary.movementsCount}</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Gains cumulés</Text>
<Text style={[styles.value, { color: "#4ADE80" }]}>
{formatAmount(summary.gainsValue)}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Pertes cumulées</Text>
<Text style={[styles.value, { color: "#F87171" }]}>
{formatAmount(summary.lossesValue)}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Impact net</Text>
<Text
style={[
styles.value,
{
color:
summary.netImpact >= 0 ? "#4ADE80" : "#F87171",
},
]}
>
{formatAmount(summary.netImpact)}
</Text>
</View>
</View>
)}

{/* ------------------ LIST DES MOUVEMENTS ------------------ */}
<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
<View style={styles.block}>
<Text style={styles.blockTitle}>
📦 Détails des mouvements ({list.length})
</Text>

{list.length === 0 ? (
<Text style={{ color: "#A8A3C2", marginTop: 4 }}>Aucun mouvement.</Text>
) : (
list.map((item, idx) => (
<View style={styles.card} key={idx}>
<Text style={styles.productName}>{item.productName}</Text>
<Text style={styles.rowDate}>{formatDate(item.date)}</Text>

<View style={styles.line} />

<View style={styles.row}>
<Text style={styles.label}>Écart compté</Text>
<Text
style={[
styles.value,
{ color: isPositive(item.diff) ? "#4ADE80" : "#F87171" },
]}
>
{item.diff > 0 ? `+${item.diff}` : item.diff}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Prix unitaire</Text>
<Text style={styles.value}>
{formatAmount(item.unitPrice)}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Valeur totale</Text>
<Text
style={[
styles.value,
{ color: isPositive(item.totalValue) ? "#4ADE80" : "#F87171" },
]}
>
{formatAmount(item.totalValue)}
</Text>
</View>
</View>
))
)}
</View>
</ScrollView>
</View>
);
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
paddingTop: 55,
paddingHorizontal: 20,
},
backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
marginBottom: 14,
},
title: {
color: "#fff",
fontSize: 24,
fontWeight: "900",
marginBottom: 14,
},
block: {
backgroundColor: "#161228",
padding: 16,
borderRadius: 14,
marginBottom: 18,
},
blockTitle: {
color: "#fff",
fontSize: 16,
fontWeight: "800",
marginBottom: 12,
},
row: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 8,
},
label: {
color: "#A8A3C2",
fontSize: 14,
},
value: {
color: "#fff",
fontSize: 15,
fontWeight: "700",
},
card: {
backgroundColor: "#1E1838",
padding: 14,
borderRadius: 12,
marginBottom: 10,
},
productName: {
color: "#fff",
fontSize: 15,
fontWeight: "800",
},
rowDate: {
color: "#C6C0DD",
fontSize: 11,
marginBottom: 6,
},
line: {
height: 1,
backgroundColor: "#2D2450",
marginVertical: 8,
},
});
