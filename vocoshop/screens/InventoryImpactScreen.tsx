// screens/InventoryImpactScreen.tsx
import React, { useContext, useEffect, useState } from "react";
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

interface InventoryImpactSummary {
movementsCount: number;
gainsValue: number;
lossesValue: number;
netImpact: number;
}

interface InventoryImpactItem {
productId: string;
productName: string;
diff: number;
unitPrice: number;
totalValue: number;
date: string | null;
}

interface InventoryImpactResponse {
summary: InventoryImpactSummary;
list: InventoryImpactItem[];
}

export default function InventoryImpactScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [summary, setSummary] = useState<InventoryImpactSummary | null>(null);
const [items, setItems] = useState<InventoryImpactItem[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

const headers = {
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
};

const formatAmount = (v?: number) => {
if (v == null || isNaN(v)) return "0 FCFA";
return `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
};

const formatDate = (value: string | null) => {
if (!value) return "-";
const d = new Date(value);
if (isNaN(d.getTime())) return "-";
return d.toLocaleDateString("fr-FR");
};

const loadImpact = async () => {
try {
const res = await API.get("/report/inventory-diffs", { headers });
const data = res.data as InventoryImpactResponse;

setSummary(data.summary);
setItems(Array.isArray(data.list) ? data.list : []);
} catch (err) {
console.log("❌ loadImpact error:", err);
} finally {
setLoading(false);
setRefreshing(false);
}
};

useEffect(() => {
loadImpact();
}, []);

const netColor =
(summary?.netImpact ?? 0) > 0
? "#4ADE80"
: (summary?.netImpact ?? 0) < 0
? "#F87171"
: "#E5E7EB";

if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
);
}

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Impact inventaire</Text>
<View style={{ width: 26 }} />
</View>

<Text style={styles.subtitle}>
Effet global des inventaires sur la valeur de votre stock
</Text>

{/* ⭐ BOUTON AJOUTÉ POUR RAFRAICHIR LE RAPPORT */}
<TouchableOpacity
style={styles.refreshBtn}
onPress={() => {
setRefreshing(true);
loadImpact();
}}
>
{refreshing ? (
<ActivityIndicator size="small" color="#fff" />
) : (
<Ionicons name="refresh" size={18} color="#fff" />
)}
<Text style={styles.refreshText}>
{refreshing ? "Actualisation..." : "Actualiser l'analyse"}
</Text>
</TouchableOpacity>

<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
{/* 🔹 Résumé global */}
<View style={styles.block}>
<Text style={styles.blockTitle}>Résumé global</Text>

<View style={styles.row}>
<Text style={styles.label}>Nombre d’ajustements</Text>
<Text style={styles.value}>
{summary?.movementsCount ?? 0}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Valeur gagnée (corrections +)</Text>
<Text style={[styles.value, { color: "#4ADE80" }]}>
{formatAmount(summary?.gainsValue)}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Valeur perdue (corrections -)</Text>
<Text style={[styles.value, { color: "#F87171" }]}>
{formatAmount(summary?.lossesValue)}
</Text>
</View>

<View style={[styles.row, { marginTop: 8 }]}>
<Text style={[styles.label, { fontWeight: "700" }]}>
Impact net
</Text>
<Text style={[styles.netValue, { color: netColor }]}>
{formatAmount(summary?.netImpact)}
</Text>
</View>
</View>

{/* 🔹 Liste détaillée des mouvements */}
<View style={styles.block}>
<Text style={styles.blockTitle}>Mouvements d’inventaire</Text>

{items.length === 0 ? (
<Text style={styles.emptyText}>
Aucun ajustement enregistré pour le moment.
</Text>
) : (
items.map((item, index) => {
const diff = item.diff ?? 0;
const diffColor =
diff > 0 ? "#4ADE80" : diff < 0 ? "#F87171" : "#E5E7EB";

const valueColor =
item.totalValue > 0
? "#4ADE80"
: item.totalValue < 0
? "#F87171"
: "#E5E7EB";

return (
<View key={index} style={styles.card}>
<View style={styles.cardHeader}>
<Text style={styles.productName}>
{item.productName}
</Text>
<Text style={styles.dateText}>
{formatDate(item.date)}
</Text>
</View>

<View style={styles.cardRow}>
<Text style={styles.labelSmall}>Écart</Text>
<Text style={[styles.valueSmall, { color: diffColor }]}>
{diff > 0 ? `+${diff}` : diff}
</Text>
</View>

<View style={styles.cardRow}>
<Text style={styles.labelSmall}>Prix unitaire</Text>
<Text style={styles.valueSmall}>
{formatAmount(item.unitPrice)}
</Text>
</View>

<View style={styles.cardRow}>
<Text style={styles.labelSmall}>Impact en valeur</Text>
<Text
style={[styles.valueSmall, { color: valueColor }]}
>
{formatAmount(item.totalValue)}
</Text>
</View>
</View>
);
})
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
paddingTop: 60,
paddingHorizontal: 20,
},
headerRow: {
flexDirection: "row",
alignItems: "center",
marginBottom: 6,
gap: 10,
},
title: {
color: "#fff",
fontSize: 24,
fontWeight: "900",
},
subtitle: {
color: "#A8A3C2",
marginBottom: 20,
},

/* ⭐ STYLE DU BOUTON REFRESH */
refreshBtn: {
flexDirection: "row",
alignItems: "center",
gap: 8,
backgroundColor: "#1E1838",
paddingVertical: 10,
paddingHorizontal: 12,
borderRadius: 10,
marginBottom: 14,
alignSelf: "flex-start",
},
refreshText: {
color: "#fff",
fontSize: 13,
fontWeight: "700",
},

block: {
backgroundColor: "#161228",
padding: 18,
borderRadius: 14,
marginBottom: 18,
},
blockTitle: {
color: "#fff",
fontSize: 17,
fontWeight: "700",
marginBottom: 12,
},
row: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 6,
},
label: {
color: "#C6C0DD",
fontSize: 13,
},
value: {
color: "#fff",
fontSize: 15,
fontWeight: "700",
},
netValue: {
fontSize: 18,
fontWeight: "900",
},
emptyText: {
color: "#A8A3C2",
fontSize: 14,
},
card: {
backgroundColor: "#1E1838",
borderRadius: 12,
padding: 14,
marginBottom: 10,
},
cardHeader: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 8,
},
productName: {
color: "#fff",
fontWeight: "700",
fontSize: 15,
},
dateText: {
color: "#9CA3AF",
fontSize: 12,
},
cardRow: {
flexDirection: "row",
justifyContent: "space-between",
marginTop: 4,
},
labelSmall: {
color: "#A8A3C2",
fontSize: 12,
},
valueSmall: {
color: "#fff",
fontSize: 13,
fontWeight: "700",
},
});
