// screens/HealthStockScreen.tsx
import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
View,
Text,
StyleSheet,
ActivityIndicator,
ScrollView,
TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type Mode = "low" | "expiring";

type RouteParams = {
mode?: Mode; // "low" par défaut
};

interface ProductItem {
_id: string;
name: string;
quantity: number;
alertLevel?: number; // low-stock
expirationDates?: string[]; // backend: Date[] => JSON ISO string[]
}

/**
* ✅ Retourne la date d’expiration la plus proche (future, >= aujourd’hui)
* Si aucune future, retourne la plus récente passée (pour afficher "Expiré")
*/
function getNearestExpiration(dates?: string[]) {
if (!Array.isArray(dates) || dates.length === 0) return null;

const now = new Date();
const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const parsed = dates
.map((x) => {
const d = new Date(x);
return isNaN(d.getTime()) ? null : d;
})
.filter((d): d is Date => d !== null);

if (parsed.length === 0) return null;

const future = parsed
.filter((d) => d >= startToday)
.sort((a, b) => a.getTime() - b.getTime());

if (future.length > 0) return { date: future[0], isExpired: false };

// Toutes passées => la plus récente passée
parsed.sort((a, b) => b.getTime() - a.getTime());
return { date: parsed[0], isExpired: true };
}

export default function HealthStockScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { mode = "low" } = (route.params || {}) as RouteParams;

const { token, storeId } = useContext(AuthContext);

const [items, setItems] = useState<ProductItem[]>([]);
const [loading, setLoading] = useState(true);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId;

/**
* ✅ Standardisation :
* - low-stock => /products/low-stock
* - expiring => /products/expiring (déjà filtré par backend via expirationDates $elemMatch)
*/
const endpoint = useMemo(() => {
if (mode === "expiring") return "/products/expiring";
return "/products/low-stock";
}, [mode]);

const title = mode === "expiring" ? "Produits à expiration" : "Santé du Stock";
const subtitle =
mode === "expiring"
? "Produits qui expirent bientôt"
: "Risques, alertes et surveillance du stock";

// ✅ réglage demandé : alerte expiring sur 30 jours
const EXPIRING_DAYS = 30;

const load = useCallback(async () => {
if (!canLoad) {
setItems([]);
setLoading(false);
return;
}

try {
setLoading(true);

// ✅ FIX BUG : quand mode=expiring, on passe days=30 (sinon backend default=7)
const res = await API.get(endpoint, {
headers,
params: mode === "expiring" ? { days: EXPIRING_DAYS } : undefined,
});
setItems(Array.isArray(res.data) ? (res.data as ProductItem[]) : []);
} catch (err) {
console.log("❌ loadStockHealth error:", err);
setItems([]);
} finally {
setLoading(false);
}
}, [canLoad, endpoint, headers, mode]);

useEffect(() => {
load();
}, [load]);

// ✅ KPI uniquement pour low-stock
const ruptures = items.filter((p) => (p.quantity ?? 0) <= 0);
const critical = items.filter((p) => {
const qty = p.quantity ?? 0;
const level = p.alertLevel ?? 0;
return qty > 0 && level > 0 && qty <= level;
});

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

<Text style={styles.title}>{title}</Text>
<View style={{ width: 26 }} />
</View>

<Text style={styles.subtitle}>{subtitle}</Text>

<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
{/* KPI (uniquement stock faible) */}
{mode === "low" && (
<View style={styles.block}>
<Text style={styles.blockTitle}>📊 Indicateurs clés</Text>
<Text style={styles.blockDesc}>
Suivi des risques critiques détectés dans votre boutique :
</Text>

<View style={styles.row}>
<Text style={styles.label}>Produits en rupture</Text>
<Text style={[styles.value, { color: "#EF4444" }]}>
{ruptures.length}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Stock critique</Text>
<Text style={[styles.value, { color: "#EAB308" }]}>
{critical.length}
</Text>
</View>
</View>
)}

{/* Liste */}
<View style={styles.block}>
<Text style={styles.blockTitle}>
{mode === "expiring" ? "🔥 Produits bientôt expirés" : "⚠️ Produits sensibles"}
</Text>

<Text style={styles.blockDesc}>
{mode === "expiring"
? "Aperçu des produits à renouveler rapidement"
: "Aperçu des articles en liste d’alerte"}
</Text>

{items.length === 0 ? (
<Text style={styles.empty}>
{mode === "expiring"
? "Aucun produit proche expiration 👌"
: "Aucun produit critique 👌"}
</Text>
) : (
items.slice(0, 30).map((p) => {
const qty = p.quantity ?? 0;
const level = p.alertLevel ?? 0;

const nearest = getNearestExpiration(p.expirationDates);

const statusText =
mode === "expiring"
? nearest?.date
? nearest.isExpired
? `Expiré (dernier: ${nearest.date.toLocaleDateString("fr-FR")})`
: `Expire le ${nearest.date.toLocaleDateString("fr-FR")}`
: "Expiration"
: qty <= 0
? "Rupture"
: level > 0 && qty <= level
? "Stock faible"
: "À surveiller";

const statusColor =
mode === "expiring"
? "#FF9F43"
: qty <= 0
? "#EF4444"
: level > 0 && qty <= level
? "#EAB308"
: "#FACC15";

return (
<TouchableOpacity
key={p._id}
style={styles.card}
activeOpacity={0.85}
onPress={() =>
navigation.navigate("StockProductDetails", { productId: p._id })
}
>
<View style={styles.cardRow}>
<Text style={styles.productName} numberOfLines={1}>
{p.name}
</Text>
<Text style={[styles.status, { color: statusColor }]}>
{statusText}
</Text>
</View>

<View style={styles.cardRow}>
<Text style={styles.labelSmall}>Stock actuel</Text>
<Text style={styles.valueSmall}>{qty}</Text>
</View>

{mode === "low" && (
<View style={styles.cardRow}>
<Text style={styles.labelSmall}>Seuil d’alerte</Text>
<Text style={styles.valueSmall}>{level}</Text>
</View>
)}
</TouchableOpacity>
);
})
)}
</View>
</ScrollView>
</View>
);
}

/* ---------------- STYLES ---------------- */
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

block: {
backgroundColor: "#161228",
padding: 18,
borderRadius: 14,
marginBottom: 18,
},

blockTitle: {
color: "#fff",
fontSize: 17,
fontWeight: "700",
marginBottom: 10,
},

blockDesc: {
color: "#C6C0DD",
fontSize: 13,
marginBottom: 16,
},

row: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 8,
},

label: {
color: "#C6C0DD",
fontSize: 13,
},

value: {
color: "#fff",
fontSize: 16,
fontWeight: "900",
},

empty: {
color: "#A8A3C2",
fontSize: 14,
},

card: {
backgroundColor: "#1E1838",
borderRadius: 12,
padding: 14,
marginBottom: 12,
},

cardRow: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 6,
gap: 10,
},

productName: {
color: "#fff",
fontWeight: "900",
fontSize: 15,
flex: 1,
},

status: {
fontWeight: "900",
fontSize: 13,
},

labelSmall: {
color: "#A8A3C2",
fontSize: 12,
},

valueSmall: {
color: "#fff",
fontSize: 13,
fontWeight: "700",
},
});
