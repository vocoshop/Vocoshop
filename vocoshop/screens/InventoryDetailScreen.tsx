// screens/InventoryDetailScreen.tsx
import React from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function InventoryDetailScreen({ route }: any) {
const navigation = useNavigation<any>();
const { data } = route.params;

if (!data || !data.products || data.products.length === 0) {
return (
<View style={styles.container}>
<Text style={{ color: "#fff", marginTop: 80 }}>
Aucun détail disponible.
</Text>
</View>
);
}

// -----------------------------------------------------
// 🔥 EXPORTER : Génère un texte et ouvre le partage natif
// -----------------------------------------------------
const handleExport = async () => {
try {
const lines = data.products
.map(
(p: any) =>
`- ${p.name} | Qté: ${p.quantity} | Cat: ${p.category || "-"}`
)
.join("\n");

const text = `📦 INVENTAIRE DU ${new Date(
data.date
).toLocaleString()}\n\nNombre total: ${
data.count
}\n\n--- PRODUITS ---\n${lines}`;

await Share.share({
message: text,
});
} catch (err) {
console.log("❌ Export error:", err);
}
};

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity
style={styles.backBtn}
onPress={() => navigation.goBack()}
>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.header}>Détails de l’inventaire</Text>

{/* 🔥 BOUTON EXPORTER */}
<TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
<Ionicons name="share-outline" size={22} color="#fff" />
</TouchableOpacity>
</View>

<Text style={styles.subHeader}>
{data.count} produit(s) — {new Date(data.date).toLocaleString()}
</Text>

{/* TABLE HEADER */}
<View style={styles.tableHeader}>
<Text style={[styles.col, { flex: 2 }]}>Produit</Text>
<Text style={[styles.col, { flex: 1, textAlign: "center" }]}>Qté</Text>
<Text style={[styles.col, { flex: 1, textAlign: "right" }]}>
Catégorie
</Text>
</View>

<ScrollView style={{ marginTop: 4 }}>
{data.products.map((item: any, i: number) => (
<View key={i} style={styles.tableRow}>
<Text style={[styles.col, { flex: 2 }]}>{item.name}</Text>
<Text
style={[styles.col, { flex: 1, textAlign: "center" }]}
>
{item.quantity}
</Text>
<Text
style={[styles.col, { flex: 1, textAlign: "right" }]}
>
{item.category || "-"}
</Text>
</View>
))}
</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
container: {
flex: 1,
paddingTop: 65, // 🔥 DESCEND L’ENTÊTE
paddingHorizontal: 20,
backgroundColor: "#0A0617",
},

headerRow: {
flexDirection: "row",
alignItems: "center",
},

backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
marginRight: 12,
},

exportBtn: {
marginLeft: "auto",
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
justifyContent: "center",
alignItems: "center",
},

header: {
color: "#fff",
fontSize: 22,
fontWeight: "800",
},

subHeader: {
color: "#aaa",
marginTop: 10,
fontSize: 14,
},

tableHeader: {
marginTop: 20,
paddingVertical: 10,
borderBottomWidth: 1,
borderBottomColor: "#2A2339",
flexDirection: "row",
},

tableRow: {
flexDirection: "row",
paddingVertical: 14,
borderBottomWidth: 1,
borderBottomColor: "#1B1527",
},

col: {
color: "#fff",
fontSize: 15,
},
});
