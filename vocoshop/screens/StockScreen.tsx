// screens/StockScreen.tsx
import React, { useContext, useMemo, useCallback } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { AuthContext } from "../src/api/context/AuthContext";

type PermKey = "inventory" | "sales" | "reports" | "orders" | "employees";

export default function StockScreen() {
const navigation = useNavigation<any>();
const { user } = useContext(AuthContext);

// ✅ Permission inventory = accès au module Stock
const canInventory = useMemo(() => {
const role = String(user?.role || "");
if (role === "owner" || role === "admin") return true;

const perms = user?.permissions || {};
return Boolean((perms as any)?.inventory);
}, [user]);

const deny = useCallback(() => {
Alert.alert("Accès limité", "Tu n'as pas l'autorisation d'accéder au module Stock.");
}, []);

const go = useCallback(
(screenName: string) => {
if (!canInventory) return deny();

// VoiceStock est maintenant enregistré dans App.tsx
// La vérification spéciale n'est plus nécessaire

navigation.navigate(screenName);
},
[canInventory, deny, navigation]
);

return (
<View style={styles.container}>
<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity
style={styles.backBtn}
onPress={() => navigation.goBack()}
activeOpacity={0.85}
>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<View style={{ flex: 1 }}>
<Text style={styles.header}>Stock</Text>
<Text style={styles.subHeader}>Gérez vos mouvements de stock</Text>
</View>
</View>

{/* ✅ Bandeau accès limité */}
{!canInventory && (
<View style={styles.lockBanner}>
<Ionicons name="lock-closed-outline" size={18} color="#FFB020" />
<Text style={styles.lockText}>
Accès limité — demande au patron de t’autoriser l’inventaire.
</Text>
</View>
)}

{/* GRID DES 4 MODULES */}
<View style={styles.grid}>
{/* ➕ AJOUTER DU STOCK */}
<TouchableOpacity
style={[styles.card, !canInventory && styles.cardDisabled]}
onPress={() => go("AddStock")}
activeOpacity={0.85}
>
<Ionicons name="add-circle-outline" size={34} color="#7DA6FF" />
<Text style={styles.cardTitle}>Ajouter du stock</Text>
<Text style={styles.cardDesc}>Entrée de nouveaux articles</Text>
</TouchableOpacity>

{/* ➖ RETIRER DU STOCK */}
<TouchableOpacity
style={[styles.card, !canInventory && styles.cardDisabled]}
onPress={() => go("RemoveStock")}
activeOpacity={0.85}
>
<Ionicons name="remove-circle-outline" size={34} color="#FF6B6B" />
<Text style={styles.cardTitle}>Retirer du stock</Text>
<Text style={styles.cardDesc}>Sorties, pertes, casses</Text>
</TouchableOpacity>

{/* 🎤 STOCK PAR LA VOIX */}
<TouchableOpacity
style={[styles.card, !canInventory && styles.cardDisabled]}
onPress={() => go("VoiceStock")}
activeOpacity={0.85}
>
<Ionicons name="mic-outline" size={34} color="#BA8BFF" />
<Text style={styles.cardTitle}>Stock par la voix</Text>
<Text style={styles.cardDesc}>Dis "ajoute 10 savons" ou "retire 5 pains"</Text>
</TouchableOpacity>

{/* 📘 HISTORIQUE DU STOCK */}
<TouchableOpacity
style={[styles.card, !canInventory && styles.cardDisabled]}
onPress={() => go("StockHistory")}
activeOpacity={0.85}
>
<Ionicons name="time-outline" size={34} color="#7ED0FF" />
<Text style={styles.cardTitle}>Historique du stock</Text>
<Text style={styles.cardDesc}>Tous les mouvements enregistrés</Text>
</TouchableOpacity>
</View>
</ScrollView>
</View>
);
}

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
marginBottom: 10,
},

backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
marginRight: 15,
},

header: {
color: "#fff",
fontSize: 26,
fontWeight: "800",
},

subHeader: {
color: "#B3AEC7",
fontSize: 15,
marginTop: 4,
},

lockBanner: {
marginTop: 14,
marginBottom: 18,
backgroundColor: "rgba(255,176,32,0.10)",
borderColor: "rgba(255,176,32,0.25)",
borderWidth: 1,
padding: 12,
borderRadius: 14,
flexDirection: "row",
alignItems: "center",
gap: 10,
},

lockText: {
color: "#FFCF7D",
fontSize: 13,
fontWeight: "700",
flex: 1,
lineHeight: 18,
},

grid: {
flexDirection: "row",
flexWrap: "wrap",
justifyContent: "space-between",
},

card: {
width: "47%",
backgroundColor: "#18122B",
borderRadius: 18,
padding: 18,
marginBottom: 18,
},

cardDisabled: {
opacity: 0.45,
},

cardTitle: {
color: "#fff",
fontWeight: "800",
marginTop: 12,
fontSize: 16,
},

cardDesc: {
color: "#A8A3C2",
fontSize: 12,
marginTop: 4,
},
});
