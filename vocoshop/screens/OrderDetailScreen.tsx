// screens/OrderDetailScreen.tsx
import React, { useCallback, useContext, useMemo, useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ActivityIndicator,
FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

/* -------------------- TYPES -------------------- */
type OrderStatus = "draft" | "sent" | "received";

type OrderItem = {
productId: string;
name: string;
quantity: number;
unitPrice?: number;

// ✅ HYBRIDE : quantité déjà reçue via ajout stock
receivedQty?: number;
};

type Order = {
_id: string;
storeId: string;

supplier?: string; // legacy
supplierId?: string;
supplierName?: string;

status: OrderStatus;
items: OrderItem[];
totalEstimated?: number;

note?: string;
sentAt?: string | null;
receivedAt?: string | null;
createdAt?: string;
updatedAt?: string;
};

type RouteParams = {
orderId: string;
};

/* -------------------- UTILS -------------------- */
const formatAmount = (value?: number) => {
if (!value || isNaN(value)) return "0 FCFA";
return `${Math.round(value).toLocaleString("fr-FR")} FCFA`;
};

const statusLabel = (s: OrderStatus) =>
s === "draft" ? "Brouillon" : s === "sent" ? "Envoyée" : "Reçue";

const statusColor = (s: OrderStatus) =>
s === "draft" ? "#FACC15" : s === "sent" ? "#60A5FA" : "#22C55E";

function formatDateTimeFR(v?: string | null) {
if (!v) return "";
const d = new Date(v);
if (isNaN(d.getTime())) return "";
return d.toLocaleString("fr-FR");
}

function computeTotal(o: Order) {
if (typeof o.totalEstimated === "number") return o.totalEstimated;
return (o.items || []).reduce((sum, it) => {
const q = Number(it.quantity) || 0;
const p = Number(it.unitPrice) || 0;
return sum + q * p;
}, 0);
}

function clamp(n: number, min: number, max: number) {
return Math.max(min, Math.min(max, n));
}

function getOrderProgress(o: Order) {
const items = Array.isArray(o.items) ? o.items : [];
const ordered = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
const received = items.reduce((sum, it) => sum + (Number(it.receivedQty) || 0), 0);

const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0;

const allReceived =
items.length > 0 &&
items.every((it) => (Number(it.receivedQty) || 0) >= (Number(it.quantity) || 0));

return {
ordered,
received,
pct: clamp(pct, 0, 100),
allReceived,
};
}

function receptionLabel(o: Order) {
const p = getOrderProgress(o);

if (o.status === "received" || p.allReceived) return `Réception complète • ${p.pct}%`;
if (p.received <= 0) return "Non reçue";
return `Réception partielle • ${p.pct}%`;
}

/* -------------------- SCREEN -------------------- */
export default function OrderDetailScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { orderId } = (route.params || {}) as RouteParams;

const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId && !!orderId;

const [order, setOrder] = useState<Order | null>(null);
const [loading, setLoading] = useState(true);

const load = useCallback(async () => {
if (!canLoad) {
setOrder(null);
setLoading(false);
return;
}

try {
setLoading(true);
const res = await API.get<Order>(`/orders/${orderId}`, { headers });
setOrder(res.data ?? null);
} catch (e: any) {
console.log("❌ OrderDetail load error:", e?.response?.data || e);
setOrder(null);
} finally {
setLoading(false);
}
}, [canLoad, headers, orderId]);

useFocusEffect(
useCallback(() => {
load();
}, [load])
);

const total = order ? computeTotal(order) : 0;
const supplierTxt = order?.supplierName || order?.supplier || "";

if (loading) {
return (
<View style={[styles.container, { justifyContent: "center" }]}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
);
}

if (!order) {
return (
<View style={styles.container}>
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.title}>Commande</Text>
<View style={{ width: 26 }} />
</View>

<View style={styles.emptyWrap}>
<Ionicons name="alert-circle-outline" size={34} color="#A8A3C2" />
<Text style={styles.emptyTitle}>Commande introuvable</Text>
<Text style={styles.emptyDesc}>Recharge l’écran ou vérifie l’ID.</Text>

<TouchableOpacity style={styles.bigBtn} onPress={load} activeOpacity={0.9}>
<Ionicons name="refresh" size={18} color="#fff" />
<Text style={styles.bigBtnText}>Recharger</Text>
</TouchableOpacity>
</View>
</View>
);
}

const progress = getOrderProgress(order);
const effectiveStatus: OrderStatus = progress.allReceived ? "received" : order.status;

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title} numberOfLines={1}>
Détail commande
</Text>

<View style={{ width: 26 }} />
</View>

{/* CARD SUMMARY */}
<View style={styles.card}>
<View style={styles.rowBetween}>
<Text style={styles.cardTitle}>Commande</Text>

<View style={[styles.badge, { borderColor: statusColor(effectiveStatus) }]}>
<Text style={[styles.badgeText, { color: statusColor(effectiveStatus) }]}>
{statusLabel(effectiveStatus)}
</Text>
</View>
</View>

<Text style={styles.small}>
Créée : {formatDateTimeFR(order.createdAt || order.updatedAt) || "—"}
</Text>

{/* ✅ Réception (même si receivedAt est vide) */}
<Text style={styles.small}>{receptionLabel(order)}</Text>

{!!order.sentAt && (
<Text style={styles.small}>Envoyée : {formatDateTimeFR(order.sentAt)}</Text>
)}
{!!order.receivedAt && (
<Text style={styles.small}>Reçue : {formatDateTimeFR(order.receivedAt)}</Text>
)}

