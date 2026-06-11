// screens/OrderHistoryScreen.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
FlatList,
ActivityIndicator,
RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

/* ------------------------------------------
TYPES
--------------------------------------------*/
type OrderStatus = "draft" | "sent" | "received";

interface OrderItem {
productId: string;
name: string;
quantity: number;
unitPrice?: number;
}

interface Order {
_id: string;
storeId: string;
supplier?: string;
status: OrderStatus;
items: OrderItem[];
totalEstimated?: number;
note?: string;
createdAt?: string;
updatedAt?: string;
}

/* ------------------------------------------
UTILS
--------------------------------------------*/
const formatAmount = (value?: number) => {
if (!value || isNaN(value)) return "0 FCFA";
return `${Math.round(value).toLocaleString("fr-FR")} FCFA`;
};

function computeTotal(order: Order) {
// si backend remplit totalEstimated, on l'utilise
if (typeof order.totalEstimated === "number") return order.totalEstimated;

// sinon on calcule depuis items
return (order.items || []).reduce((sum, it) => {
const q = Number(it.quantity) || 0;
const p = Number(it.unitPrice) || 0;
return sum + q * p;
}, 0);
}

function formatDateFR(dateIso?: string) {
if (!dateIso) return "";
const d = new Date(dateIso);
if (isNaN(d.getTime())) return "";
return d.toLocaleDateString("fr-FR");
}

function statusLabel(s: OrderStatus) {
if (s === "draft") return "Brouillon";
if (s === "sent") return "Envoyée";
return "Reçue";
}

function statusColor(s: OrderStatus) {
if (s === "draft") return "#FACC15"; // jaune
if (s === "sent") return "#60A5FA"; // bleu
return "#22C55E"; // vert
}

/* ------------------------------------------
SCREEN
--------------------------------------------*/
export default function OrderHistoryScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [orders, setOrders] = useState<Order[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);

const [filter, setFilter] = useState<"all" | OrderStatus>("all");

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId;

const safeNavigate = useCallback(
(screenName: string, params?: any) => {
try {
const state = navigation.getState?.();
const routeNames: string[] = state?.routeNames || [];
if (routeNames.includes(screenName)) {
navigation.navigate(screenName, params);
return true;
}
} catch {}
return false;
},
[navigation]
);

const loadOrders = useCallback(async () => {
if (!canLoad) {
setOrders([]);
setLoading(false);
return;
}

try {
setLoading(true);
const res = await API.get("/orders", { headers });
const data: any = res.data;

const list: Order[] = Array.isArray(data) ? data : [];
setOrders(list);
} catch (err) {
console.log("❌ OrderHistoryScreen loadOrders error:", err);
setOrders([]);
} finally {
setLoading(false);
}
}, [canLoad, headers]);

useFocusEffect(
useCallback(() => {
loadOrders();
}, [loadOrders])
);

const onRefresh = useCallback(async () => {
setRefreshing(true);
try {
await loadOrders();
} finally {
setRefreshing(false);
}
}, [loadOrders]);

// counts
const counts = useMemo(() => {
const draft = orders.filter((o) => o.status === "draft").length;
const sent = orders.filter((o) => o.status === "sent").length;
const received = orders.filter((o) => o.status === "received").length;
return { all: orders.length, draft, sent, received };
}, [orders]);

const filtered = useMemo(() => {
if (filter === "all") return orders;
return orders.filter((o) => o.status === filter);
}, [orders, filter]);

const openOrder = useCallback(
(order: Order) => {
// 👉 si tu as déjà EditOrderScreen:
// - Draft -> EditOrder
// - Sent/Received -> OrderDetail
if (order.status === "draft") {
const ok = safeNavigate("EditOrder", { orderId: order._id });
if (!ok) safeNavigate("Commander", { resumeOrderId: order._id });
return;
}

// details
const ok = safeNavigate("OrderDetail", { orderId: order._id });
if (!ok) safeNavigate("OrderDetails", { orderId: order._id });
},
[safeNavigate]
);

