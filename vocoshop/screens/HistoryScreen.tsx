// screens/HistoryScreen.tsx
import React, { useEffect, useState } from "react";
import {
View,
Text,
TouchableOpacity,
StyleSheet,
ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

export default function HistoryScreen({ route }: any) {
const navigation = useNavigation<any>();
const storeId = route.params?.storeId;
const [history, setHistory] = useState<any[]>([]);
const [serverHistory, setServerHistory] = useState<any[]>([]);

// 📌 Charger l’historique employé depuis AsyncStorage
const loadHistory = async () => {
try {
const key = `inventory_history_${storeId}`;
const raw = await AsyncStorage.getItem(key);
const list = raw ? JSON.parse(raw) : [];
setHistory(list);
} catch (err) {
console.log("❌ loadHistory error:", err);
}
};

// 📌 Charger l'historique du backend
const loadServerHistory = async () => {
  try {
    const res = await fetch("/api/inventory/history", {
      headers: {
        "x-store-id": storeId,
      },
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      setServerHistory(data);
    }
  } catch (err) {
    console.log("❌ loadServerHistory error:", err);
  }
};

useEffect(() => {
loadHistory();
loadServerHistory();
}, []);

// Format date FR
const formatDate = (iso: string) => {
const d = new Date(iso);
if (isNaN(d.getTime())) return "Date inconnue";
return d.toLocaleString("fr-FR", {
day: "2-digit",
month: "2-digit",
year: "numeric",
hour: "2-digit",
minute: "2-digit",
});
};

// Regroupement par mois
const groupByMonth = () => {
const groups: any = {};
const allHistory = [...history, ...serverHistory];
allHistory.forEach((item) => {
const date = new Date(item.date || item.createdAt);
const month = date
.toLocaleString("fr-FR", { month: "long" })
.toUpperCase();
const year = date.getFullYear();
const key = `${month} ${year}`;
if (!groups[key]) groups[key] = [];
groups[key].push(item);
});
return groups;
};

const groupedHistory = groupByMonth();

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerContainer}>
<TouchableOpacity
style={styles.backBtn}
onPress={() => navigation.goBack()}
>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.header}>Historique des inventaires</Text>
</View>

<ScrollView style={{ marginTop: 10 }}>
{Object.keys(groupedHistory).length === 0 && (
<Text style={styles.empty}>Aucun inventaire trouvé.</Text>
)}

{Object.keys(groupedHistory).map((monthKey) => (
<View key={monthKey}>
{/* Mois */}
<Text style={styles.monthTitle}>{monthKey}</Text>

{groupedHistory[monthKey].map((item: any) => (
<TouchableOpacity
key={item.id}
style={styles.card}
onPress={() =>
navigation.navigate("InventoryDetails", { data: item })
}
>
<View style={styles.iconBox}>
<Ionicons
name="clipboard-outline"
size={32}
color="#a78bfa"
/>
</View>

<View style={{ flex: 1 }}>
<Text style={styles.title}>
Inventaire du {formatDate(item.date)}
</Text>
<Text style={styles.subtitle}>
{item.count} produit(s) enregistrés
</Text>
</View>
</TouchableOpacity>
))}
</View>
))}
</ScrollView>
</View>
);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
paddingHorizontal: 20,
},

headerContainer: {
marginTop: 55,
flexDirection: "row",
alignItems: "center",
marginBottom: 10,
},

backBtn: {
width: 42,
height: 42,
borderRadius: 20,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
marginRight: 12,
},

header: {
color: "#fff",
fontSize: 22,
fontWeight: "800",
},

monthTitle: {
color: "#8A8A9D",
fontSize: 15,
fontWeight: "700",
marginTop: 25,
marginBottom: 10,
},

empty: {
color: "#aaa",
fontSize: 16,
textAlign: "center",
marginTop: 40,
},

card: {
backgroundColor: "#1a152a",
padding: 20,
borderRadius: 18,
marginBottom: 18,
flexDirection: "row",
alignItems: "center",
},

iconBox: {
width: 50,
height: 50,
borderRadius: 14,
backgroundColor: "#201737",
alignItems: "center",
justifyContent: "center",
marginRight: 15,
},

title: {
color: "#fff",
fontSize: 18,
fontWeight: "700",
},

subtitle: {
color: "#aaa",
marginTop: 4,
},
});
