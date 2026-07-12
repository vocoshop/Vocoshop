// screens/EditSupplierScreen.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
ActivityIndicator,
Alert,
ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

interface Supplier {
_id: string;
name: string;
phone?: string;
phone2?: string;
whatsapp?: string;
email?: string;
address?: string;
note?: string;
}

export default function EditSupplierScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const supplierId: string | undefined = route.params?.supplierId;

const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId && !!supplierId;

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);

const [name, setName] = useState("");
const [phone, setPhone] = useState("");
const [phone2, setPhone2] = useState("");
const [whatsapp, setWhatsapp] = useState("");
const [email, setEmail] = useState("");
const [address, setAddress] = useState("");
const [note, setNote] = useState("");

const load = useCallback(async () => {
if (!canLoad) {
setLoading(false);
return;
}

try {
setLoading(true);
const res = await API.get(`/suppliers/${supplierId}`, { headers });
const s = res.data as Supplier;

setName(s?.name || "");
setPhone(s?.phone || "");
setPhone2(s?.phone2 || "");
setWhatsapp(s?.whatsapp || "");
setEmail(s?.email || "");
setAddress(s?.address || "");
setNote(s?.note || "");
} catch (e: any) {
console.log("❌ EditSupplier load error:", e?.response?.data || e);
Alert.alert("Erreur", "Impossible de charger le fournisseur.");
navigation.goBack();
} finally {
setLoading(false);
}
}, [canLoad, headers, navigation, supplierId]);

useFocusEffect(
useCallback(() => {
load();
}, [load])
);

const clean = (v: string) => {
const s = String(v || "").trim();
return s.length ? s : undefined;
};

const onSave = async () => {
const n = name.trim();
if (!n) return Alert.alert("Erreur", "Nom du fournisseur requis.");

if (!supplierId) return;

try {
setSaving(true);

await API.patch(
`/suppliers/${supplierId}`,
{
name: n,
phone: clean(phone),
phone2: clean(phone2),
whatsapp: clean(whatsapp),
email: clean(email),
address: clean(address),
note: clean(note),
},
{ headers }
);

Alert.alert("OK", "Fournisseur mis à jour.");
navigation.goBack(); // SupplierDetail se rechargera au focus
} catch (e: any) {
console.log("❌ EditSupplier save error:", e?.response?.data || e);
Alert.alert("Erreur", e?.response?.data?.error || "Impossible d’enregistrer.");
} finally {
setSaving(false);
}
};

if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
);
}

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Modifier fournisseur</Text>
<View style={{ width: 26 }} />
</View>

    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
<View style={styles.block}>
<Text style={styles.label}>Nom *</Text>
<TextInput
value={name}
onChangeText={setName}
placeholder="Nom du fournisseur"
placeholderTextColor="#777"
style={styles.input}
/>

<Text style={styles.label}>Téléphone</Text>
<TextInput
value={phone}
onChangeText={setPhone}
placeholder="Ex: +242 06..."
placeholderTextColor="#777"
keyboardType="phone-pad"
style={styles.input}
/>

<Text style={styles.label}>Téléphone 2</Text>
<TextInput
value={phone2}
onChangeText={setPhone2}
placeholder="Optionnel"
placeholderTextColor="#777"
keyboardType="phone-pad"
style={styles.input}
/>

<Text style={styles.label}>WhatsApp</Text>
<TextInput
value={whatsapp}
onChangeText={setWhatsapp}
placeholder="Optionnel"
placeholderTextColor="#777"
keyboardType="phone-pad"
style={styles.input}
/>

<Text style={styles.label}>Email</Text>
<TextInput
value={email}
onChangeText={setEmail}
placeholder="Optionnel"
placeholderTextColor="#777"
keyboardType="email-address"
autoCapitalize="none"
style={styles.input}
/>

<Text style={styles.label}>Adresse</Text>
<TextInput
value={address}
onChangeText={setAddress}
placeholder="Optionnel"
placeholderTextColor="#777"
style={styles.input}
/>

<Text style={styles.label}>Note</Text>
<TextInput
value={note}
onChangeText={setNote}
placeholder="Mémo (optionnel)"
placeholderTextColor="#777"
style={[styles.input, { height: 100, textAlignVertical: "top" }]}
multiline
/>

          <TouchableOpacity
            style={styles.productsBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("SupplierProducts", { supplierId, supplierName: name })}
          >
            <Ionicons name="cube-outline" size={18} color="#A78BFA" />
            <Text style={styles.productsBtnText}>Produits fournis</Text>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FIXED FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}
          onPress={onSave}
          disabled={saving}
          activeOpacity={0.9}
        >
          <Text style={styles.saveText}>{saving ? "Enregistrement..." : "Enregistrer"}</Text>
        </TouchableOpacity>
      </View>
    </View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 60, paddingHorizontal: 20 },

headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
title: { color: "#fff", fontSize: 20, fontWeight: "900", flex: 1 },

block: {
backgroundColor: "#18122B",
borderRadius: 14,
padding: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},

label: { color: "#A8A3C2", fontWeight: "900", marginBottom: 6, marginTop: 10 },
input: {
backgroundColor: "#1E1838",
borderRadius: 10,
padding: 12,
color: "#fff",
},

productsBtn: {
flexDirection: "row",
alignItems: "center",
gap: 8,
marginTop: 16,
backgroundColor: "#1E1838",
borderRadius: 10,
padding: 12,
},
productsBtnText: { color: "#A78BFA", fontWeight: "700", fontSize: 13, flex: 1 },

  saveBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "900" },
  footer: {
    paddingBottom: 30,
    paddingTop: 14,
    backgroundColor: "rgba(10,6,23,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
});