const renderOrder = ({ item }: { item: Order }) => {
const total = computeTotal(item);
const dateTxt = formatDateFR(item.createdAt || item.updatedAt);
const itemsCount = Array.isArray(item.items) ? item.items.length : 0;

return (
<TouchableOpacity
style={styles.card}
activeOpacity={0.85}
onPress={() => openOrder(item)}
>
<View style={styles.cardRow}>
<Text style={styles.cardTitle} numberOfLines={1}>
Commande • {dateTxt || "—"}
</Text>

<View style={[styles.badge, { borderColor: statusColor(item.status) }]}>
<Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
{statusLabel(item.status)}
</Text>
</View>
</View>

<View style={styles.cardRow}>
<Text style={styles.small}>
{itemsCount} produit{itemsCount > 1 ? "s" : ""}
</Text>
<Text style={styles.total}>{formatAmount(total)}</Text>
</View>

{!!item.supplier && (
<Text style={styles.small} numberOfLines={1}>
Fournisseur: {item.supplier}
</Text>
)}
</TouchableOpacity>
);
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

<Text style={styles.title}>Historique commandes</Text>
<View style={{ width: 26 }} />
</View>

{/* FILTERS */}
<View style={styles.filters}>
<FilterChip
label={`Toutes (${counts.all})`}
active={filter === "all"}
onPress={() => setFilter("all")}
/>
<FilterChip
label={`Brouillons (${counts.draft})`}
active={filter === "draft"}
onPress={() => setFilter("draft")}
/>
<FilterChip
label={`Envoyées (${counts.sent})`}
active={filter === "sent"}
onPress={() => setFilter("sent")}
/>
<FilterChip
label={`Reçues (${counts.received})`}
active={filter === "received"}
onPress={() => setFilter("received")}
/>
</View>

{/* LIST */}
{filtered.length === 0 ? (
<View style={styles.emptyWrap}>
<Ionicons name="file-tray-outline" size={34} color="#A8A3C2" />
<Text style={styles.emptyTitle}>Aucune commande</Text>
<Text style={styles.emptyDesc}>
{filter === "all"
? "Crée une commande depuis Commander."
: "Aucune commande pour ce statut."}
</Text>

<TouchableOpacity
style={styles.bigBtn}
onPress={() => navigation.navigate("Commander")}
activeOpacity={0.9}
>
<Ionicons name="cart-outline" size={18} color="#fff" />
<Text style={styles.bigBtnText}>Aller à Commander</Text>
</TouchableOpacity>
</View>
) : (
<FlatList
data={filtered}
keyExtractor={(o) => o._id}
renderItem={renderOrder}
contentContainerStyle={{ paddingBottom: 30 }}
refreshControl={
<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
}
/>
)}
</View>
);
}

/* ------------------------------------------
CHIP
--------------------------------------------*/
function FilterChip({
label,
active,
onPress,
}: {
label: string;
active: boolean;
onPress: () => void;
}) {
return (
<TouchableOpacity
onPress={onPress}
activeOpacity={0.85}
style={[styles.chip, active ? styles.chipActive : null]}
>
<Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
{label}
</Text>
</TouchableOpacity>
);
}

/* ------------------------------------------
STYLES
--------------------------------------------*/
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
marginBottom: 14,
gap: 10,
},

title: {
color: "#fff",
fontSize: 22,
fontWeight: "900",
flex: 1,
},

filters: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
marginBottom: 14,
},

chip: {
backgroundColor: "#18122B",
borderRadius: 999,
paddingVertical: 8,
paddingHorizontal: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
chipActive: {
borderColor: "rgba(167,139,250,0.8)",
backgroundColor: "rgba(124,58,237,0.18)",
},
chipText: {
color: "#A8A3C2",
fontSize: 12,
fontWeight: "800",
},
chipTextActive: {
color: "#EDE9FE",
},

card: {
backgroundColor: "#18122B",
borderRadius: 14,
padding: 16,
marginBottom: 10,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},

cardRow: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
marginBottom: 8,
},

cardTitle: {
color: "#fff",
fontWeight: "900",
flex: 1,
},

badge: {
borderWidth: 1,
borderRadius: 999,
paddingHorizontal: 10,
paddingVertical: 4,
},
badgeText: {
fontWeight: "900",
fontSize: 12,
},

small: {
color: "#A8A3C2",
fontSize: 12,
fontWeight: "700",
},

total: {
color: "#22C55E",
fontWeight: "900",
},

emptyWrap: {
flex: 1,
alignItems: "center",
justifyContent: "center",
paddingBottom: 40,
gap: 8,
},
emptyTitle: {
color: "#fff",
fontWeight: "900",
fontSize: 18,
marginTop: 8,
},
emptyDesc: {
color: "#A8A3C2",
textAlign: "center",
marginBottom: 16,
},

bigBtn: {
flexDirection: "row",
alignItems: "center",
gap: 8,
backgroundColor: "#7C3AED",
paddingVertical: 12,
paddingHorizontal: 16,
borderRadius: 12,
},
bigBtnText: {
color: "#fff",
fontWeight: "900",
},
});
