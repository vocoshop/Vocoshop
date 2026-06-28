// screens/OrdersScreen.tsx
import React, { useContext, useCallback, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
FlatList,
ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type OrderItem = {
_id: string;
items?: any[];
status: "draft" | "confirmed";
createdAt: string;
};

export default function OrdersScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [orders, setOrders] = useState<OrderItem[]>([]);
const [loading, setLoading] = useState(true);

const headers = {
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
};

/* ============================
LOAD ORDERS
============================ */
const loadOrders = async () => {
try {
setLoading(true);
const res = await API.get("/orders", { headers });
setOrders(Array.isArray(res.data) ? res.data : []);
} catch (err) {
console.log("❌ OrdersScreen error:", err);
setOrders([]);
} finally {
setLoading(false);
}
};

useFocusEffect(
useCallback(() => {
if (!token || !storeId) return;
loadOrders();
}, [token, storeId])
);

/* ============================
RENDER
============================ */
const renderItem = ({ item }: { item: OrderItem }) => {
const isDraft = item.status === "draft";

return (
<TouchableOpacity
style={styles.card}
activeOpacity={0.85}
onPress={() =>
navigation.navigate(
isDraft ? "EditOrder" : "OrderDetail",
{ orderId: item._id }
)
}
>
<View style={styles.row}>
<Text style={styles.orderTitle}>
Commande #{item._id.slice(-6)}
</Text>

<Text
style={[
styles.status,
{ color: isDraft ? "#FACC15" : "#4ADE80" },
]}
>
{isDraft ? "Brouillon" : "Envoyée"}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.meta}>
{item.items?.length || 0} article(s)
</Text>
<Text style={styles.meta}>
{new Date(item.createdAt).toLocaleDateString("fr-FR")}
</Text>
</View>
</TouchableOpacity>
);
};

if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#8A4DFF" />
</View>
);
}

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<Text style={styles.title}>Commandes</Text>

<TouchableOpacity
style={styles.addBtn}
onPress={() => navigation.navigate("CreateOrder")}
>
<Ionicons name="add" size={22} color="#fff" />
</TouchableOpacity>
</View>

{orders.length === 0 ? (
<Text style={styles.empty}>
Aucune commande pour le moment
</Text>
) : (
<FlatList
data={orders}
keyExtractor={(item) => item._id}
renderItem={renderItem}
contentContainerStyle={{ paddingBottom: 120 }}
/>
)}
</View>
);
}

/* ============================
STYLES
============================ */
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
paddingTop: 60,
paddingHorizontal: 20,
},

headerRow: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 25,
},

title: {
fontSize: 26,
color: "#fff",
fontWeight: "900",
},

addBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "#8A4DFF",
alignItems: "center",
justifyContent: "center",
},

empty: {
color: "#A8A3C2",
textAlign: "center",
marginTop: 40,
},

card: {
backgroundColor: "#1E1838",
borderRadius: 14,
padding: 14,
marginBottom: 12,
},

row: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},

orderTitle: {
color: "#fff",
fontWeight: "900",
fontSize: 15,
},

status: {
fontWeight: "900",
fontSize: 13,
},

meta: {
color: "#A8A3C2",
fontSize: 12,
marginTop: 6,
},
});
