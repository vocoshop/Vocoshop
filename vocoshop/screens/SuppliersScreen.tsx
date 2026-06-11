// screens/SuppliersScreen.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
FlatList,
ActivityIndicator,
Modal,
Alert,
RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

interface Supplier {
_id: string;
name: string;
phone?: string;
phone2?: string;
whatsapp?: string;
note?: string;
}

export default function SuppliersScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId;

const [q, setQ] = useState("");
const [debouncedQ, setDebouncedQ] = useState("");
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [items, setItems] = useState<Supplier[]>([]);

// add modal
const [showAdd, setShowAdd] = useState(false);
const [name, setName] = useState("");
const [phone, setPhone] = useState("");
const [whatsapp, setWhatsapp] = useState("");
const [note, setNote] = useState("");
const [saving, setSaving] = useState(false);

// Debounce search
useEffect(() => {
const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
return () => clearTimeout(t);
}, [q]);

const load = useCallback(
async (query?: string) => {
if (!canLoad) {
setItems([]);
setLoading(false);
return;
}

try {
setLoading(true);
const res = await API.get("/suppliers", {
headers,
params: { q: (query ?? debouncedQ).trim() },
});
setItems(Array.isArray(res.data) ? res.data : []);
} catch (e) {
console.log("❌ SuppliersScreen load error:", e);
setItems([]);
} finally {
setLoading(false);
}
},
[canLoad, headers, debouncedQ]
);

// Auto load on focus
useFocusEffect(
useCallback(() => {
load();
}, [load])
);

// Reload when debounced search changes (while screen is open)
useEffect(() => {
// si l’écran est déjà affiché et qu’on tape => reload doux
// (ça évite d’attendre Enter)
load(debouncedQ);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [debouncedQ]);

const onRefresh = useCallback(async () => {
setRefreshing(true);
try {
await load();
} finally {
setRefreshing(false);
}
}, [load]);

const resetForm = useCallback(() => {
setName("");
setPhone("");
setWhatsapp("");
setNote("");
}, []);

const openAddModal = useCallback(() => {
resetForm();
setShowAdd(true);
}, [resetForm]);

const closeAddModal = useCallback(() => {
setShowAdd(false);
}, []);

const saveSupplier = useCallback(async () => {
const n = name.trim();
if (!n) return Alert.alert("Erreur", "Nom du fournisseur requis");
if (!canLoad) return Alert.alert("Erreur", "Session invalide. Reconnecte-toi.");

try {
setSaving(true);

await API.post(
"/suppliers",
{
name: n,
phone: phone.trim() || undefined,
whatsapp: whatsapp.trim() || undefined,
note: note.trim() || undefined,
},
{ headers }
);

closeAddModal();
resetForm();

// reload list (en gardant la recherche actuelle)
await load();
} catch (e: any) {
console.log("❌ create supplier error:", e?.response?.data || e);
Alert.alert("Erreur", e?.response?.data?.error || "Impossible d'ajouter le fournisseur.");
} finally {
setSaving(false);
}
}, [name, phone, whatsapp, note, canLoad, headers, closeAddModal, resetForm, load]);

const openSupplier = (s: Supplier) => {
navigation.navigate("SupplierDetail", { supplierId: s._id });
};

const clearSearch = useCallback(() => {
setQ("");
// load sans filtre
load("");
}, [load]);

const renderItem = ({ item }: { item: Supplier }) => (
<TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openSupplier(item)}>
<View style={{ flex: 1 }}>
<Text style={styles.titleName} numberOfLines={1}>
{item.name}
</Text>
{!!item.phone && <Text style={styles.small}>📞 {item.phone}</Text>}
{!!item.whatsapp && <Text style={styles.small}>🟢 WhatsApp: {item.whatsapp}</Text>}
</View>
<Ionicons name="chevron-forward" size={20} color="#6B7280" />
</TouchableOpacity>
);

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Fournisseurs</Text>

<TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
<Ionicons name="add" size={22} color="#fff" />
</TouchableOpacity>
</View>

