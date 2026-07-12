// screens/EditEmployeeScreen.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { AuthContext } from "../src/api/context/AuthContext";
import { Employee, EmployeePermissions, updateEmployee, toggleEmployee, deleteEmployee } from "../src/api/services/employeeService";

type RouteParams = { employee: Employee };

export default function EditEmployeeScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { employee } = (route.params || {}) as RouteParams;

const { getAuthHeaders } = useContext(AuthContext);
const headers = useMemo(() => getAuthHeaders(), [getAuthHeaders]);

const [name, setName] = useState(employee?.name || "");
const [saving, setSaving] = useState(false);
const [toggling, setToggling] = useState(false);

const basePerm: EmployeePermissions = {
inventory: true,
sales: false,
reports: true,
orders: false,
employees: false,
};

const [permissions, setPermissions] = useState<EmployeePermissions>({
...basePerm,
...(employee?.permissions || {}),
});

const togglePerm = useCallback((k: keyof EmployeePermissions) => {
setPermissions((p) => ({ ...p, [k]: !p[k] }));
}, []);

const onSave = useCallback(async () => {
try {
setSaving(true);
await updateEmployee(employee._id, { name: name.trim() || undefined, permissions }, headers);
Alert.alert("OK", "Modifications enregistrées.");
navigation.goBack();
} catch (e: any) {
console.log("❌ updateEmployee", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", e?.response?.data?.error || "Impossible d’enregistrer.");
} finally {
setSaving(false);
}
}, [employee._id, headers, name, navigation, permissions]);

const onToggleActive = useCallback(async () => {
if (toggling) return;
try {
setToggling(true);
const next = await toggleEmployee(employee._id, headers);
Alert.alert("OK", next.isActive === false ? "Employé désactivé." : "Employé activé.");
navigation.goBack();
} catch (e: any) {
console.log("❌ toggleEmployee", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", "Impossible de modifier le statut.");
} finally {
setToggling(false);
}
}, [employee._id, headers, navigation, toggling]);

const onDelete = useCallback(async () => {
Alert.alert("Supprimer", "Supprimer définitivement cet employé ?", [
{ text: "Annuler", style: "cancel" },
{
text: "Supprimer",
style: "destructive",
onPress: async () => {
try {
setSaving(true);
await deleteEmployee(employee._id, headers);
Alert.alert("OK", "Employé supprimé.");
navigation.goBack();
} catch (e: any) {
console.log("❌ deleteEmployee", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", e?.response?.data?.error || "Impossible de supprimer.");
} finally {
setSaving(false);
}
},
},
]);
}, [employee._id, headers, navigation]);

if (!employee?._id) {
return (
<View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
<Text style={{ color: "#fff" }}>Employé introuvable.</Text>
</View>
);
}

return (
<View style={styles.container}>
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.headerTitle}>Modifier</Text>
<View style={{ width: 26 }} />
</View>

    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
<View style={styles.card}>
<Text style={styles.cardTitle}>Employé</Text>
<Text style={styles.cardSub}>{employee.phone} • {employee.role}</Text>

<Text style={styles.label}>Nom</Text>
<TextInput
value={name}
onChangeText={setName}
placeholder="Nom"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
          />
        </View>

        <View style={styles.card}>
<Text style={styles.cardTitle}>Permissions</Text>
<Text style={styles.cardSub}>Ce que l’employé a le droit de voir / faire.</Text>

{(["inventory", "reports", "sales", "orders", "employees"] as Array<keyof EmployeePermissions>).map((k) => (
<View key={k} style={styles.permRow}>
<Text style={styles.permText}>
{k === "inventory" ? "Inventaire / Stock" :
k === "reports" ? "Bilans / Rapports" :
k === "sales" ? "Ventes" :
k === "orders" ? "Commandes" : "Gérer les employés"}
</Text>
<Switch value={permissions[k]} onValueChange={() => togglePerm(k)} />
</View>
))}
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Actions</Text>

<TouchableOpacity
style={[styles.btnGhost, toggling ? { opacity: 0.75 } : null]}
onPress={onToggleActive}
activeOpacity={0.9}
disabled={toggling}
>
<Text style={styles.btnGhostText}>{employee.isActive === false ? "Activer" : "Désactiver"}</Text>
</TouchableOpacity>

<TouchableOpacity style={[styles.btnDanger]} onPress={onDelete} activeOpacity={0.9}>
<Text style={styles.btnDangerText}>Supprimer</Text>
</TouchableOpacity>
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
            <Text style={styles.btnText}>Sauvegarde...</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>Enregistrer</Text>
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

btnGhost: {
marginTop: 12,
width: "100%",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
paddingVertical: 14,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
btnGhostText: { color: "#fff", fontWeight: "900", fontSize: 15 },

btnDanger: {
marginTop: 12,
width: "100%",
backgroundColor: "rgba(255,59,59,0.18)",
borderWidth: 1,
borderColor: "rgba(255,59,59,0.35)",
paddingVertical: 14,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
  btnDangerText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 14,
    backgroundColor: "rgba(10,6,23,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
});
