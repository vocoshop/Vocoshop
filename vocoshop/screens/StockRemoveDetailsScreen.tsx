// screens/StockRemoveDetailsScreen.tsx
import React, { useState, useContext } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

// ✅ OFFLINE
import { runOrQueue } from "../src/api/offline/queue";
import { isOffline } from "../src/api/utils/network";

export default function StockRemoveDetailsScreen({ route, navigation }: any) {
const { product } = route.params;
const { token, storeId } = useContext(AuthContext);

const [quantity, setQuantity] = useState("");
const [loading, setLoading] = useState(false);

const headers = {
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
};

// ================================
// Retirer du stock (ONLINE / OFFLINE)
// ================================
const submitRemoveStock = async () => {
const q = Number(quantity);

if (!quantity || isNaN(q) || q <= 0) {
return Alert.alert("Erreur", "Veuillez entrer une quantité valide.");
}

setLoading(true);

try {
const payload = {
productId: product._id,
quantity: q,
};

// ✅ ONLINE → API directe
// ✅ OFFLINE → queue automatique
await runOrQueue({
title: `Retrait stock ${product.name}`,
method: "POST",
url: "/stocks/remove",
body: payload,
headers,
});

// ✅ OPTIMISTIC UI (OFFLINE)
if (isOffline()) {
product.quantity = Math.max(
0,
Number(product.quantity || 0) - q
);

Alert.alert(
"Mode hors ligne",
"Retrait enregistré. Il sera synchronisé automatiquement dès le retour d'internet."
);
} else {
Alert.alert("Succès", "Stock retiré avec succès !");
}

navigation.goBack();
} catch (e: any) {
console.log("❌ Erreur retrait stock :", e?.response?.data || e);

Alert.alert(
"Erreur",
e?.response?.data?.error ||
e?.response?.data?.message ||
"Impossible de retirer le stock."
);
} finally {
setLoading(false);
}
};

const offlineNow = isOffline();

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity
onPress={() => navigation.goBack()}
style={styles.backBtn}
>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Retirer du stock</Text>
</View>

{/* OFFLINE BANNER */}
{offlineNow && (
<View style={styles.offlineBanner}>
<Ionicons
name="cloud-offline-outline"
size={18}
color="#FACC15"
/>
<Text style={styles.offlineText}>
Mode hors-ligne : synchronisation automatique
</Text>
</View>
)}

{/* Infos produit */}
<Text style={styles.label}>Produit</Text>
<Text style={styles.value}>{product.name}</Text>

<Text style={styles.label}>Catégorie</Text>
<Text style={styles.value}>
{product.category || "Non définie"}
</Text>

<Text style={styles.label}>Stock actuel</Text>
<Text style={styles.value}>{product.quantity ?? 0}</Text>

{/* Quantité */}
<Text style={styles.label}>Quantité à retirer</Text>
<TextInput
style={styles.input}
keyboardType="numeric"
value={quantity}
onChangeText={setQuantity}
placeholder="Ex: 5"
placeholderTextColor="#999"
/>

<TouchableOpacity
style={[styles.button, loading && { opacity: 0.7 }]}
onPress={submitRemoveStock}
disabled={loading}
>
<Text style={styles.buttonText}>
{loading ? "Envoi..." : "Confirmer"}
</Text>
</TouchableOpacity>
</View>
);
}

// ================================
// STYLES
// ================================
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0c0f14",
padding: 20,
},
headerRow: {
flexDirection: "row",
alignItems: "center",
marginBottom: 25,
},
backBtn: {
marginRight: 10,
},
title: {
color: "#fff",
fontSize: 20,
fontWeight: "bold",
},

offlineBanner: {
flexDirection: "row",
alignItems: "center",
gap: 8,
backgroundColor: "rgba(250, 204, 21, 0.12)",
borderWidth: 1,
borderColor: "rgba(250, 204, 21, 0.25)",
paddingVertical: 10,
paddingHorizontal: 12,
borderRadius: 12,
marginBottom: 14,
},
offlineText: {
color: "#E5E7EB",
fontWeight: "800",
fontSize: 12,
flex: 1,
},

label: {
color: "#aaa",
marginTop: 15,
marginBottom: 4,
},
value: {
color: "#fff",
fontSize: 16,
},
input: {
backgroundColor: "#1a1f29",
color: "#fff",
padding: 12,
borderRadius: 8,
marginTop: 5,
},
button: {
backgroundColor: "#FF6B6B",
marginTop: 30,
padding: 15,
borderRadius: 10,
alignItems: "center",
},
buttonText: {
color: "#fff",
fontWeight: "bold",
fontSize: 16,
},
});
