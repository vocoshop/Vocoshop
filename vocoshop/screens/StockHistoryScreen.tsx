// screens/StockHistoryScreen.tsx
import React, { useEffect, useState, useContext } from "react";
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

const load = async () => {
try {
const res = await API.get(
"/inventory/applied-sessions",
{
headers: {
Authorization: `Bearer ${token}`,
"x-store-id": storeId,
},
}
);

setList(
Array.isArray(res.data) ? res.data : []
);
} catch (err) {
console.log("❌ loadAppliedSessions error:", err);
}

setLoading(false);
};

useEffect(() => {
load();
}, []);

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Historique des stocks</Text>
<View style={{ width: 26 }} />
</View>

<Text style={styles.subtitle}>
Toutes les mises à jour suite aux inventaires
</Text>

{loading ? (
<ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 50 }} />
) : (
<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
{list.length === 0 ? (
<Text style={styles.empty}>Aucun inventaire appliqué.</Text>
) : (
list.map((item, index) => (
<TouchableOpacity
key={index}
style={styles.card}
onPress={() =>
navigation.navigate("AppliedInventoryDetail", {
sessionId: item.sessionId || item._id,
})
}
>
<Ionicons name="clipboard-outline" size={34} color="#C59CFF" />

<View style={{ flex: 1, marginLeft: 14 }}>
<Text style={styles.cardTitle}>
Inventaire appliqué du{" "}
{new Date(item.appliedAt).toLocaleString()}
</Text>

<Text style={styles.cardSubtitle}>
{item.modifiedProducts} produit(s) modifié(s)
</Text>
</View>

<Ionicons name="chevron-forward" size={22} color="#cfcfcf" />
</TouchableOpacity>
))
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
marginBottom: 4,
},

cardSubtitle: {
color: "#A8A3C2",
fontSize: 13,
},
});
