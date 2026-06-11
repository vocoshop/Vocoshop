// screens/SupplierDetailScreen.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ActivityIndicator,
Linking,
Alert,
ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

/* ------------------------------------------
TYPES
--------------------------------------------*/
type Supplier = {
_id: string;
storeId: string;
name: string;
phone?: string;
phone2?: string;
whatsapp?: string;
email?: string;
address?: string;
city?: string;
category?: string;
note?: string;
createdAt?: string;
updatedAt?: string;
};

type Product = {
_id: string;
name: string;
category?: string;
sellPrice: number;
};

type RouteParams = {
supplierId: string;
};

export default function SupplierDetailScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { supplierId } = (route.params || {}) as RouteParams;

const { token, storeId } = useContext(AuthContext);

const [supplier, setSupplier] = useState<Supplier | null>(null);
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(true);
const [deleting, setDeleting] = useState(false);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId && !!supplierId;

const load = useCallback(async () => {
if (!canLoad) {
setSupplier(null);
setLoading(false);
return;
}

try {
setLoading(true);
const [supRes, prodRes] = await Promise.all([
API.get<Supplier>(`/suppliers/${supplierId}`, { headers }),
API.get(`/products/by-supplier/${supplierId}`, { headers }),
]);
setSupplier(supRes.data ?? null);
setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
} catch (e: any) {
console.log("❌ SupplierDetail load error:", e?.response?.data || e);
setSupplier(null);
} finally {
setLoading(false);
}
}, [canLoad, headers, supplierId]);

useFocusEffect(
useCallback(() => {
load();
}, [load])
);

/* ------------------------------------------
ACTIONS EXTERNES (téléphone/SMS/WhatsApp)
--------------------------------------------*/
const cleanPhone = (v?: string) => (v || "").replace(/\s+/g, "");

const mainPhone =
cleanPhone(supplier?.phone) ||
cleanPhone(supplier?.whatsapp) ||
cleanPhone(supplier?.phone2);

const openCall = async () => {
if (!mainPhone) return Alert.alert("Info", "Aucun numéro disponible.");
const url = `tel:${mainPhone}`;
const ok = await Linking.canOpenURL(url);
if (!ok) return Alert.alert("Erreur", "Impossible de lancer l'appel sur cet appareil.");
Linking.openURL(url);
};

const openSMS = async () => {
if (!mainPhone) return Alert.alert("Info", "Aucun numéro disponible.");
const url = `sms:${mainPhone}`;
const ok = await Linking.canOpenURL(url);
if (!ok) return Alert.alert("Erreur", "Impossible d'ouvrir les SMS sur cet appareil.");
Linking.openURL(url);
};

const openWhatsApp = async () => {
const wa = cleanPhone(supplier?.whatsapp) || cleanPhone(supplier?.phone);
if (!wa) return Alert.alert("Info", "Aucun WhatsApp disponible.");
const url = `https://wa.me/${wa}`;
const ok = await Linking.canOpenURL(url);
if (!ok) return Alert.alert("Erreur", "WhatsApp n'est pas disponible.");
Linking.openURL(url);
};

const deleteSupplier = () => {
if (!supplierId) {
return Alert.alert("Erreur", "ID fournisseur manquant.");
}

Alert.alert(
"Supprimer le fournisseur",
"Tu es sûr ? Cette action est irréversible.",
[
{
text: "Annuler",
style: "cancel",
},
{
text: "Supprimer",
style: "destructive",
onPress: async () => {
try {
setDeleting(true);

await API.delete(`/suppliers/${supplierId}`, { headers });

navigation.goBack();
} catch (e) {
Alert.alert("Erreur", "Impossible de supprimer le fournisseur.");
} finally {
setDeleting(false);
}
},
},
]
);
};

/* ------------------------------------------
UI
--------------------------------------------*/
if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
);
}

