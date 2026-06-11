import React, { useContext, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
Alert,
ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type OrderResponse = {
_id?: string;
id?: string;
};

export default function CreateOrderScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [loading, setLoading] = useState(false);

const createOrder = async () => {
if (!token || !storeId) {
return Alert.alert("Erreur", "Boutique non identifiée");
}

try {
setLoading(true);

const res = await API.post<OrderResponse>(
"/orders",
{ items: [] },
{
headers: {
Authorization: `Bearer ${token}`,
"x-store-id": storeId,
},
}
);

// ✅ On récupère l'id sans provoquer d'erreur TS
const orderId = res?.data?._id || res?.data?.id;

if (!orderId) {
throw new Error("ID de commande manquant");
}

// ✅ Redirection directe vers l’édition
navigation.replace("EditOrder", { orderId });
} catch (err) {
console.log("❌ createOrder error:", err);
Alert.alert("Erreur", "Impossible de créer la commande");
} finally {
setLoading(false);
}
};

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Nouvelle commande</Text>
<View style={{ width: 26 }} />
</View>

{/* CONTENU */}
<View style={styles.content}>
<Ionicons name="cube-outline" size={64} color="#8A4DFF" />

<Text style={styles.mainText}>Créer une commande fournisseur</Text>
<Text style={styles.subText}>
La commande sera enregistrée comme brouillon.
Vous pourrez ajouter les produits ensuite.
</Text>

<TouchableOpacity
style={[styles.createBtn, loading && { opacity: 0.7 }]}
onPress={createOrder}
disabled={loading}
>
{loading ? (
<ActivityIndicator color="#fff" />
) : (
<>
<Ionicons name="add-circle-outline" size={22} color="#fff" />
<Text style={styles.createText}>Créer la commande</Text>
</>
)}
</TouchableOpacity>
</View>
</View>
);
}

/* ================= STYLES ================= */

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
marginBottom: 40,
gap: 10,
},

title: {
flex: 1,
color: "#fff",
fontSize: 24,
fontWeight: "900",
textAlign: "center",
},

content: {
flex: 1,
alignItems: "center",
justifyContent: "center",
gap: 20,
},

mainText: {
color: "#fff",
fontSize: 20,
fontWeight: "800",
textAlign: "center",
},

subText: {
color: "#A8A3C2",
fontSize: 14,
textAlign: "center",
paddingHorizontal: 20,
},

createBtn: {
marginTop: 30,
backgroundColor: "#8A4DFF",
paddingVertical: 14,
paddingHorizontal: 26,
borderRadius: 14,
flexDirection: "row",
alignItems: "center",
gap: 10,
},

createText: {
color: "#fff",
fontSize: 16,
fontWeight: "700",
},
});
