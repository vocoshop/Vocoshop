// screens/AddStockScreen.tsx
import React, { useState, useCallback, useContext, useEffect, useMemo } from "react";
import {
View,
Text,
TextInput,
ActivityIndicator,
FlatList,
TouchableOpacity,
StyleSheet,
RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

// -----------------------------
// TYPES
// -----------------------------
type Product = {
_id: string;
name: string;
category?: string;
quantity?: number;
};

type ApiResponse =
| Product[]
| {
products: Product[];
total?: number;
page?: number;
limit?: number;
totalPages?: number;
};

// -----------------------------
// COMPONENT
// -----------------------------
export default function AddStockScreen({ navigation }: any) {
const { token } = useContext(AuthContext);

const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(false);
const [refreshing, setRefreshing] = useState(false);

const [search, setSearch] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

// ✅ debounce (évite 1 requête par frappe)
useEffect(() => {
const t = setTimeout(() => {
setDebouncedSearch(search.trim());
}, 350);
return () => clearTimeout(t);
}, [search]);

// ✅ headers stables (JWT only)
const headers = useMemo(
() => ({
Authorization: `Bearer ${token}`,
}),
[token]
);

// -----------------------------
// CHARGER PRODUITS
// -----------------------------
const loadProducts = useCallback(
async (opts?: { silent?: boolean }) => {
try {
if (!token) return;

if (!opts?.silent) setLoading(true);

const res = await API.get<ApiResponse>("/products", {
headers,
params: {
search: debouncedSearch || undefined,
},
});

const data = res.data;

let list: Product[] = [];
if (Array.isArray(data)) list = data;
else if (data && Array.isArray((data as any).products)) list = (data as any).products;

setProducts(list);
} catch (e) {
console.log("❌ Load products error:", e);
setProducts([]);
} finally {
if (!opts?.silent) setLoading(false);
}
},
[token, headers, debouncedSearch]
);

// ✅ 1) reload quand recherche (debounced) change
useEffect(() => {
loadProducts();
}, [loadProducts]);

// ✅ 2) reload quand on revient sur l’écran (après création produit)
useFocusEffect(
useCallback(() => {
// silent: true => pas de gros spinner, mais données à jour
loadProducts({ silent: true });
}, [loadProducts])
);

// ✅ Pull to refresh
const onRefresh = useCallback(async () => {
try {
setRefreshing(true);
await loadProducts({ silent: true });
} finally {
setRefreshing(false);
}
}, [loadProducts]);

// -----------------------------
// RENDER ITEM
// -----------------------------
const renderItem = useCallback(
({ item }: { item: Product }) => (
<TouchableOpacity
style={styles.row}
onPress={() =>
navigation.navigate("StockProductDetails", {
product: item,
})
}
>
<View>
<Text style={styles.name}>{item.name}</Text>
<Text style={styles.category}>{item.category || "-"}</Text>
</View>

<Ionicons name="chevron-forward" size={20} color="#777" />
</TouchableOpacity>
),
[navigation]
);

// -----------------------------
// UI
// -----------------------------
return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.title}>Ajouter du stock</Text>
</View>

{/* BARRE DE RECHERCHE */}
<View style={styles.searchBox}>
<Ionicons name="search" size={18} color="#777" />
<TextInput
placeholder="Rechercher un produit..."
placeholderTextColor="#777"
value={search}
style={styles.searchInput}
onChangeText={setSearch}
autoCapitalize="none"
/>
</View>

{/* LOADING */}
{loading && <ActivityIndicator size="large" color="#8A4DFF" />}

{/* SI AUCUN PRODUIT */}
{!loading && products.length === 0 ? (
<View style={styles.emptyWrap}>
<Ionicons name="cube-outline" size={40} color="#666" />
<Text style={styles.emptyText}>Aucun produit trouvé</Text>

      </View>
) : (
<FlatList
data={products}
keyExtractor={(item) => item._id}
renderItem={renderItem}
keyboardShouldPersistTaps="handled"
contentContainerStyle={{ paddingBottom: 120 }}
refreshControl={
<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A4DFF" />
}
/>
)}

    </View>
);
}

// -----------------------------
// STYLES
// -----------------------------
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

emptyWrap: { marginTop: 40, alignItems: "center" },
emptyText: { color: "#aaa", marginTop: 10 },

addNewBtn: {
flexDirection: "row",
alignItems: "center",
marginTop: 15,
paddingVertical: 10,
paddingHorizontal: 16,
backgroundColor: "#8A4DFF",
borderRadius: 10,
},
addNewText: { color: "#fff", marginLeft: 6, fontWeight: "700" },

floatingBtn: {
position: "absolute",
bottom: 30,
right: 25,
backgroundColor: "#8A4DFF",
width: 60,
height: 60,
borderRadius: 30,
alignItems: "center",
justifyContent: "center",
elevation: 6,
},
});