if (!supplier) {
return (
<View style={styles.container}>
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.title}>Fournisseur</Text>
<View style={{ width: 26 }} />
</View>

<View style={styles.emptyWrap}>
<Ionicons name="alert-circle-outline" size={34} color="#A8A3C2" />
<Text style={styles.emptyTitle}>Fournisseur introuvable</Text>
<Text style={styles.emptyDesc}>Vérifie l’ID ou recharge l’écran.</Text>

<TouchableOpacity style={styles.bigBtn} onPress={load} activeOpacity={0.9}>
<Ionicons name="refresh" size={18} color="#fff" />
<Text style={styles.bigBtnText}>Recharger</Text>
</TouchableOpacity>
</View>
</View>
);
}

return (
<View style={styles.container}>
<ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title} numberOfLines={1}>
{supplier.name}
</Text>

<TouchableOpacity
onPress={() => navigation.navigate("EditSupplier", { supplierId: supplier._id })}
style={styles.iconBtn}
activeOpacity={0.85}
>
<Ionicons name="create-outline" size={20} color="#fff" />
</TouchableOpacity>
</View>

{/* CARD INFO */}
<View style={styles.card}>
<Text style={styles.bigName}>{supplier.name}</Text>

{/* {!!supplier.city && <Text style={styles.line}>Ville: {supplier.city}</Text>} */}
{!!supplier.address && <Text style={styles.line}>Adresse: {supplier.address}</Text>}
{!!supplier.email && <Text style={styles.line}>Email: {supplier.email}</Text>}

{!!supplier.phone && <Text style={styles.line}>Téléphone: {supplier.phone}</Text>}
{!!supplier.phone2 && <Text style={styles.line}>Téléphone 2: {supplier.phone2}</Text>}
{!!supplier.whatsapp && <Text style={styles.line}>WhatsApp: {supplier.whatsapp}</Text>}

{!!supplier.note && (
<>
<Text style={styles.section}>Note</Text>
<Text style={styles.notes}>{supplier.note}</Text>
</>
)}
</View>

{/* PRODUITS FOURNIS */}
<View style={styles.productsSection}>
<View style={styles.productsHeader}>
<Text style={styles.productsTitle}>
Produits fournis ({products.length})
</Text>
<TouchableOpacity
onPress={() =>
navigation.navigate("SupplierProducts", {
supplierId: supplier._id,
supplierName: supplier.name,
})
}
>
<Text style={styles.productsEditLink}>Modifier</Text>
</TouchableOpacity>
</View>
{products.length === 0 ? (
<Text style={styles.productsEmpty}>Aucun produit associé à ce fournisseur</Text>
) : (
products.slice(0, 5).map((p) => (
<View key={p._id} style={styles.productRow}>
<Text style={styles.productName}>{p.name}</Text>
<Text style={styles.productPrice}>
{p.sellPrice?.toLocaleString()} FCFA
</Text>
</View>
))
)}
{products.length > 5 && (
<Text style={styles.productsMore}>
+{products.length - 5} autre{products.length - 5 > 1 ? "s" : ""}
</Text>
)}
</View>

{/* COMMANDER */}
<TouchableOpacity
style={styles.commanderBtn}
activeOpacity={0.9}
onPress={() =>
navigation.navigate("Commander", {
supplierId: supplier._id,
supplierName: supplier.name,
})
}
>
<Ionicons name="cart-outline" size={22} color="#fff" />
<Text style={styles.commanderBtnText}>Commander chez {supplier.name}</Text>
</TouchableOpacity>

{/* ACTIONS */}
<Text style={styles.sectionTitle}>Actions</Text>

<TouchableOpacity style={styles.actionBtn} onPress={openCall} activeOpacity={0.9}>
<Ionicons name="call-outline" size={20} color="#fff" />
<Text style={styles.actionText}>Appeler</Text>
</TouchableOpacity>

<TouchableOpacity style={styles.actionBtn} onPress={openSMS} activeOpacity={0.9}>
<Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
<Text style={styles.actionText}>Envoyer un SMS</Text>
</TouchableOpacity>

