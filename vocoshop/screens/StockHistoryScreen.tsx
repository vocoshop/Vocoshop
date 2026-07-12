// screens/StockHistoryScreen.tsx
import React, { useEffect, useState, useContext, useCallback } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
TouchableOpacity,
ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export default function StockHistoryScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [list, setList] = useState<any[]>([]);
const [loading, setLoading] = useState(true);

const load = useCallback(async () => {
try {
const res = await API.get("/stock-history/all", {
headers: {
Authorization: `Bearer ${token}`,
"x-store-id": storeId,
},
});
setList(Array.isArray(res.data) ? res.data : []);
} catch (err) {
console.log("❌ loadStockHistory error:", err);
}
setLoading(false);
}, [token, storeId]);

useEffect(() => {
load();
}, [load]);

const renderIcon = (type: string) => {
switch (type) {
case "inventory":
return <Ionicons name="clipboard-outline" size={34} color="#C59CFF" />;
case "addition":
return <Ionicons name="add-circle-outline" size={34} color="#4ADE80" />;
case "withdrawal":
return <Ionicons name="remove-circle-outline" size={34} color="#F87171" />;
default:
return <Ionicons name="ellipse-outline" size={34} color="#A8A3C2" />;
}
};

const renderCard = (item: any, index: number) => {
const dateStr = item.date
? new Date(item.date).toLocaleString()
: "Date inconnue";

const isInventory = item.type === "inventory";

return (
<TouchableOpacity
key={`${item.id}-${index}`}
style={styles.card}
onPress={() => {
if (isInventory) {
navigation.navigate("AppliedInventoryDetail", {
sessionId: item.id,
});
}
}}
disabled={!isInventory}
>
{renderIcon(item.type)}

<View style={{ flex: 1, marginLeft: 14 }}>
<Text style={styles.cardTitle}>{item.label}</Text>
<Text style={styles.cardDate}>{dateStr}</Text>

{isInventory && (
<Text style={styles.cardSubtitle}>
{item.modifiedProducts} produit(s) modifié(s)
</Text>
)}

{item.type === "addition" && (
<View style={styles.row}>
<Text style={styles.qtyAdded}>+{item.quantity}</Text>
<Text style={styles.productName}>{item.productName}</Text>
</View>
)}

{item.type === "withdrawal" && (
<View style={styles.row}>
<Text style={styles.qtyRemoved}>-{item.quantity}</Text>
<Text style={styles.productName}>{item.productName}</Text>
</View>
)}
</View>

{isInventory && (
<Ionicons name="chevron-forward" size={22} color="#cfcfcf" />
)}
</TouchableOpacity>
);
};

return (
<View style={styles.container}>
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Historique du stock</Text>
<View style={{ width: 26 }} />
</View>

<Text style={styles.subtitle}>
Toutes les opérations : inventaires, ajouts et retraits
</Text>

{loading ? (
<ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 50 }} />
) : (
<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
{list.length === 0 ? (
<Text style={styles.empty}>Aucune opération pour le moment.</Text>
) : (
list.map((item, index) => renderCard(item, index))
)}
</ScrollView>
)}
</View>
);
}

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
empty: {
color: "#A8A3C2",
marginTop: 30,
fontSize: 15,
textAlign: "center",
},
card: {
backgroundColor: "#18122B",
padding: 16,
borderRadius: 14,
flexDirection: "row",
alignItems: "center",
marginBottom: 12,
},
cardTitle: {
color: "#fff",
fontSize: 15,
fontWeight: "700",
marginBottom: 2,
},
cardDate: {
color: "#A8A3C2",
fontSize: 12,
marginBottom: 4,
},
cardSubtitle: {
color: "#A8A3C2",
fontSize: 13,
},
row: {
flexDirection: "row",
alignItems: "center",
gap: 8,
marginTop: 2,
},
qtyAdded: {
color: "#4ADE80",
fontSize: 15,
fontWeight: "800",
},
qtyRemoved: {
color: "#F87171",
fontSize: 15,
fontWeight: "800",
},
productName: {
color: "#C6C0DD",
fontSize: 13,
flex: 1,
},
});
