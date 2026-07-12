// screens/CreateEmployeeScreen.tsx
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
Switch,
Linking,
Platform,
Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as LinkingExpo from "expo-linking";

import { AuthContext } from "../src/api/context/AuthContext";
import { createEmployee, EmployeePermissions } from "../src/api/services/employeeService";
import { API_BASE } from "../src/api/api";

function normalizePhone(p: string) {
return String(p || "").replace(/\s+/g, "").trim();
}

function buildInviteMessage(empName: string, inviteUrl: string) {
const name = empName?.trim() ? empName.trim() : "Employé";
return (
`👋 Salut ${name} !\n\n` +
`Tu as été invité à rejoindre Vocoshop en tant qu’employé.\n` +
`Clique sur ce lien pour activer ton accès :\n\n` +
`${inviteUrl}\n\n` +
`Si le lien ne s’ouvre pas, copie-le dans ton navigateur.`
);
}

// ✅ WHATSAPP (app → web fallback)
async function openWhatsApp(message: string) {
const appUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
const webUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

const can = await Linking.canOpenURL(appUrl);
if (can) {
await Linking.openURL(appUrl);
return;
}
// fallback web (ouvre WhatsApp si installé, sinon navigateur)
await Linking.openURL(webUrl);
}

// ✅ SMS
async function openSms(message: string) {
// iOS: sms:&body= ; Android: sms:?body=
const sep = Platform.OS === "ios" ? "&" : "?";
const url = `sms:${sep}body=${encodeURIComponent(message)}`;

const can = await Linking.canOpenURL(url);
if (!can) throw new Error("SMS_NOT_AVAILABLE");

await Linking.openURL(url);
}

// ✅ Partage système (AirDrop, Mail, etc.)
async function shareInvite(message: string) {
await Share.share({ message });
}

