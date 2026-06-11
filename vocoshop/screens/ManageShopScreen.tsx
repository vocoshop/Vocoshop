// screens/ManageShopScreen.tsx
import React, { useContext } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { AuthContext } from "../src/api/context/AuthContext";

export default function ManageShopScreen() {
const navigation = useNavigation<any>();
const { user } = useContext(AuthContext);

const role = user?.role || "employee";
const perms = user?.permissions || {};

// owner/admin = full access
const isBoss = role === "owner" || role === "admin";

const canInventory = isBoss || !!perms.inventory;
const canReports = isBoss || !!perms.reports;
const canEmployees = isBoss || !!perms.employees;
const canOrders = isBoss || !!perms.orders;

const deny = () => Alert.alert("Accès refusé", "Tu n’as pas l’autorisation.");

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Gérer ma boutique</Text>
<View style={{ width: 26 }} />
</View>

<ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
<Text style={styles.sectionTitle}>Actions</Text>

{/* INVENTAIRES */}
<ManageItem
icon="clipboard-outline"
title="Mes inventaires"
subtitle="Faire un inventaire et appliquer les écarts au stock"
onPress={() => {
if (!canInventory) return deny();
navigation.navigate("InventorySessions");
}}
/>

{/* EMPLOYÉS */}
<ManageItem
icon="people-outline"
title="Mes employés"
subtitle="Créer un employé et gérer ses permissions"
onPress={() => {
if (!canEmployees) return deny();
navigation.navigate("Employees");
}}
/>

{/* BILANS */}
<ManageItem
icon="document-text-outline"
title="Mes bilans"
subtitle="Bilans du mois + historique"
onPress={() => {
if (!canReports) return deny();
navigation.navigate("MyReports");
}}
/>

{/*
        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Sécurité</Text>
        <ManageItem
          icon="shield-checkmark-outline"
          title="Déléguer l’ajout de stock"
          subtitle="Autoriser un employé à ajouter du stock"
          onPress={() => navigation.navigate("StockDelegation")}
        />
*/}
</ScrollView>
</View>
);
}

function ManageItem({ icon, title, subtitle, onPress }: any) {
return (
<TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={onPress}>
<View style={styles.itemLeft}>
<Ionicons name={icon} size={22} color="#B794F4" />
<View style={{ flex: 1 }}>
<Text style={styles.itemTitle}>{title}</Text>
<Text style={styles.itemSubtitle}>{subtitle}</Text>
</View>
</View>
<Ionicons name="chevron-forward" size={18} color="#666" />
</TouchableOpacity>
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
headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },

sectionTitle: {
color: "#C6C0DD",
fontSize: 14,
fontWeight: "700",
marginHorizontal: 20,
marginBottom: 10,
marginTop: 6,
},

item: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginBottom: 12,
padding: 14,
borderRadius: 14,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},
itemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
itemTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
itemSubtitle: { color: "#A8A3C2", fontSize: 12, marginTop: 2, lineHeight: 16 },
});
