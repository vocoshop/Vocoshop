// screens/ReportScreen.tsx
import React, {
useEffect,
useState,
useContext,
useCallback,
useMemo,
useRef,
} from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
ActivityIndicator,
Animated,
RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";
import { getReportKpis } from "../src/api/services/reportService";

import { onSyncState, getLastSyncFinished } from "../src/api/offline/syncEngine";

/* =====================================================
TYPES – ALIGNÉS BACKEND
===================================================== */
interface TodaySale {
productName: string;
quantity: number;
unitPrice: number;
totalAmount: number;
}

interface TodaySummary {
date: string;
totalSales: number;
totalRevenue: number;
sales: TodaySale[];
}

interface ReportItem {
_id: string;
date: string;
totalSales: number;
totalRevenue: number;
}

type ReportsApiResponse = {
page: number;
limit: number;
total: number;
hasMore: boolean;
reports: ReportItem[];
};

/* =====================================================
SCREEN
===================================================== */
export default function ReportScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const [today, setToday] = useState<TodaySummary | null>(null);
const [reports, setReports] = useState<ReportItem[]>([]);
const [shopValue, setShopValue] = useState<number>(0);
const [potentialProfit, setPotentialProfit] = useState<number>(0);

const [loading, setLoading] = useState(true);

// pull-to-refresh
const [refreshing, setRefreshing] = useState(false);

// pagination
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(false);
const [loadingMore, setLoadingMore] = useState(false);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId;

/* =====================================================
HELPERS
===================================================== */
const money = (v?: number) =>
`${Math.round(v ?? 0).toLocaleString("fr-FR")} FCFA`;

const formatDate = (d: string) =>
new Date(d).toLocaleDateString("fr-FR", {
day: "2-digit",
month: "2-digit",
year: "numeric",
});

/* =====================================================
SKELETON (pulse)
===================================================== */
const pulse = useRef(new Animated.Value(0.35)).current;

useEffect(() => {
if (!loading) return;

const anim = Animated.loop(
Animated.sequence([
Animated.timing(pulse, {
toValue: 0.85,
duration: 750,
useNativeDriver: true,
}),
Animated.timing(pulse, {
toValue: 0.35,
duration: 750,
useNativeDriver: true,
}),
])
);

anim.start();
return () => anim.stop();
}, [loading, pulse]);

const SkeletonBox = ({ height, style }: { height: number; style?: any }) => (
<Animated.View style={[styles.skelBox, { height, opacity: pulse }, style]} />
);

const ReportSkeleton = () => (
<View style={{ marginTop: 10 }}>
{/* valeur boutique */}
<View style={styles.shopValueCard}>
<SkeletonBox height={14} style={{ width: "70%", borderRadius: 8 }} />
<SkeletonBox
height={28}
style={{ width: "55%", borderRadius: 10, marginTop: 12 }}
/>
</View>

{/* bloc bilan du jour */}
<View style={styles.block}>
<SkeletonBox height={16} style={{ width: "72%", borderRadius: 8 }} />
<SkeletonBox
height={12}
style={{ width: "38%", borderRadius: 8, marginTop: 10 }}
/>

<View style={styles.kpiRow}>
<View style={styles.kpiCard}>
<SkeletonBox height={10} style={{ width: "55%", borderRadius: 8 }} />
<SkeletonBox
height={16}
style={{ width: "75%", borderRadius: 8, marginTop: 10 }}
/>
</View>

<View style={styles.kpiCard}>
<SkeletonBox height={10} style={{ width: "45%", borderRadius: 8 }} />
<SkeletonBox
height={16}
style={{ width: "50%", borderRadius: 8, marginTop: 10 }}
/>
</View>
</View>

<View style={styles.kpiRow}>
<View style={styles.kpiCard}>
<SkeletonBox height={10} style={{ width: "62%", borderRadius: 8 }} />
<SkeletonBox
height={16}
style={{ width: "70%", borderRadius: 8, marginTop: 10 }}
/>
</View>

<View style={styles.kpiCard}>
<SkeletonBox height={10} style={{ width: "75%", borderRadius: 8 }} />
<SkeletonBox
height={16}
style={{ width: "85%", borderRadius: 8, marginTop: 10 }}
/>
</View>
</View>
</View>

{/* derniers bilans */}
<View style={styles.block}>
<SkeletonBox height={16} style={{ width: "45%", borderRadius: 8 }} />
{[...Array(6)].map((_, i) => (
<View key={i} style={styles.reportRow}>
<View style={{ flex: 1 }}>
<SkeletonBox height={12} style={{ width: "45%", borderRadius: 8 }} />
<SkeletonBox
height={10}
style={{ width: "30%", borderRadius: 8, marginTop: 8 }}
/>
</View>
<SkeletonBox height={14} style={{ width: 90, borderRadius: 8 }} />
</View>
))}
</View>
</View>
);

