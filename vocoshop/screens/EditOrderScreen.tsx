import React, { useCallback, useContext, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
Alert,
ActivityIndicator,
ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type OrderItem = {
name: string;
qty: number;
unit?: string; // ex: carton, paquet, unité
};

type Order = {
_id: string;
status: "draft" | "sent" | "received" | "cancelled";
note?: string;
items: OrderItem[];
createdAt?: string;
};

export default function EditOrderScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { orderId } = (route.params || {}) as { orderId?: string };

const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
}),
[token, storeId]
);

const [order, setOrder] = useState<Order | null>(null);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

// Champs UI
const [note, setNote] = useState("");
const [itemName, setItemName] = useState("");
const [itemQty, setItemQty] = useState("");
const [itemUnit, setItemUnit] = useState("");

const canLoad = !!token && !!storeId && !!orderId;

const loadOrder = useCallback(async () => {
if (!canLoad) {
setLoading(false);
return;
}

try {
setLoading(true);
const res = await API.get(`/orders/${orderId}`, { headers });
const data = res.data as Order;

setOrder(data);
setNote(data?.note || "");
} catch (e: any) {
console.log("❌ loadOrder error:", e?.response?.data || e);
Alert.alert("Erreur", "Impossible de charger la commande.");
} finally {
setLoading(false);
}
}, [canLoad, headers, orderId]);

useFocusEffect(
useCallback(() => {
loadOrder();
}, [loadOrder])
);

const saveDraft = async (next?: Partial<Order>) => {
if (!orderId) return;

try {
setSaving(true);

const payload: any = {
note,
...(next || {}),
};

const res = await API.patch(`/orders/${orderId}`, payload, { headers });
setOrder(res.data as Order);

Alert.alert("✅ Sauvegardé", "Brouillon mis à jour.");
} catch (e: any) {
console.log("❌ saveDraft error:", e?.response?.data || e);
Alert.alert(
"Erreur",
e?.response?.data?.error || "Impossible de sauvegarder."
);
} finally {
setSaving(false);
}
};

const addItem = async () => {
const name = itemName.trim();
const qty = Number(itemQty);

if (!name) return Alert.alert("Erreur", "Nom du produit requis.");
if (!itemQty || Number.isNaN(qty) || qty <= 0) {
return Alert.alert("Erreur", "Quantité invalide.");
}

const unit = itemUnit.trim();

const newItems = [...(order?.items || []), { name, qty, unit: unit || undefined }];

// ✅ on sauvegarde direct (version propre avec sauvegarde)
await saveDraft({ items: newItems } as any);

setItemName("");
setItemQty("");
setItemUnit("");
};

const removeItem = async (index: number) => {
const current = order?.items || [];
const newItems = current.filter((_, i) => i !== index);
await saveDraft({ items: newItems } as any);
};

const finalizeSend = async () => {
Alert.alert(
"Envoyer la commande ?",
"Elle ne sera plus modifiable après envoi.",
[
{ text: "Annuler", style: "cancel" },
{
text: "Envoyer",
style: "destructive",
onPress: async () => {
await saveDraft({ status: "sent" } as any);
navigation.goBack();
},
},
]
);
};

if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
);
}

if (!order) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<Text style={{ color: "#fff" }}>Commande introuvable</Text>
</View>
);
}

const isDraft = order.status === "draft";

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Commande</Text>

<TouchableOpacity
onPress={() => saveDraft()}
disabled={saving || !isDraft}
style={{ opacity: saving || !isDraft ? 0.5 : 1 }}
>
<Ionicons name="save-outline" size={22} color="#fff" />
</TouchableOpacity>
</View>

<Text style={styles.subtitle}>
Statut :{" "}
<Text style={{ fontWeight: "900", color: isDraft ? "#A78BFA" : "#9CA3AF" }}>
{order.status}
</Text>
</Text>

    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
{/* NOTE */}
<View style={styles.block}>
<Text style={styles.blockTitle}>📝 Note</Text>
<TextInput
style={styles.input}
placeholder="Ex: livraison demain matin..."
placeholderTextColor="#777"
value={note}
onChangeText={setNote}
editable={isDraft}
multiline
/>

