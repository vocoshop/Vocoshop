// screens/StockDayDetailScreen.tsx
import React from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

export default function StockDayDetailScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { date, items } = route.params as { date: string; items: any[] };

return (
<View style={styles.container}>
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.title}>{date}</Text>
<View style={{ width: 26 }} />
</View>

<Text style={styles.subtitle}>{items.length} opération{items.length > 1 ? "s" : ""}</Text>

<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
{items.map((item: any, idx: number) => {
const isInventory = item.type === "inventory";
const timeStr = item.date
? new Date(item.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
: "";

let iconName: any = "ellipse-outline";
let iconColor = "#A8A3C2";
if (item.type === "inventory") { iconName = "clipboard-outline"; iconColor = "#C59CFF"; }
else if (item.type === "addition") { iconName = "add-circle-outline"; iconColor = "#4ADE80"; }
else if (item.type === "withdrawal") { iconName = "remove-circle-outline"; iconColor = "#F87171"; }

return (
<TouchableOpacity
key={`${item.id}-${idx}`}
style={styles.card}
activeOpacity={isInventory ? 0.7 : 1}
onPress={() => {
if (isInventory) {
navigation.navigate("AppliedInventoryDetail", { sessionId: item.id });
}
}}
>
<View style={[styles.iconWrap, { backgroundColor: iconColor + "18" }]}>
<Ionicons name={iconName} size={22} color={iconColor} />
</View>

<View style={{ flex: 1 }}>
<View style={styles.cardTop}>
<Text style={styles.cardTitle}>{item.label}</Text>
<Text style={styles.cardTime}>{timeStr}</Text>
</View>

{isInventory && (
<Text style={styles.cardMeta}>{item.modifiedProducts} produit(s) modifié(s)</Text>
)}
{item.type === "addition" && (
<Text style={styles.cardMeta}>
<Text style={{ color: "#4ADE80", fontWeight: "700" }}>+{item.quantity}</Text> {item.productName}
</Text>
)}
{item.type === "withdrawal" && (
<Text style={styles.cardMeta}>
<Text style={{ color: "#F87171", fontWeight: "700" }}>-{item.quantity}</Text> {item.productName}
</Text>
)}
</View>

{isInventory && <Ionicons name="chevron-forward" size={18} color="#666" />}
</TouchableOpacity>
);
})}
</ScrollView>
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
fontSize: 20,
fontWeight: "900",
flex: 1,
},
subtitle: {
color: "#888",
fontSize: 13,
marginBottom: 16,
},
card: {
backgroundColor: "#18122B",
padding: 14,
borderRadius: 14,
flexDirection: "row",
alignItems: "center",
marginBottom: 10,
},
iconWrap: {
width: 42,
height: 42,
borderRadius: 12,
alignItems: "center",
justifyContent: "center",
marginRight: 12,
},
cardTop: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
cardTitle: {
color: "#fff",
fontSize: 14,
fontWeight: "700",
},
cardTime: {
color: "#666",
fontSize: 11,
},
cardMeta: {
color: "#A8A3C2",
fontSize: 12,
marginTop: 3,
},
});