/* =====================================================
LOAD DATA (page 1) — VERSION STABLE
===================================================== */
const loadData = useCallback(
async (opts?: { silent?: boolean }) => {
if (!canLoad) {
setToday(null);
setReports([]);
setShopValue(0);
setPotentialProfit(0);
setPage(1);
setHasMore(false);
setLoading(false);
return;
}

// loader uniquement si pas silent
if (!opts?.silent) setLoading(true);

try {
const [todaySalesRes, todayReportRes, reportsRes, kpis] =
await Promise.all([
API.get("/sales/today", { headers }),
API.get("/sales/reports/today", { headers }),
API.get("/sales/reports?page=1&limit=7", { headers }),
getReportKpis(headers),
]);

const todayReport =
(todayReportRes.data ?? null) as TodaySummary | null;
const todaySales =
(todaySalesRes.data ?? null) as TodaySummary | null;

setToday(todayReport ?? todaySales ?? null);

const raw = reportsRes.data as ReportsApiResponse;
const list = raw?.reports ?? [];

const sorted = [...list].sort(
(a, b) =>
new Date(b.date).getTime() - new Date(a.date).getTime()
);

setReports(sorted);
setPage(raw?.page ?? 1);
setHasMore(!!raw?.hasMore);

setShopValue(kpis?.estimatedResellValue ?? 0);
setPotentialProfit(kpis?.totalPotentialProfit ?? 0);
} catch (err: any) {
console.log(
"❌ ReportScreen load error:",
err?.response?.data || err
);

setToday(null);
setReports([]);
setShopValue(0);
setPotentialProfit(0);
setPage(1);
setHasMore(false);
} finally {
if (!opts?.silent) setLoading(false);
}
},
[canLoad, headers]
);

/* =====================================================
LOAD INITIAL + FOCUS REFRESH
===================================================== */
useEffect(() => {
loadData();
}, [loadData]);

useFocusEffect(
useCallback(() => {
loadData({ silent: true });
}, [loadData])
);

/* =====================================================
🔥 AUTO REFRESH APRÈS SYNC OFFLINE — VERSION SAFE
===================================================== */
const lastSyncRef = useRef<number>(0);

useEffect(() => {
const unsub = onSyncState(() => {
const finished = getLastSyncFinished();

if (finished && finished !== lastSyncRef.current) {
lastSyncRef.current = finished;

// refresh silencieux après sync offline
loadData({ silent: true });
}
});

return () => {
unsub();
};
}, [loadData]);

/* =====================================================
PULL TO REFRESH
===================================================== */
const onRefresh = useCallback(async () => {
if (!canLoad) return;

try {
setRefreshing(true);
await loadData({ silent: true });
} finally {
setRefreshing(false);
}
}, [canLoad, loadData]);