{/* SEARCH */}
<View style={styles.searchWrap}>
<TextInput
placeholder="Rechercher un fournisseur..."
placeholderTextColor="#6B7280"
value={q}
onChangeText={setQ}
onSubmitEditing={() => load(q)}
style={styles.search}
returnKeyType="search"
/>
{!!q && (
<TouchableOpacity onPress={clearSearch} style={styles.clearBtn} activeOpacity={0.8}>
<Ionicons name="close" size={18} color="#EDE9FE" />
</TouchableOpacity>
)}
</View>

{loading ? (
<ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 20 }} />
) : items.length === 0 ? (
<View style={{ marginTop: 30, alignItems: "center" }}>
<Ionicons name="people-outline" size={34} color="#A8A3C2" />
<Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>Aucun fournisseur</Text>
<Text style={{ color: "#A8A3C2", marginTop: 6, textAlign: "center" }}>
Ajoute ton premier fournisseur avec le bouton +
</Text>
</View>
) : (
<FlatList
data={items}
keyExtractor={(i) => i._id}
renderItem={renderItem}
contentContainerStyle={{ paddingBottom: 40 }}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
/>
)}

{/* ADD MODAL */}
<Modal visible={showAdd} transparent animationType="fade" onRequestClose={closeAddModal}>
<View style={styles.modalOverlay}>
<View style={styles.modal}>
<Text style={styles.modalTitle}>Nouveau fournisseur</Text>

<TextInput
placeholder="Nom"
placeholderTextColor="#777"
style={styles.input}
value={name}
onChangeText={setName}
/>
<TextInput
placeholder="Téléphone"
placeholderTextColor="#777"
style={styles.input}
value={phone}
onChangeText={setPhone}
keyboardType="phone-pad"
/>
<TextInput
placeholder="WhatsApp (optionnel)"
placeholderTextColor="#777"
style={styles.input}
value={whatsapp}
onChangeText={setWhatsapp}
keyboardType="phone-pad"
/>
<TextInput
placeholder="Note (optionnel)"
placeholderTextColor="#777"
style={[styles.input, { height: 90, textAlignVertical: "top" }]}
multiline
value={note}
onChangeText={setNote}
/>

<TouchableOpacity
style={[styles.bigBtn, { opacity: saving ? 0.7 : 1 }]}
onPress={saveSupplier}
activeOpacity={0.9}
disabled={saving}
>
<Text style={styles.bigBtnText}>{saving ? "Enregistrement..." : "Enregistrer"}</Text>
</TouchableOpacity>

<TouchableOpacity style={{ marginTop: 10 }} onPress={closeAddModal}>
<Text style={styles.cancel}>Annuler</Text>
</TouchableOpacity>
</View>
</View>
</Modal>
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 60, paddingHorizontal: 20 },

headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900", flex: 1, textAlign: "center" },

addBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
},

searchWrap: { position: "relative", marginTop: 14, marginBottom: 14 },
search: {
backgroundColor: "#18122B",
borderRadius: 14,
paddingHorizontal: 14,
paddingVertical: 10,
paddingRight: 44,
color: "#fff",
},
clearBtn: {
position: "absolute",
right: 10,
top: 8,
width: 30,
height: 30,
borderRadius: 15,
alignItems: "center",
justifyContent: "center",
backgroundColor: "rgba(124,58,237,0.25)",
borderWidth: 1,
borderColor: "rgba(167,139,250,0.35)",
},

card: {
backgroundColor: "#18122B",
borderRadius: 14,
padding: 16,
marginBottom: 10,
flexDirection: "row",
alignItems: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
gap: 10,
},
titleName: { color: "#fff", fontWeight: "900", fontSize: 15 },
small: { color: "#A8A3C2", fontSize: 12, marginTop: 4 },

modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 20 },
modal: { backgroundColor: "#18122B", borderRadius: 16, padding: 20 },
modalTitle: { color: "#fff", fontWeight: "900", fontSize: 18, marginBottom: 10 },

input: { backgroundColor: "#1E1838", borderRadius: 10, padding: 12, marginBottom: 10, color: "#fff" },
bigBtn: { backgroundColor: "#7C3AED", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
bigBtnText: { color: "#fff", fontWeight: "900" },
cancel: { color: "#9CA3AF", textAlign: "center" },
});
