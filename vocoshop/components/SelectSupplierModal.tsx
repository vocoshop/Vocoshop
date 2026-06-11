// components/SelectSupplierModal.tsx
import React, { useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
Modal,
TouchableOpacity,
TextInput,
FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type SupplierLite = {
_id: string;
name: string;
phone?: string;
whatsapp?: string;
};

type Props = {
visible: boolean;
onClose: () => void;

suppliers: SupplierLite[];
loading?: boolean;

selectedSupplierId?: string; // "" or undefined = Aucun
onSelect: (supplier: SupplierLite | null) => void; // null => Aucun
};

export default function SelectSupplierModal({
visible,
onClose,
suppliers,
loading,
selectedSupplierId,
onSelect,
}: Props) {
const [q, setQ] = useState("");

const filtered = useMemo(() => {
const query = q.trim().toLowerCase();
if (!query) return suppliers;

return suppliers.filter((s) => {
const name = (s.name || "").toLowerCase();
const phone = (s.phone || "").toLowerCase();
const wa = (s.whatsapp || "").toLowerCase();
return (
name.includes(query) ||
phone.includes(query) ||
wa.includes(query)
);
});
}, [q, suppliers]);

const renderItem = ({ item }: { item: SupplierLite }) => {
const active = item._id === selectedSupplierId;

return (
<TouchableOpacity
activeOpacity={0.9}
style={[styles.row, active && styles.rowActive]}
onPress={() => {
onSelect(item);
onClose();
}}
>
<View style={{ flex: 1 }}>
<Text style={styles.name} numberOfLines={1}>
{item.name}
</Text>

{(item.phone || item.whatsapp) ? (
<Text style={styles.sub} numberOfLines={1}>
{item.phone ? `📞 ${item.phone}` : ""}{item.phone && item.whatsapp ? " • " : ""}
{item.whatsapp ? `🟢 ${item.whatsapp}` : ""}
</Text>
) : null}
</View>

{active ? (
<Ionicons name="checkmark-circle" size={22} color="#A78BFA" />
) : (
<Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
)}
</TouchableOpacity>
);
};

return (
<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
<View style={styles.overlay}>
<View style={styles.sheet}>
{/* Header */}
<View style={styles.header}>
<Text style={styles.title}>Choisir un fournisseur</Text>
<TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.85}>
<Ionicons name="close" size={20} color="#fff" />
</TouchableOpacity>
</View>

{/* Search */}
<TextInput
placeholder="Rechercher (nom, téléphone, WhatsApp)..."
placeholderTextColor="#6B7280"
value={q}
onChangeText={setQ}
style={styles.search}
/>

{/* Aucun */}
<TouchableOpacity
activeOpacity={0.9}
style={[
styles.row,
(!selectedSupplierId || selectedSupplierId === "") && styles.rowActive,
]}
onPress={() => {
onSelect(null);
onClose();
}}
>
<View style={{ flex: 1 }}>
<Text style={styles.name}>Aucun</Text>
<Text style={styles.sub}>Ne pas lier de fournisseur à cette commande</Text>
</View>

{(!selectedSupplierId || selectedSupplierId === "") ? (
<Ionicons name="checkmark-circle" size={22} color="#A78BFA" />
) : (
<Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
)}
</TouchableOpacity>

{/* List */}
{loading ? (
<View style={{ paddingVertical: 18 }}>
<Text style={{ color: "#A8A3C2", textAlign: "center" }}>Chargement...</Text>
</View>
) : (
<FlatList
data={filtered}
keyExtractor={(i) => i._id}
renderItem={renderItem}
showsVerticalScrollIndicator={false}
contentContainerStyle={{ paddingBottom: 16 }}
ListEmptyComponent={
<View style={{ paddingVertical: 18 }}>
<Text style={{ color: "#A8A3C2", textAlign: "center" }}>
Aucun résultat
</Text>
</View>
}
/>
)}
</View>
</View>
</Modal>
);
}

const styles = StyleSheet.create({
overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
sheet: {
backgroundColor: "#18122B",
borderTopLeftRadius: 18,
borderTopRightRadius: 18,
padding: 16,
maxHeight: "85%",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
title: { color: "#fff", fontWeight: "900", fontSize: 16 },
iconBtn: {
width: 38,
height: 38,
borderRadius: 12,
alignItems: "center",
justifyContent: "center",
backgroundColor: "rgba(255,255,255,0.06)",
},
search: {
backgroundColor: "#0A0617",
borderRadius: 12,
paddingHorizontal: 12,
paddingVertical: 10,
color: "#fff",
marginBottom: 10,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
row: {
flexDirection: "row",
alignItems: "center",
gap: 10,
padding: 12,
borderRadius: 14,
backgroundColor: "rgba(255,255,255,0.04)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
marginBottom: 10,
},
rowActive: {
borderColor: "rgba(167,139,250,0.75)",
backgroundColor: "rgba(124,58,237,0.18)",
},
name: { color: "#fff", fontWeight: "900" },
sub: { color: "#A8A3C2", marginTop: 4, fontSize: 12 },
});
