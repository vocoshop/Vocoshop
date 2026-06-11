// screens/RemoveStockScreen.tsx
import React, { useState, useEffect, useContext } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
ActivityIndicator,
FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type Product = {
_id: string;
name: string;
category?: string;
quantity?: number;
price?: number;
};

export default function RemoveStockScreen({ navigation }: any) {
const { token, storeId } = useContext(AuthContext);

const [products, setProducts] = useState<Product[]>([]);
const [search, setSearch] = useState("");
const [loading, setLoading] = useState(false);

const headers = {
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
};

const loadProducts = async () => {
try {
setLoading(true);
const res = await API.get("/products", {
headers,
params: { search },
});

const data: any = res.data || {};
const list: Product[] =
Array.isArray(data.products)
? data.products
: Array.isArray(data.data)
? data.data
: Array.isArray(data)
? data
: [];

setProducts(list);
} catch (e) {
console.log("❌ Load products (remove) error:", e);
} finally {
setLoading(false);
}
};

useEffect(() => {
loadProducts();
}, [search]);

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
<Text style={styles.title}>Retirer du stock</Text>
</View>

{/* RECHERCHE */}
<View style={styles.searchBox}>
<Ionicons name="search" size={18} color="#777" />
<TextInput
placeholder="Rechercher un produit..."
placeholderTextColor="#777"
value={search}
style={styles.searchInput}
onChangeText={setSearch}
/>
</View>

{loading && <ActivityIndicator size="large" color="#8A4DFF" />}

{/* LISTE PRODUITS */}
<FlatList
data={products}
keyExtractor={(item) => item._id}
contentContainerStyle={{ paddingBottom: 40 }}
renderItem={({ item }) => (
<TouchableOpacity
style={styles.row}
onPress={() =>
navigation.navigate("StockRemoveDetails", { product: item })
}
>
<View>
<Text style={styles.name}>{item.name}</Text>
<Text style={styles.category}>
{item.category || "-"} • Stock actuel :{" "}
{item.quantity ?? 0}
</Text>
</View>
<Ionicons name="chevron-forward" size={20} color="#777" />
</TouchableOpacity>
)}
/>
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", padding: 20, paddingTop: 60 },

headerRow: {
flexDirection: "row",
alignItems: "center",
marginBottom: 20,
},
backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
marginRight: 15,
},
title: { color: "#fff", fontSize: 26, fontWeight: "800" },

searchBox: {
flexDirection: "row",
alignItems: "center",
backgroundColor: "#1A1425",
padding: 12,
borderRadius: 12,
marginBottom: 15,
},
searchInput: { marginLeft: 10, color: "#fff", flex: 1 },

row: {
flexDirection: "row",
justifyContent: "space-between",
paddingVertical: 15,
borderBottomWidth: 1,
borderBottomColor: "#2A233A",
},
name: { color: "#fff", fontSize: 16, fontWeight: "600" },
category: { color: "#777", fontSize: 13, marginTop: 3 },
});
