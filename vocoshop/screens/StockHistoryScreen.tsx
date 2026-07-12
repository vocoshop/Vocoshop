// screens/StockHistoryScreen.tsx
import React, { useEffect, useState, useContext, useCallback, useMemo } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
TouchableOpacity,
ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";
import { useNavigation } from "@react-navigation/native";

export default function StockHistoryScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [list, setList] = useState<any[]>([]);
const [loading, setLoading] = useState(true);

const load = useCallback(async () => {
try {
const res = await API.get("/stock-history/all", {
headers: {
Authorization: `Bearer ${token}`,
"x-store-id": storeId,
},
});
setList(Array.isArray(res.data) ? res.data : []);
} catch (err) {
console.log("❌ loadStockHistory error:", err);
}
setLoading(false);
}, [token, storeId]);

useEffect(() => {
load();
}, [load]);

// Grouper par date
const groups = useMemo(() => {
const map = new Map<string, any[]>();
for (const item of list) {
const key = item.date ? new Date(item.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date inconnue";
if (!map.has(key)) map.set(key, []);
map.get(key)!.push(item);
}
return Array.from(map.entries()).sort((a, b) => {
const da = a[1][0]?.date ? new Date(a[1][0].date).getTime() : 0;
const db = b[1][0]?.date ? new Date(b[1][0].date).getTime() : 0;
return db - da;
});
}, [list]);

const toggleDate = (dateKey: string, items: any[]) => {
navigation.navigate("StockDayDetail", { date: dateKey, items });
};

const renderIcon = (type: string) => {
switch (type) {
case "inventory":
return <Ionicons name="clipboard-outline" size={20} color="#C59CFF" />;
case "addition":
return <Ionicons name="add-circle-outline" size={20} color="#4ADE80" />;
case "withdrawal":
return <Ionicons name="remove-circle-outline" size={20} color="#F87171" />;
default:
return <Ionicons name="ellipse-outline" size={20} color="#A8A3C2" />;
}
};

const getSummary = (items: any[]) => {
let additions = 0, withdrawals = 0, inventories = 0;
for (const item of items) {
if (item.type === "inventory") inventories++;
else if (item.type === "addition") additions++;
else if (item.type === "withdrawal") withdrawals++;
}
const parts: string[] = [];
if (inventories) parts.push(`${inventories} inventaire${inventories > 1 ? "s" : ""}`);
if (additions) parts.push(`${additions} ajout${additions > 1 ? "s" : ""}`);
if (withdrawals) parts.push(`${withdrawals} retrait${withdrawals > 1 ? "s" : ""}`);
return parts.join(", ") || "Aucune opération";
};

return (
<View style={styles.container}>
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Historique du stock</Text>
<View style={{ width: 26 }} />
</View>

<Text style={styles.subtitle}>
Toutes les opérations : inventaires, ajouts et retraits
</Text>

{loading ? (
<ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 50 }} />
) : groups.length === 0 ? (
<Text style={styles.empty}>Aucune opération pour le moment.</Text>
) : (
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {groups.map(([dateKey, items]) => {
          const totalOps = items.length;
          return (
            <TouchableOpacity
              key={dateKey}
              style={styles.groupHeader}
              activeOpacity={0.8}
              onPress={() => toggleDate(dateKey, items)}
            >
              <View style={styles.groupHeaderLeft}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{totalOps}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupDate}>{dateKey}</Text>
                  <Text style={styles.groupSummary}>{getSummary(items)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
)}
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
marginBottom: 6,
gap: 10,
},
title: {
color: "#fff",
fontSize: 24,
fontWeight: "900",
},
subtitle: {
color: "#A8A3C2",
marginBottom: 20,
},
empty: {
color: "#A8A3C2",
marginTop: 30,
fontSize: 15,
textAlign: "center",
},
group: {
marginBottom: 12,
},
groupHeader: {
backgroundColor: "#18122B",
padding: 16,
borderRadius: 14,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
groupHeaderLeft: {
flexDirection: "row",
alignItems: "center",
gap: 12,
flex: 1,
},
dateBadge: {
width: 32,
height: 32,
borderRadius: 10,
backgroundColor: "rgba(167,139,250,0.15)",
alignItems: "center",
justifyContent: "center",
},
dateBadgeText: {
color: "#A78BFA",
fontSize: 14,
fontWeight: "800",
},
groupDate: {
color: "#fff",
fontSize: 14,
fontWeight: "700",
},
groupSummary: {
color: "#888",
fontSize: 12,
marginTop: 2,
},
});