<TouchableOpacity style={styles.actionBtn} onPress={openWhatsApp} activeOpacity={0.9}>
<Ionicons name="logo-whatsapp" size={20} color="#fff" />
<Text style={styles.actionText}>WhatsApp</Text>
</TouchableOpacity>

<TouchableOpacity
onPress={deleteSupplier}
activeOpacity={0.7}
style={styles.deleteTextWrap}
disabled={deleting}
>
<Text style={[styles.deleteText, deleting && { opacity: 0.6 }]}>
{deleting ? "Suppression..." : "Supprimer le fournisseur"}
</Text>
</TouchableOpacity>


</ScrollView>
</View>
);
}

/* ------------------------------------------
STYLES
--------------------------------------------*/
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
paddingTop: 60,
paddingHorizontal: 20,
},

deleteTextWrap: {
marginTop: 22,
alignItems: "center",
},

deleteText: {
color: "#F87171", // rouge discret
fontWeight: "800",
fontSize: 13,
},

headerRow: {
flexDirection: "row",
alignItems: "center",
marginBottom: 14,
gap: 10,
},

title: {
color: "#fff",
fontSize: 20,
fontWeight: "900",
flex: 1,
},

iconBtn: {
width: 40,
height: 40,
borderRadius: 12,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},

card: {
backgroundColor: "#18122B",
borderRadius: 16,
padding: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},

bigName: {
color: "#fff",
fontWeight: "900",
fontSize: 18,
marginBottom: 10,
},

line: {
color: "#A8A3C2",
fontSize: 13,
marginBottom: 6,
},

sectionTitle: {
marginTop: 16,
color: "#C6C0DD",
fontWeight: "900",
fontSize: 14,
marginBottom: 10,
},

section: {
marginTop: 10,
color: "#EDE9FE",
fontWeight: "900",
marginBottom: 6,
},

notes: {
color: "#A8A3C2",
lineHeight: 18,
},

actionBtn: {
flexDirection: "row",
alignItems: "center",
gap: 10,
backgroundColor: "#7C3AED",
paddingVertical: 14,
paddingHorizontal: 14,
borderRadius: 14,
marginBottom: 10,
},

actionText: {
color: "#fff",
fontWeight: "900",
fontSize: 14,
},

emptyWrap: {
flex: 1,
alignItems: "center",
justifyContent: "center",
paddingBottom: 40,
gap: 8,
},
emptyTitle: {
color: "#fff",
fontWeight: "900",
fontSize: 18,
marginTop: 8,
},
emptyDesc: {
color: "#A8A3C2",
textAlign: "center",
marginBottom: 16,
},
bigBtn: {
flexDirection: "row",
alignItems: "center",
gap: 8,
backgroundColor: "#7C3AED",
paddingVertical: 12,
paddingHorizontal: 16,
borderRadius: 12,
},
bigBtnText: {
color: "#fff",
fontWeight: "900",
},
commanderBtn: {
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 10,
backgroundColor: "#059669",
paddingVertical: 16,
paddingHorizontal: 14,
borderRadius: 14,
marginTop: 16,
},
commanderBtnText: {
color: "#fff",
fontWeight: "900",
fontSize: 15,
},

productsSection: {
marginTop: 16,
backgroundColor: "#18122B",
borderRadius: 14,
padding: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
productsHeader: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 10,
},
productsTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
productsEditLink: { color: "#A78BFA", fontWeight: "700", fontSize: 12 },
productsEmpty: { color: "#6B7280", fontSize: 12, fontStyle: "italic" },
productRow: {
flexDirection: "row",
justifyContent: "space-between",
paddingVertical: 8,
borderBottomWidth: 1,
borderBottomColor: "rgba(255,255,255,0.04)",
},
productName: { color: "#E5E7EB", fontSize: 13, fontWeight: "600" },
productPrice: { color: "#9CA3AF", fontSize: 12 },
productsMore: { color: "#6B7280", fontSize: 11, marginTop: 6 },
});