<TouchableOpacity
style={[styles.smallBtn, (!isDraft || saving) && { opacity: 0.5 }]}
onPress={() => saveDraft()}
disabled={!isDraft || saving}
>
{saving ? (
<ActivityIndicator color="#fff" />
) : (
<Text style={styles.smallBtnText}>Sauvegarder</Text>
)}
</TouchableOpacity>
</View>

{/* AJOUT LIGNE */}
{isDraft && (
<View style={styles.block}>
<Text style={styles.blockTitle}>➕ Ajouter un article</Text>

<TextInput
style={styles.input}
placeholder="Nom (ex: Sucre 1kg)"
placeholderTextColor="#777"
value={itemName}
onChangeText={setItemName}
/>

<View style={{ flexDirection: "row", gap: 10 }}>
<TextInput
style={[styles.input, { flex: 1 }]}
placeholder="Qté"
placeholderTextColor="#777"
value={itemQty}
onChangeText={setItemQty}
keyboardType="numeric"
/>
<TextInput
style={[styles.input, { flex: 1 }]}
placeholder="Unité (optionnel)"
placeholderTextColor="#777"
value={itemUnit}
onChangeText={setItemUnit}
/>
</View>

<TouchableOpacity style={styles.bigBtn} onPress={addItem}>
<Ionicons name="add-circle-outline" size={18} color="#fff" />
<Text style={styles.bigBtnText}>Ajouter</Text>
</TouchableOpacity>
</View>
)}

{/* LISTE */}
<View style={styles.block}>
<Text style={styles.blockTitle}>📦 Articles</Text>

{order.items?.length ? (
order.items.map((it, idx) => (
<View key={`${it.name}-${idx}`} style={styles.itemRow}>
<View style={{ flex: 1 }}>
<Text style={styles.itemName}>{it.name}</Text>
<Text style={styles.itemMeta}>
{it.qty} {it.unit || ""}
</Text>
</View>

{isDraft && (
<TouchableOpacity onPress={() => removeItem(idx)}>
<Ionicons name="trash-outline" size={20} color="#FF6B6B" />
</TouchableOpacity>
)}
</View>
))
) : (
<Text style={styles.empty}>Aucun article pour l’instant.</Text>
)}
      </View>

      </ScrollView>

      {/* FIXED FOOTER */}
      {isDraft && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.sendBtn} onPress={finalizeSend}>
            <Ionicons name="paper-plane-outline" size={18} color="#fff" />
            <Text style={styles.sendBtnText}>Envoyer la commande</Text>
          </TouchableOpacity>
        </View>
      )}
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
justifyContent: "space-between",
marginBottom: 6,
},

title: {
color: "#fff",
fontSize: 22,
fontWeight: "900",
},

subtitle: {
color: "#A8A3C2",
marginBottom: 20,
},

block: {
backgroundColor: "#161228",
padding: 18,
borderRadius: 14,
marginBottom: 18,
},

blockTitle: {
color: "#fff",
fontSize: 16,
fontWeight: "800",
marginBottom: 12,
},

input: {
backgroundColor: "#1E1838",
padding: 12,
borderRadius: 10,
color: "#fff",
marginBottom: 12,
},

smallBtn: {
alignSelf: "flex-end",
backgroundColor: "#8A4DFF",
paddingVertical: 10,
paddingHorizontal: 14,
borderRadius: 10,
},
smallBtnText: {
color: "#fff",
fontWeight: "800",
},

bigBtn: {
marginTop: 6,
backgroundColor: "#8A4DFF",
paddingVertical: 14,
borderRadius: 12,
flexDirection: "row",
justifyContent: "center",
alignItems: "center",
gap: 8,
},
bigBtnText: {
color: "#fff",
fontWeight: "800",
},

itemRow: {
flexDirection: "row",
alignItems: "center",
gap: 10,
paddingVertical: 10,
borderBottomWidth: 1,
borderBottomColor: "rgba(255,255,255,0.08)",
},

itemName: { color: "#fff", fontWeight: "900" },
itemMeta: { color: "#A8A3C2", marginTop: 2 },

empty: { color: "#A8A3C2" },

  sendBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  sendBtnText: { color: "#fff", fontWeight: "900" },
  footer: {
    paddingBottom: 30,
    paddingTop: 14,
    backgroundColor: "rgba(10,6,23,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
});