{!!supplierTxt && (
<Text style={[styles.small, { marginTop: 8 }]}>Fournisseur : {supplierTxt}</Text>
)}

<View style={[styles.rowBetween, { marginTop: 12 }]}>
<Text style={styles.totalLabel}>Total</Text>
<Text style={styles.totalValue}>{formatAmount(total)}</Text>
</View>

{!!order.note && (
<>
<Text style={[styles.section, { marginTop: 12 }]}>Note</Text>
<Text style={styles.note}>{order.note}</Text>
</>
)}
</View>

{/* ITEMS */}
<Text style={styles.sectionTitle}>Produits</Text>

<FlatList
data={order.items || []}
keyExtractor={(it, idx) => `${it.productId}-${idx}`}
contentContainerStyle={{ paddingBottom: 30 }}
ListEmptyComponent={
<Text style={{ color: "#A8A3C2", marginTop: 10 }}>Aucun produit.</Text>
}
renderItem={({ item }) => {
const qty = Number(item.quantity) || 0;
const price = Number(item.unitPrice) || 0;
const lineTotal = qty * price;

const received = clamp(Number(item.receivedQty) || 0, 0, qty);
const ratio = qty > 0 ? received / qty : 0;
const isComplete = qty > 0 && received >= qty;

const receivedColor =
received <= 0 ? "#A8A3C2" : isComplete ? "#22C55E" : "#A78BFA";

return (
<View style={styles.itemRow}>
<View style={{ flex: 1, paddingRight: 10 }}>
<View style={styles.itemTopRow}>
<Text style={styles.itemName} numberOfLines={1}>
{item.name}
</Text>

{isComplete ? (
<View style={styles.donePill}>
<Ionicons name="checkmark" size={14} color="#22C55E" />
<Text style={styles.donePillText}>Reçu</Text>
</View>
) : null}
</View>

<Text style={styles.itemSmall}>
{qty} × {formatAmount(price)}
</Text>

{/* ✅ HYBRIDE */}
<Text style={[styles.receivedText, { color: receivedColor }]}>
Reçu : {received}/{qty}
</Text>

{/* Barre de progression (safe) */}
{qty > 0 ? (
<View style={styles.progressTrack}>
<View
style={[
styles.progressFill,
{ width: `${Math.round(ratio * 100)}%` },
]}
/>
</View>
) : null}
</View>

<Text style={styles.itemTotal}>{formatAmount(lineTotal)}</Text>
</View>
);
}}
/>
</View>
);
}

/* -------------------- STYLES -------------------- */
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
fontSize: 20,
fontWeight: "900",
flex: 1,
},

card: {
backgroundColor: "#18122B",
borderRadius: 16,
padding: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},

rowBetween: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
},

cardTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },

badge: {
borderWidth: 1,
borderRadius: 999,
paddingHorizontal: 10,
paddingVertical: 4,
},
badgeText: { fontWeight: "900", fontSize: 12 },

small: { color: "#A8A3C2", fontSize: 12, marginTop: 4, fontWeight: "700" },

sectionTitle: {
marginTop: 16,
color: "#C6C0DD",
fontWeight: "900",
fontSize: 14,
marginBottom: 10,
},

section: { color: "#EDE9FE", fontWeight: "900", marginBottom: 6 },

note: { color: "#A8A3C2", lineHeight: 18 },

totalLabel: { color: "#E5E7EB", fontWeight: "900" },
totalValue: { color: "#22C55E", fontWeight: "900" },

itemRow: {
backgroundColor: "#18122B",
borderRadius: 14,
padding: 14,
marginBottom: 10,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},

itemTopRow: {
flexDirection: "row",
alignItems: "center",
gap: 10,
},

itemName: { color: "#fff", fontWeight: "900", flex: 1 },

itemSmall: { color: "#A8A3C2", marginTop: 4, fontWeight: "700", fontSize: 12 },

itemTotal: { color: "#22C55E", fontWeight: "900", marginLeft: 10 },

receivedText: {
marginTop: 6,
fontWeight: "800",
fontSize: 12,
},

progressTrack: {
marginTop: 8,
height: 6,
borderRadius: 999,
backgroundColor: "rgba(255,255,255,0.08)",
overflow: "hidden",
},

progressFill: {
height: 6,
borderRadius: 999,
backgroundColor: "rgba(34,197,94,0.85)",
},

donePill: {
flexDirection: "row",
alignItems: "center",
gap: 4,
paddingHorizontal: 8,
paddingVertical: 4,
borderRadius: 999,
backgroundColor: "rgba(34,197,94,0.12)",
borderWidth: 1,
borderColor: "rgba(34,197,94,0.35)",
},

donePillText: {
color: "#22C55E",
fontWeight: "900",
fontSize: 12,
},

emptyWrap: {
flex: 1,
alignItems: "center",
justifyContent: "center",
paddingBottom: 40,
gap: 8,
},
emptyTitle: { color: "#fff", fontWeight: "900", fontSize: 18, marginTop: 8 },
emptyDesc: { color: "#A8A3C2", textAlign: "center", marginBottom: 16 },

bigBtn: {
flexDirection: "row",
alignItems: "center",
gap: 8,
backgroundColor: "#7C3AED",
paddingVertical: 12,
paddingHorizontal: 16,
borderRadius: 12,
},
bigBtnText: { color: "#fff", fontWeight: "900" },
});
