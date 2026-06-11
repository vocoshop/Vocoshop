// screens/EmployeesScreen.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
FlatList,
ActivityIndicator,
Alert,
Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import { AuthContext } from "../src/api/context/AuthContext";
import { Employee, listEmployees, toggleEmployee } from "../src/api/services/employeeService";

export default function EmployeesScreen() {
const navigation = useNavigation<any>();
const { getAuthHeaders, isReady } = useContext(AuthContext);

// ⚠️ IMPORTANT: ne pas figer headers trop tôt si token arrive après
const headers = useMemo(() => getAuthHeaders(), [getAuthHeaders]);

const [loading, setLoading] = useState(false);
const [items, setItems] = useState<Employee[]>([]);

const load = useCallback(async () => {
if (!isReady) return;

try {
setLoading(true);
const data = await listEmployees(headers);
setItems(Array.isArray(data) ? data : []);
} catch (e: any) {
console.log("❌ listEmployees", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", "Impossible de charger les employés.");
} finally {
setLoading(false);
}
}, [headers, isReady]);

// ✅ recharge quand on arrive sur l’écran (et quand on y revient)
useFocusEffect(
useCallback(() => {
load();
}, [load])
);

const onToggle = useCallback(
async (emp: Employee) => {
try {
const next = await toggleEmployee(emp._id, headers);
setItems((prev) => prev.map((x) => (x._id === emp._id ? next : x)));
} catch (e: any) {
console.log("❌ toggleEmployee", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", "Impossible de modifier le statut.");
}
},
[headers]
);

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Mes employés</Text>

<TouchableOpacity
onPress={() => navigation.navigate("EmployeeCreate")}
activeOpacity={0.85}
style={styles.addBtn}
>
<Ionicons name="add" size={22} color="#fff" />
</TouchableOpacity>
</View>

{!isReady ? (
<View style={{ paddingTop: 30, alignItems: "center" }}>
<ActivityIndicator color="#fff" />
<Text style={{ color: "#A8A3C2", marginTop: 10, fontSize: 12 }}>Chargement...</Text>
</View>
) : (
<FlatList
data={items}
keyExtractor={(item) => item._id}
contentContainerStyle={{ paddingBottom: 30 }}
ListHeaderComponent={
<>
<View style={styles.card}>
<Text style={styles.cardTitle}>Équipe</Text>
<Text style={styles.cardSub}>
Crée des accès limités pour déléguer (stock, ventes, bilans…). Chaque employé voit
seulement ce que tu autorises.
</Text>

<TouchableOpacity
style={[styles.btn, { marginTop: 12 }, loading ? { opacity: 0.85 } : null]}
onPress={load}
activeOpacity={0.9}
disabled={loading}
>
{loading ? (
<View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
<ActivityIndicator color="#fff" />
<Text style={styles.btnText}>Rafraîchir...</Text>
</View>
) : (
<Text style={styles.btnText}>Rafraîchir</Text>
)}
</TouchableOpacity>
</View>

<View style={styles.card}>
<View style={styles.rowBetween}>
<Text style={styles.cardTitle}>Liste</Text>
{loading ? <ActivityIndicator color="#fff" /> : null}
</View>

{items.length === 0 && !loading ? (
<Text style={styles.emptyText}>
Aucun employé pour l'instant. Appuie sur "+" pour en créer un.
</Text>
) : null}
</View>
</>
}
renderItem={({ item, index }) => {
const active = item.isActive !== false;
return (
<TouchableOpacity
style={styles.itemRow}
activeOpacity={0.85}
onPress={() => navigation.navigate("EmployeeEdit", { employee: item })}
>
<View style={{ flex: 1 }}>
<Text style={styles.itemName} numberOfLines={1}>
{index + 1}. {item.name?.trim() ? item.name : "Employé"} • {item.role}
</Text>
<Text style={styles.itemMeta} numberOfLines={1}>
{item.phone} {active ? "• Actif" : "• Désactivé"}
</Text>
</View>

<Pressable
onPress={() => onToggle(item)}
style={[styles.pill, active ? styles.pillOn : styles.pillOff]}
>
<Text style={styles.pillText}>{active ? "Actif" : "Off"}</Text>
</Pressable>

<Ionicons name="chevron-forward" size={18} color="#C6C0DD" style={{ marginLeft: 8 }} />
</TouchableOpacity>
);
}}
/>
)}
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

addBtn: {
width: 38,
height: 38,
borderRadius: 12,
backgroundColor: "rgba(138,77,255,0.35)",
borderWidth: 1,
borderColor: "rgba(138,77,255,0.55)",
alignItems: "center",
justifyContent: "center",
},

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

btn: {
width: "100%",
backgroundColor: "#8A4DFF",
paddingVertical: 12,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
btnText: { color: "#fff", fontWeight: "900", fontSize: 14 },

rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

emptyText: { color: "#A8A3C2", fontSize: 12, marginTop: 12, lineHeight: 18 },

itemRow: {
marginTop: 10,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
backgroundColor: "rgba(255,255,255,0.05)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
borderRadius: 14,
paddingHorizontal: 12,
paddingVertical: 12,
gap: 10,
},
itemName: { color: "#fff", fontWeight: "900", fontSize: 13 },
itemMeta: { marginTop: 4, color: "#A8A3C2", fontSize: 11, lineHeight: 16 },

pill: {
paddingVertical: 6,
paddingHorizontal: 10,
borderRadius: 999,
borderWidth: 1,
},
pillOn: { backgroundColor: "rgba(154,245,199,0.14)", borderColor: "rgba(154,245,199,0.28)" },
pillOff: { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.18)" },
pillText: { color: "#fff", fontWeight: "900", fontSize: 12 },
});