/* =====================================================
LOAD MORE (page + 1)
===================================================== */
const loadMore = useCallback(async () => {
if (!canLoad || loadingMore || !hasMore) return;

try {
setLoadingMore(true);

const nextPage = page + 1;

const res = await API.get(`/sales/reports?page=${nextPage}&limit=7`, {
headers,
});

const raw = res.data as ReportsApiResponse;
const nextList = raw?.reports ?? [];

const merged = [...reports, ...nextList].filter(
(item, index, arr) => arr.findIndex((x) => x._id === item._id) === index
);

const sorted = [...merged].sort(
(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

setReports(sorted);
setPage(raw?.page ?? nextPage);
setHasMore(!!raw?.hasMore);
} catch (err: any) {
console.log("❌ loadMore error:", err?.response?.data || err);
} finally {
setLoadingMore(false);
}
}, [canLoad, headers, loadingMore, hasMore, page, reports]);

/* =====================================================
KPI
===================================================== */
const totalSales = today?.totalSales ?? 0;
const totalRevenue = today?.totalRevenue ?? 0;
const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

const bestSeller = today?.sales?.length
? [...today.sales].sort((a, b) => b.quantity - a.quantity)[0]
: null;

/* =====================================================
UI
===================================================== */
return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Bilan & rapports</Text>

<TouchableOpacity onPress={() => loadData()}>
<Ionicons name="refresh" size={22} color="#A8A3C2" />
</TouchableOpacity>
</View>

<Text style={styles.subtitle}>
Vue claire de votre activité et de la valeur de votre boutique.
</Text>

{/* ✅ Skeleton + Pull-to-refresh */}
{loading && (
<ScrollView
contentContainerStyle={{ paddingBottom: 140 }}
refreshControl={
<RefreshControl
refreshing={refreshing}
onRefresh={onRefresh}
tintColor="#A8A3C2"
/>
}
>
<ReportSkeleton />
</ScrollView>
)}

{!loading && (
<ScrollView
contentContainerStyle={{ paddingBottom: 140 }}
refreshControl={
<RefreshControl
refreshing={refreshing}
onRefresh={onRefresh}
tintColor="#A8A3C2"
/>
}
>
{/* VALEUR BOUTIQUE */}
          <View style={styles.shopValueCard}>
            <Text style={styles.shopValueLabel}>Valeur estimée de votre boutique</Text>
            <Text style={styles.shopValue}>{money(shopValue)}</Text>
            <Text style={styles.shopProfit}>Bénéfice estimé : {money(potentialProfit)}</Text>
          </View>

{/* BILAN DU JOUR */}
<View style={styles.block}>
<Text style={styles.blockTitle}>
{today ? "Bilan du jour (clôturé ou en cours)" : "Aucune donnée aujourd’hui"}
</Text>

<Text style={styles.blockDate}>{today?.date ? formatDate(today.date) : "—"}</Text>

<View style={styles.kpiRow}>
<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>CA du jour</Text>
<Text style={styles.kpiValue}>{money(totalRevenue)}</Text>
</View>

<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>Ventes</Text>
<Text style={styles.kpiValue}>{totalSales}</Text>
</View>
</View>

<View style={styles.kpiRow}>
<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>Ticket moyen</Text>
<Text style={styles.kpiValue}>{money(avgTicket)}</Text>
</View>

<View style={styles.kpiCard}>
<Text style={styles.kpiLabel}>Produit le plus vendu</Text>
<Text style={styles.bestSeller}>
{bestSeller ? `${bestSeller.productName} (${bestSeller.quantity})` : "—"}
</Text>
</View>
</View>
</View>

{/* HISTORIQUE */}
<View style={styles.block}>
<Text style={styles.blockTitle}>Derniers bilans</Text>

{reports.length === 0 && (
<Text style={styles.emptyText}>Aucun bilan enregistré.</Text>
)}

{reports.map((r) => (
<TouchableOpacity
key={r._id}
style={styles.reportRow}
activeOpacity={0.85}
onPress={() => navigation.navigate("ReportDetail", { reportId: r._id })}
>
<View>
<Text style={styles.reportDate}>{formatDate(r.date)}</Text>
<Text style={styles.reportSales}>
{r.totalSales} vente{r.totalSales > 1 ? "s" : ""}
</Text>
</View>

<Text style={styles.reportAmount}>{money(r.totalRevenue)}</Text>
</TouchableOpacity>
))}

        {/* ✅ Ligne grise "Voir plus" (uniquement si hasMore) */}
        {hasMore && (
          <TouchableOpacity
            style={styles.showMoreWrap}
            activeOpacity={0.7}
            onPress={loadMore}
            disabled={loadingMore}
          >
            <View style={styles.showMoreLine} />
            <Text style={styles.showMoreText}>
              {loadingMore ? "Chargement..." : "Voir plus de dates"}
            </Text>
            <View style={styles.showMoreLine} />
          </TouchableOpacity>
        )}
</View>
</ScrollView>
)}
</View>
);
}

/* =====================================================
STYLES
===================================================== */
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
justifyContent: "space-between",
marginBottom: 6,
},
title: {
color: "#fff",
fontSize: 22,
fontWeight: "900",
},
subtitle: {
color: "#A8A3C2",
fontSize: 13,
marginBottom: 18,
},
shopValueCard: {
backgroundColor: "#1E1838",
padding: 20,
borderRadius: 16,
marginBottom: 18,
alignItems: "center",
},
shopValueLabel: {
color: "#C6C0DD",
fontSize: 13,
marginBottom: 6,
},
shopValue: {
color: "#FACC15",
fontSize: 24,
fontWeight: "900",
},
shopProfit: {
color: "#7A7393",
fontSize: 11,
marginTop: 6,
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
},
blockDate: {
color: "#C6C0DD",
fontSize: 13,
marginBottom: 12,
},
kpiRow: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 10,
},
kpiCard: {
width: "48%",
backgroundColor: "#1E1838",
padding: 12,
borderRadius: 12,
},
kpiLabel: {
color: "#C6C0DD",
fontSize: 11,
marginBottom: 4,
},
kpiValue: {
color: "#fff",
fontSize: 16,
fontWeight: "800",
},
bestSeller: {
color: "#FACC15",
fontSize: 13,
fontWeight: "700",
},
reportRow: {
backgroundColor: "#1E1838",
padding: 14,
borderRadius: 10,
marginTop: 10,
flexDirection: "row",
justifyContent: "space-between",
},
reportDate: {
color: "#fff",
fontWeight: "700",
fontSize: 14,
},
reportSales: {
color: "#9CA3AF",
fontSize: 12,
marginTop: 2,
},
reportAmount: {
color: "#FACC15",
fontWeight: "800",
fontSize: 14,
},
emptyText: {
color: "#9CA3AF",
fontSize: 13,
marginTop: 6,
},

// ✅ discret “Afficher plus”
  showMoreWrap: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 12,
  },
  showMoreLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2D2547",
  },
  showMoreText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
},

// ✅ Skeleton pieces
skelBox: {
backgroundColor: "#241D42",
},
});
