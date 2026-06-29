// screens/ConsolidatedInventoryScreen.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
ScrollView,
ActivityIndicator,
TouchableOpacity,
RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type Line = {
productId: string;
productName: string;
category?: string;
stockQuantity: number;
countedQuantity: number;
diff: number;
countedByName: string;
sessionStatus: string;
};

export default function ConsolidatedInventoryScreen({ navigation }: any) {
const { token, storeId } = useContext(AuthContext);
const headers = useMemo(() => ({
Authorization: token ? `Bearer ${token}` : "",
...(storeId ? { "x-store-id": storeId } : {}),
}), [token, storeId]);

const [lines, setLines] = useState<Line[]>([]);
const [sessionCount, setSessionCount] = useState(0);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

const load = useCallback(async (silent?: boolean) => {
if (!token || !storeId) return;
if (!silent) setLoading(true);
try {
const res: any = await API.get("/inventory/consolidated", { headers });
const data = res.data || {};
setLines(Array.isArray(data.lines) ? data.lines : []);
setSessionCount(data.sessionCount ?? 0);
} catch {
setLines([]);
} finally {
setLoading(false);
setRefreshing(false);
}
}, [headers, token, storeId]);

useEffect(() => { load(); }, [load]);

const pos = lines.filter(l => l.diff > 0).length;
const neg = lines.filter(l => l.diff < 0).length;
const zero = lines.filter(l => l.diff === 0).length;

return (
<View style={styles.container}>
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<View style={{ flex: 1 }}>
<Text style={styles.title}>Inventaire consolidé</Text>
<Text style={styles.subtitle}>{sessionCount} session(s) · {lines.length} produit(s)</Text>
</View>
<TouchableOpacity onPress={() => load()} style={styles.backBtn}>
<Ionicons name="refresh-outline" size={20} color="#C6C0DD" />
</TouchableOpacity>
</View>

<View style={styles.summaryBox}>
<View style={styles.summaryItem}>
<Text style={styles.summaryValue}>{lines.length}</Text>
<Text style={styles.summaryLabel}>Produits</Text>
</View>
<View style={styles.summaryDivider} />
<View style={styles.summaryItem}>
<Text style={[styles.summaryValue, { color: "#4ADE80" }]}>{pos}</Text>
<Text style={styles.summaryLabel}>+</Text>
</View>
<View style={styles.summaryDivider} />
<View style={styles.summaryItem}>
<Text style={[styles.summaryValue, { color: "#F87171" }]}>{neg}</Text>
<Text style={styles.summaryLabel}>-</Text>
</View>
<View style={styles.summaryDivider} />
<View style={styles.summaryItem}>
<Text style={[styles.summaryValue, { color: "#E5E7EB" }]}>{zero}</Text>
<Text style={styles.summaryLabel}>OK</Text>
</View>
</View>

{loading ? (
<View style={styles.center}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
) : (
<ScrollView
contentContainerStyle={{ paddingBottom: 120 }}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor="#A78BFA" />}
>
{lines.length === 0 ? (
<View style={styles.emptyBox}>
<Ionicons name="clipboard-outline" size={26} color="#A78BFA" />
<Text style={styles.emptyText}>Aucune session d'inventaire en cours</Text>
</View>
) : (
lines.map((item, i) => {
const diff = item.diff;
return (
<View key={i} style={styles.card}>
<View style={styles.cardLeft}>
<Ionicons name="cube-outline" size={26} color="#C59CFF" />
</View>
<View style={{ flex: 1 }}>
<Text style={styles.productName}>{item.productName}</Text>
<Text style={styles.productCategory}>{item.category || "—"}</Text>
<Text style={styles.smallText}>Stock : <Text style={styles.valueText}>{item.stockQuantity}</Text></Text>
<Text style={styles.smallText}>Compté : <Text style={styles.valueText}>{item.countedQuantity}</Text></Text>
<Text style={[styles.diffText, { color: diff > 0 ? "#4ADE80" : diff < 0 ? "#F87171" : "#E5E7EB" }]}>
Écart : {diff > 0 ? `+${diff}` : `${diff}`}
</Text>
<Text style={styles.countedByText}>Par : {item.countedByName}</Text>
</View>
</View>
);
})
)}
</ScrollView>
)}
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 50, paddingHorizontal: 20 },
header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
title: { fontSize: 24, color: "#fff", fontWeight: "900" },
subtitle: { color: "#A8A3C2", marginTop: 2, fontSize: 12 },
center: { flex: 1, alignItems: "center", justifyContent: "center" },
summaryBox: {
backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10,
flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
},
summaryItem: { flex: 1, alignItems: "center" },
summaryDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.08)" },
summaryValue: { color: "#fff", fontWeight: "900", fontSize: 16 },
summaryLabel: { color: "#A8A3C2", fontSize: 11, marginTop: 2, fontWeight: "700" },
emptyBox: {
marginTop: 30, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
borderRadius: 18, padding: 16, alignItems: "center",
},
emptyText: { marginTop: 10, color: "#A8A3C2", fontSize: 12, textAlign: "center" },
card: {
backgroundColor: "#18122B", padding: 16, borderRadius: 14,
flexDirection: "row", alignItems: "flex-start", marginBottom: 12,
},
cardLeft: {
width: 48, height: 48, borderRadius: 14, backgroundColor: "#1E1838",
alignItems: "center", justifyContent: "center", marginRight: 12,
},
productName: { color: "#fff", fontSize: 16, fontWeight: "900" },
productCategory: { color: "#A8A3C2", fontSize: 12, marginBottom: 8 },
smallText: { color: "#C6C0DD", marginTop: 2, fontSize: 12 },
valueText: { color: "#fff", fontWeight: "900" },
diffText: { marginTop: 8, fontSize: 14, fontWeight: "900" },
countedByText: { color: "#A78BFA", marginTop: 4, fontSize: 11, fontWeight: "600" },
});