export default function CreateEmployeeScreen() {
const navigation = useNavigation<any>();
const { getAuthHeaders, isReady } = useContext(AuthContext);
const headers = useMemo(() => getAuthHeaders(), [getAuthHeaders]);

const [phone, setPhone] = useState("");
const [name, setName] = useState("");
const [saving, setSaving] = useState(false);

const [permissions, setPermissions] = useState<EmployeePermissions>({
inventory: true,
sales: false,
reports: true,
orders: false,
employees: false,
});

const toggle = useCallback((k: keyof EmployeePermissions) => {
setPermissions((p) => ({ ...p, [k]: !p[k] }));
}, []);

const onSave = useCallback(async () => {
if (!isReady) return;

const p = normalizePhone(phone);
if (!p) return Alert.alert("Erreur", "Numéro requis.");

try {
setSaving(true);

const created = await createEmployee(
{
phone: p,
name: name.trim() || undefined,
role: "employee",
permissions,
},
headers
);

// ✅ ON NE PREND PLUS inviteUrl DU BACKEND
const inviteToken = (created as any)?.inviteToken as string | undefined;

if (!inviteToken) {
Alert.alert(
"Employé créé ✅",
"Créé, mais aucun token d’invitation n’a été généré (backend)."
);
navigation.goBack();
return;
}

// ✅ LIEN NGROK (clickable dans SMS/WhatsApp)
const inviteUrl = `${API_BASE}/invite?token=${encodeURIComponent(inviteToken)}`;

const message = buildInviteMessage(name, inviteUrl);

Alert.alert(
"Employé créé ✅",
"Choisis comment envoyer le lien d’invitation :",
[
{
text: "WhatsApp",
onPress: async () => {
try {
await openWhatsApp(message);
navigation.goBack();
} catch (e) {
console.log("❌ openWhatsApp", e);
Alert.alert("Erreur", "Impossible d’ouvrir WhatsApp.");
}
},
},
{
text: "SMS",
onPress: async () => {
try {
await openSms(message);
navigation.goBack();
} catch (e) {
console.log("❌ openSms", e);
Alert.alert("Erreur", "Impossible d’ouvrir l’app SMS.");
}
},
},
{
text: "Partager",
onPress: async () => {
try {
await shareInvite(message);
navigation.goBack();
} catch (e) {
console.log("❌ shareInvite", e);
Alert.alert("Erreur", "Impossible de partager.");
}
},
},
{
text: "Copier",
onPress: async () => {
try {
await Clipboard.setStringAsync(inviteUrl);
Alert.alert("Copié ✅", "Lien copié.");
navigation.goBack();
} catch (e) {
console.log("❌ clipboard", e);
Alert.alert("Erreur", "Impossible de copier le lien.");
}
},
},
{ text: "Annuler", style: "cancel" },
],
{ cancelable: true }
);
} catch (e: any) {
console.log("❌ createEmployee", e?.response?.status, e?.response?.data || e);
Alert.alert(
"Erreur",
e?.response?.data?.error || "Impossible de créer l’employé."
);
} finally {
setSaving(false);
}
}, [headers, isReady, name, navigation, permissions, phone]);

return (
<View style={styles.container}>
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.headerTitle}>Créer un employé</Text>
<View style={{ width: 26 }} />
</View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
<View style={styles.card}>
<Text style={styles.cardTitle}>Informations</Text>

<Text style={styles.label}>Téléphone</Text>
<TextInput
value={phone}
onChangeText={setPhone}
placeholder="Ex: +242 06 12 34 56"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
keyboardType="phone-pad"
/>

<Text style={styles.label}>Nom (optionnel)</Text>
<TextInput
value={name}
onChangeText={setName}
placeholder="Ex: Junior"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
/>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Permissions</Text>
<Text style={styles.cardSub}>Active uniquement ce que tu veux déléguer.</Text>

<View style={styles.permRow}>
<Text style={styles.permText}>Inventaire / Stock</Text>
<Switch value={permissions.inventory} onValueChange={() => toggle("inventory")} />
</View>

<View style={styles.permRow}>
<Text style={styles.permText}>Bilans / Rapports</Text>
<Switch value={permissions.reports} onValueChange={() => toggle("reports")} />
</View>

<View style={styles.permRow}>
<Text style={styles.permText}>Ventes</Text>
<Switch value={permissions.sales} onValueChange={() => toggle("sales")} />
</View>

<View style={styles.permRow}>
<Text style={styles.permText}>Commandes</Text>
<Switch value={permissions.orders} onValueChange={() => toggle("orders")} />
</View>

          <View style={styles.permRow}>
            <Text style={styles.permText}>Gérer les employés</Text>
            <Switch value={permissions.employees} onValueChange={() => toggle("employees")} />
          </View>
        </View>
      </ScrollView>

      {/* FIXED FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, saving ? { opacity: 0.75 } : null]}
          onPress={onSave}
          activeOpacity={0.9}
          disabled={saving}
        >
          {saving ? (
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.btnText}>Création...</Text>
            </View>
          ) : (
            <Text style={styles.btnText}>Créer</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617" },

header: {
paddingTop: 60,
paddingHorizontal: 20,
paddingBottom: 16,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},
headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },

card: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginTop: 14,
padding: 16,
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
cardTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
cardSub: { color: "#A8A3C2", fontSize: 12, marginTop: 6, lineHeight: 18 },

label: { color: "#C6C0DD", fontSize: 12, fontWeight: "900", marginTop: 12, marginBottom: 8 },
input: {
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
borderRadius: 14,
paddingHorizontal: 14,
paddingVertical: 12,
color: "#fff",
fontWeight: "800",
},

permRow: {
marginTop: 12,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 14,
paddingHorizontal: 12,
paddingVertical: 10,
},
permText: { color: "#fff", fontWeight: "900", fontSize: 13 },

btn: {
marginTop: 16,
width: "100%",
backgroundColor: "#8A4DFF",
paddingVertical: 14,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 14,
    backgroundColor: "rgba(10,6,23,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
});
