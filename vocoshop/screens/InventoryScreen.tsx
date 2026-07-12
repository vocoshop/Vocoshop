// screens/InventoryScreen.tsx
import React, {
useState,
useEffect,
useContext,
useRef,
useCallback,
useMemo,
} from "react";
import {
Modal,
Alert,
View,
Text,
StyleSheet,
TouchableOpacity,
FlatList,
ActivityIndicator,
TextInput,
Animated,
RefreshControl,
Pressable,
ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRoute, useFocusEffect, useNavigation } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

/* --------------------------
TYPES
--------------------------- */
type Product = {
_id: string;
name: string;
category: string;
price: number;
quantity: number;
alertLevel: number;
};

type StartInventorySessionResponse = {
sessionId: string;
status?: string;
};

type InventorySessionResponse = {
_id: string;
status: "draft" | "validated" | "applied";
lines?: {
productId: any;
countedQuantity: number;
productName?: string;
category?: string;
}[];
};

export default function InventoryScreen({ navigation }: any) {
const route = useRoute<any>();

const {
token,
storeId,

setInventoryActive,
inventoryCount,
setInventoryCount,

inventorySessionId,
setInventorySessionId,
} = useContext(AuthContext);

const [products, setProducts] = useState<Product[]>([]);
const [search, setSearch] = useState("");
const [loading, setLoading] = useState(false);
const [refreshing, setRefreshing] = useState(false);

const [showResumeModal, setShowResumeModal] = useState(false);
const [historySessions, setHistorySessions] = useState<any[]>([]);

// Anti spam modal (ne pas re-pop le même modal)
const lastModalSessionRef = useRef<string | null>(null);

// Anti-race : empêche un refresh tardif de remettre inventoryCount après reset
const refreshSeqRef = useRef(0);

// Ref “source de vérité immédiate” du sessionId (évite state async)
const sessionIdRef = useRef<string | null>(inventorySessionId ?? null);
useEffect(() => {
sessionIdRef.current = inventorySessionId ?? null;
}, [inventorySessionId]);

// ✅ FIX POPUP: bloque UNE SEULE FOIS le popup après retour de comptage
const skipNextResumeModalRef = useRef(false);

// Fade animation
const fadeAnim = useRef(new Animated.Value(0)).current;

const canCallApi = useMemo(() => Boolean(token && storeId), [token, storeId]);

const startFade = () => {
fadeAnim.setValue(0);
Animated.timing(fadeAnim, {
toValue: 1,
duration: 260,
useNativeDriver: true,
}).start();
};

/* ---------------------------------------------------------
Helpers
---------------------------------------------------------- */
const safeHeaders = useCallback(() => {
return {
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId ? String(storeId) : "",
};
}, [token, storeId]);

const showApiError = (title: string, err: any) => {
console.log("❌", title, err?.response?.status, err?.response?.data || err);
const msg =
err?.response?.data?.error ||
err?.response?.data?.message ||
"Une erreur est survenue. Réessaie.";
Alert.alert(title, msg);
};

/* ---------------------------------------------------------
0) Ensure sessionId (ref -> state -> AsyncStorage)
---------------------------------------------------------- */
const ensureSessionId = useCallback(async (): Promise<string | null> => {
// 0) ref (instantané)
if (sessionIdRef.current) return sessionIdRef.current;

// 1) state
if (inventorySessionId) return inventorySessionId;

// 2) storage
try {
const sid = await AsyncStorage.getItem("inventorySessionId");
if (sid && sid.trim()) {
const clean = sid.trim();
sessionIdRef.current = clean;
setInventorySessionId(clean);
return clean;
}
} catch {}

return null;
}, [inventorySessionId, setInventorySessionId]);

/* ---------------------------------------------------------
1) Start session (EMPLOYÉ)
(Ici tu peux le garder si un jour tu veux démarrer une session depuis Inventory)
---------------------------------------------------------- */
const startSession = useCallback(async (): Promise<string | null> => {
const existing = await ensureSessionId();
if (existing) return existing;

if (!token || !storeId) return null;

try {
const response = await API.post(
"/inventory/session/start",
{},
{ headers: safeHeaders() }
);

const data = response.data as StartInventorySessionResponse;
const sid = data?.sessionId;

if (!sid) return null;

sessionIdRef.current = sid;
setInventorySessionId(sid);
await AsyncStorage.setItem("inventorySessionId", sid);

return sid;
} catch (err: any) {
showApiError("Erreur", err);
return null;
}
}, [ensureSessionId, token, storeId, safeHeaders, setInventorySessionId]);

/* ---------------------------------------------------------
2) Load products
---------------------------------------------------------- */
const loadProducts = useCallback(
async (opts?: { silent?: boolean }) => {
if (!token || !storeId) return;
if (!opts?.silent) setLoading(true);

try {
const res = await API.get("/products", {
headers: safeHeaders(),
params: { search: search?.trim() || "" },
});

const data: any = res.data || {};
const list: Product[] = Array.isArray(data?.products)
? data.products
: Array.isArray(data?.data)
? data.data
: Array.isArray(data)
? data
: [];

setProducts(list);
startFade();

await AsyncStorage.setItem(`products_cache_${storeId}`, JSON.stringify(list));
} catch (err: any) {
// fallback cache si offline / erreur
const cached = await AsyncStorage.getItem(`products_cache_${storeId}`);
if (cached) {
const list: Product[] = JSON.parse(cached);
setProducts(list);
startFade();
}
showApiError("Produits", err);
} finally {
if (!opts?.silent) setLoading(false);
}
},
[token, storeId, safeHeaders, search]
);

const onRefresh = useCallback(async () => {
setRefreshing(true);
await loadProducts({ silent: true });
setRefreshing(false);
}, [loadProducts]);

/* ---------------------------------------------------------
3) Refresh session state (SOURCE DE VÉRITÉ = BACKEND)
---------------------------------------------------------- */
const refreshSessionState = useCallback(
async (opts?: { silent?: boolean; openModal?: boolean }) => {
const seq = ++refreshSeqRef.current;

if (!token || !storeId) {
if (seq !== refreshSeqRef.current) return;
setInventoryCount(0);
setInventoryActive(false);
return;
}

const sid = await ensureSessionId();
if (!sid) {
if (seq !== refreshSeqRef.current) return;
setInventoryCount(0);
setInventoryActive(false);
return;
}

try {
const sessionRes = await API.get<InventorySessionResponse>(
`/inventory/session/${sid}`,
{ headers: safeHeaders() }
);

if (seq !== refreshSeqRef.current) return;

const lines = Array.isArray(sessionRes.data?.lines)
? sessionRes.data.lines
: [];

const count = lines.length;

setInventoryCount(count);
const active = count > 0;
setInventoryActive(active);

// ✅ popup uniquement si:
// - openModal activé
// - session active
// - pas en "skip" (retour de comptage)
// - pas déjà affiché pour ce sid
const shouldOpenModal =
(opts?.openModal ?? true) &&
active &&
!skipNextResumeModalRef.current &&
lastModalSessionRef.current !== sid;

// consume skip (une seule fois)
if (skipNextResumeModalRef.current) {
skipNextResumeModalRef.current = false;
}

if (!opts?.silent && shouldOpenModal) {
lastModalSessionRef.current = sid;
setShowResumeModal(true);
}
} catch (err: any) {
console.log(
"⚠️ refreshSessionState error:",
err?.response?.status,
err?.response?.data || err
);
}
},
[
token,
storeId,
ensureSessionId,
safeHeaders,
setInventoryCount,
setInventoryActive,
]
);

/* ---------------------------------------------------------
4) Terminer inventaire (validate) + reset local
---------------------------------------------------------- */
const finishInventory = useCallback(async () => {
if (!token || !storeId) {
Alert.alert("Info", "Session non prête. Réessaie.");
return;
}

const sid = await ensureSessionId();
if (!sid) {
Alert.alert("Info", "Aucune session d’inventaire en cours.");
return;
}

if (inventoryCount <= 0) {
Alert.alert("Info", "Tu dois compter au moins 1 produit avant de terminer.");
return;
}

Alert.alert(
"Terminer l’inventaire",
"Souhaites-tu terminer l’inventaire et enregistrer les produits comptés ?",
[
{ text: "Annuler", style: "cancel" },
{
text: "Terminer",
style: "default",
onPress: async () => {
try {
await API.post(
`/inventory/session/${sid}/validate`,
{},
{ headers: safeHeaders() }
);

// history locale optionnelle
const sessionRes = await API.get(`/inventory/session/${sid}`, {
headers: safeHeaders(),
});

const session = sessionRes.data as { lines?: any[] };
const lines = Array.isArray(session?.lines) ? session.lines : [];

const key = `inventory_history_${storeId}`;
const raw = await AsyncStorage.getItem(key);
const list = raw ? JSON.parse(raw) : [];

list.unshift({
id: Date.now().toString(),
date: new Date().toISOString(),
count: lines.length,
products: lines.map((l: any) => ({
id: l.productId?._id || l.productId,
name: l.productName || l.productId?.name,
category: l.category || l.productId?.category,
quantity: l.countedQuantity,
price: l.productId?.price,
})),
});

await AsyncStorage.setItem(key, JSON.stringify(list));

// ✅ reset dur
refreshSeqRef.current++;
sessionIdRef.current = null;

setInventoryActive(false);
setInventoryCount(0);
setInventorySessionId(null);
await AsyncStorage.removeItem("inventorySessionId");

lastModalSessionRef.current = null;
setShowResumeModal(false);

Alert.alert("Succès", "Inventaire enregistré !");
navigation.navigate("History", { storeId });
} catch (err: any) {
showApiError("Inventaire", err);
}
},
},
]
);
}, [
token,
storeId,
ensureSessionId,
inventoryCount,
safeHeaders,
navigation,
setInventoryActive,
setInventoryCount,
setInventorySessionId,
]);

/* ---------------------------------------------------------
✅ Annuler session (backend discard + reset local immédiat)
---------------------------------------------------------- */
const cancelSession = useCallback(
async (sid: string | null) => {
// ferme le modal tout de suite
setShowResumeModal(false);

// 1) discard backend (si route existe)
if (sid) {
try {
await API.post(
`/inventory/session/${sid}/discard`,
{},
{ headers: safeHeaders() }
);
} catch (e) {
console.log("⚠️ discard failed:", (e as any)?.response?.data || e);
}
}

// 2) reset local
refreshSeqRef.current++;
sessionIdRef.current = null;

setInventoryActive(false);
setInventoryCount(0);
setInventorySessionId(null);
await AsyncStorage.removeItem("inventorySessionId");

lastModalSessionRef.current = null;

// 3) resync soft (UI)
refreshSessionState({ silent: true, openModal: false });
},
[
safeHeaders,
refreshSessionState,
setInventoryActive,
setInventoryCount,
setInventorySessionId,
]
);

/* ---------------------------------------------------------
Auto-load
---------------------------------------------------------- */
useEffect(() => {
if (!canCallApi) return;
loadProducts();
}, [canCallApi, loadProducts, route.params?.refresh]);

// ✅ À chaque retour sur l'écran Inventory:
// - si on revient d'un comptage => skip popup une fois
// - sinon => popup si session active
useFocusEffect(
useCallback(() => {
if (!canCallApi) return;

const now = Date.now();
const countedAt = Number(route?.params?.countedAt || 0);

const isReturningFromCount =
route?.params?.justCounted === true ||
(countedAt > 0 && now - countedAt < 5000);

if (isReturningFromCount) {
skipNextResumeModalRef.current = true;
}

// consommer params immédiatement
if (route?.params?.justCounted || route?.params?.countedAt) {
navigation.setParams({ justCounted: false, countedAt: 0 });
}

refreshSessionState({
silent: false,
openModal: true, // ✅ le blocage popup se fait via skipNextResumeModalRef
});

return () => {};
}, [
canCallApi,
route?.params?.justCounted,
route?.params?.countedAt,
navigation,
refreshSessionState,
])
);

// Charger historique inventaire
const loadHistory = useCallback(async () => {
  if (!token || !storeId) return;
  try {
    const res = await API.get("/inventory/sessions", { params: { storeId, limit: 20 } });
    setHistorySessions(res.data?.sessions ?? res.data ?? []);
  } catch { setHistorySessions([]); }
}, [token, storeId]);

useEffect(() => { loadHistory(); }, [loadHistory]);

useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

/* ---------------------------------------------------------
UI guards
---------------------------------------------------------- */
if (!token || !storeId) {
return (
<View
style={[
styles.container,
{ justifyContent: "center", alignItems: "center" },
]}
>
<ActivityIndicator color="#A78BFA" />
<Text style={{ color: "#A8A3C2", marginTop: 12 }}>
Chargement de la boutique...
</Text>
</View>
);
}

const [historyTab, setHistoryTab] = useState(false);
const showTopBar = inventoryCount > 0 || Boolean(sessionIdRef.current);

return (
    <View style={styles.container}>

      {/* ===== HEADER ===== */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.header}>Inventaire</Text>
          <Text style={styles.subHeader}>Comptez et gérez votre stock</Text>
        </View>

        {showTopBar && (
          <View style={styles.sessionBadge}>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionBadgeText}>{inventoryCount}</Text>
          </View>
        )}
      </View>

      {/* ===== SEARCH BAR ===== */}
      {!historyTab && (
      <View style={styles.searchBar}>
<View style={styles.searchIconWrap}>
  <Ionicons name="search-outline" size={18} color="#888" />
</View>
<TextInput
  style={styles.searchInput}
  placeholder="Rechercher un produit..."
  placeholderTextColor="#666"
  value={search}
  onChangeText={setSearch}
/>
{search.length > 0 && (
  <TouchableOpacity onPress={() => setSearch("")} style={styles.clearBtn}>
    <Ionicons name="close-circle" size={18} color="#666" />
  </TouchableOpacity>
)}
</View>
      )}

      {/* ===== TAB INVENTAIRE / HISTORIQUE ===== */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, !historyTab && styles.tabActive]}
          onPress={() => setHistoryTab(false)}
          activeOpacity={0.8}
        >
          <Ionicons name="cube-outline" size={16} color={!historyTab ? "#fff" : "#666"} />
          <Text style={[styles.tabText, !historyTab && styles.tabTextActive]}>Inventaire</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, historyTab && styles.tabActive]}
          onPress={() => setHistoryTab(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="time-outline" size={16} color={historyTab ? "#fff" : "#666"} />
          <Text style={[styles.tabText, historyTab && styles.tabTextActive]}>Historique</Text>
        </TouchableOpacity>
      </View>

      {historyTab ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
          {historySessions.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={32} color="#444" />
              </View>
              <Text style={styles.emptyTitle}>Aucun historique</Text>
              <Text style={styles.emptyDesc}>Les inventaires validés apparaîtront ici</Text>
            </View>
          ) : (
            historySessions.map((s: any, i: number) => (
              <TouchableOpacity
                key={i}
                style={styles.historyCard}
                onPress={() => navigation.navigate("InventorySessionDetail", { sessionId: s._id })}
                activeOpacity={0.85}
              >
                <View style={styles.historyCardLeft}>
                  <View style={styles.historyIcon}>
                    <Ionicons name="calendar-outline" size={18} color="#A78BFA" />
                  </View>
                  <View>
                    <Text style={styles.historyDate}>{new Date(s.createdAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</Text>
                    <Text style={styles.historyCount}>{s.lines?.length ?? s.productCount ?? 0} produit(s) compté(s)</Text>
                  </View>
                </View>
                <View style={styles.historyArrow}>
                  <Ionicons name="chevron-forward" size={18} color="#555" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
<>

{/* ===== SESSION ACTIVE BAR ===== */}
{showTopBar && (
<View style={styles.sessionCard}>
  <View style={styles.sessionCardLeft}>
    <View style={styles.sessionIcon}>
      <Ionicons name="clipboard-outline" size={20} color="#A78BFA" />
    </View>
    <View>
      <Text style={styles.sessionTitle}>Session en cours</Text>
      <Text style={styles.sessionCount}>{inventoryCount} produit{inventoryCount > 1 ? "s" : ""} compté{inventoryCount > 1 ? "s" : ""}</Text>
    </View>
  </View>
  <TouchableOpacity
    style={styles.finishBtn}
    onPress={finishInventory}
    activeOpacity={0.85}
  >
    <Ionicons name="checkmark-circle" size={18} color="#fff" />
    <Text style={styles.finishText}>Terminer</Text>
  </TouchableOpacity>
</View>
)}

{/* ===== LOADING ===== */}
{loading && (
<View style={styles.loadingWrap}>
  <ActivityIndicator color="#A78BFA" size="small" />
  <Text style={styles.loadingText}>Chargement...</Text>
</View>
)}

{/* ===== PRODUCTS LIST ===== */}
<Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
<FlatList
data={products}
keyExtractor={(item) => item._id}
contentContainerStyle={{ paddingBottom: 180, paddingTop: 4 }}
windowSize={5}
initialNumToRender={10}
maxToRenderPerBatch={10}
removeClippedSubviews={true}
refreshControl={
  <RefreshControl
    refreshing={refreshing}
    onRefresh={onRefresh}
    tintColor="#A78BFA"
    colors={["#A78BFA"]}
    progressBackgroundColor="#1A152A"
  />
}
renderItem={({ item }) => (
  <TouchableOpacity
    style={styles.productCard}
    activeOpacity={0.7}
    onPress={() => {
      navigation.navigate("AddProduct", {
        product: item,
        fromInventory: true,
      });
    }}
  >
    <View style={styles.productIconWrap}>
      <Ionicons name="cube-outline" size={24} color="#A78BFA" />
    </View>

    <View style={styles.productInfo}>
      <Text style={styles.productName}>{item.name}</Text>
      <View style={styles.productMetaRow}>
        {item.category ? (
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        ) : null}
      </View>
    </View>
  </TouchableOpacity>
)}
ListEmptyComponent={
  !loading ? (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="cube-outline" size={32} color="#444" />
      </View>
      <Text style={styles.emptyTitle}>Aucun produit</Text>
      <Text style={styles.emptyDesc}>Ajoutez des produits pour commencer l'inventaire</Text>
    </View>
  ) : null
}
/>
</Animated.View>

</>
      )}

      {/* ===== MODAL REPRENDRE SESSION ===== */}
<Modal
visible={showResumeModal}
transparent
animationType="fade"
statusBarTranslucent
onRequestClose={() => setShowResumeModal(false)}
>
<Pressable style={styles.modalOverlay} onPress={() => setShowResumeModal(false)} />

<View style={styles.modalSheet}>
  <View style={styles.modalHandle} />

  <View style={styles.modalIconBig}>
    <Ionicons name="clipboard-outline" size={28} color="#A78BFA" />
  </View>

  <Text style={styles.modalTitle}>Session en cours</Text>
  <Text style={styles.modalDesc}>
    Tu as déjà compté <Text style={{ color: "#fff", fontWeight: "700" }}>{inventoryCount} produit{inventoryCount > 1 ? "s" : ""}</Text>. Tu veux reprendre ou annuler ?
  </Text>

  <View style={styles.modalStats}>
    <View style={styles.modalStatItem}>
      <Text style={styles.modalStatValue}>{inventoryCount}</Text>
      <Text style={styles.modalStatLabel}>Produits comptés</Text>
    </View>
    <View style={styles.modalStatDivider} />
    <View style={styles.modalStatItem}>
      <Text style={styles.modalStatValue}>{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>
      <Text style={styles.modalStatLabel}>Dernière activité</Text>
    </View>
  </View>

  <TouchableOpacity
    style={styles.modalBtnPrimary}
    activeOpacity={0.9}
    onPress={() => setShowResumeModal(false)}
  >
    <Ionicons name="play" size={18} color="#fff" />
    <Text style={styles.modalBtnText}>Continuer l'inventaire</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.modalBtnSecondary}
    activeOpacity={0.8}
    onPress={async () => {
      const sid = await ensureSessionId();
      Alert.alert(
        "Annuler la session",
        "Tous les comptages en cours seront supprimés.",
        [
          { text: "Non", style: "cancel" },
          {
            text: "Oui, annuler",
            style: "destructive",
            onPress: async () => { await cancelSession(sid); },
          },
        ]
      );
    }}
  >
    <Ionicons name="close-outline" size={18} color="#FF6B6B" />
    <Text style={styles.modalBtnSecondaryText}>Annuler la session</Text>
  </TouchableOpacity>
</View>
</Modal>
    </View>
  );
}

/* --------------------------
STYLES
--------------------------- */
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
paddingTop: 60,
paddingHorizontal: 20,
},

/* Header */
headerRow: {
flexDirection: "row",
alignItems: "center",
marginBottom: 8,
},
backBtn: {
width: 40,
height: 40,
borderRadius: 20,
backgroundColor: "rgba(255,255,255,0.07)",
alignItems: "center",
justifyContent: "center",
marginRight: 14,
},
header: {
color: "#fff",
fontSize: 26,
fontWeight: "800",
letterSpacing: -0.5,
},
subHeader: {
color: "#7A6F9E",
fontSize: 13,
marginTop: 2,
},
sessionBadge: {
flexDirection: "row",
alignItems: "center",
backgroundColor: "rgba(167,139,250,0.15)",
paddingHorizontal: 10,
paddingVertical: 6,
borderRadius: 20,
gap: 6,
},
sessionDot: {
width: 8,
height: 8,
borderRadius: 4,
backgroundColor: "#22C55E",
},
sessionBadgeText: {
color: "#A78BFA",
fontSize: 14,
fontWeight: "700",
},

/* Search */
searchBar: {
marginTop: 14,
flexDirection: "row",
alignItems: "center",
backgroundColor: "#1A152A",
paddingHorizontal: 14,
paddingVertical: 10,
borderRadius: 14,
marginBottom: 10,
},
searchIconWrap: {
width: 28,
height: 28,
alignItems: "center",
justifyContent: "center",
},
searchInput: {
color: "#fff",
flex: 1,
marginLeft: 8,
fontSize: 15,
},
clearBtn: {
padding: 4,
},

/* Tabs */
tabRow: {
flexDirection: "row",
backgroundColor: "#1A152A",
borderRadius: 12,
padding: 3,
marginBottom: 12,
},
tabBtn: {
flex: 1,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
paddingVertical: 9,
gap: 6,
borderRadius: 10,
},
tabActive: {
backgroundColor: "#6C63FF",
},
tabText: {
color: "#666",
fontSize: 13,
fontWeight: "600",
},
tabTextActive: {
color: "#fff",
fontWeight: "700",
},

/* Session active card */
sessionCard: {
backgroundColor: "#161228",
borderRadius: 16,
padding: 16,
marginBottom: 12,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
borderWidth: 1,
borderColor: "rgba(167,139,250,0.12)",
},
sessionCardLeft: {
flexDirection: "row",
alignItems: "center",
gap: 12,
flex: 1,
},
sessionIcon: {
width: 42,
height: 42,
borderRadius: 12,
backgroundColor: "rgba(167,139,250,0.12)",
alignItems: "center",
justifyContent: "center",
},
sessionTitle: {
color: "#fff",
fontSize: 15,
fontWeight: "700",
},
sessionCount: {
color: "#7A6F9E",
fontSize: 12,
marginTop: 2,
},
finishBtn: {
backgroundColor: "#6C63FF",
paddingVertical: 10,
paddingHorizontal: 14,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
gap: 6,
},
finishText: {
color: "#fff",
fontWeight: "800",
fontSize: 14,
},

/* Loading */
loadingWrap: {
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 8,
paddingVertical: 12,
},
loadingText: {
color: "#666",
fontSize: 13,
},

/* Product card */
productCard: {
backgroundColor: "#161228",
padding: 14,
borderRadius: 16,
flexDirection: "row",
alignItems: "center",
marginTop: 10,
},
productIconWrap: {
width: 44,
height: 44,
borderRadius: 12,
backgroundColor: "rgba(167,139,250,0.10)",
alignItems: "center",
justifyContent: "center",
marginRight: 14,
},
productInfo: {
flex: 1,
},
productName: {
color: "#fff",
fontSize: 15,
fontWeight: "700",
},
productMetaRow: {
flexDirection: "row",
alignItems: "center",
gap: 8,
marginTop: 4,
},
categoryPill: {
backgroundColor: "rgba(167,139,250,0.12)",
paddingHorizontal: 8,
paddingVertical: 2,
borderRadius: 6,
},
categoryText: {
color: "#A78BFA",
fontSize: 11,
fontWeight: "600",
},

/* Empty state */
emptyWrap: {
alignItems: "center",
marginTop: 60,
},
emptyIcon: {
width: 64,
height: 64,
borderRadius: 32,
backgroundColor: "rgba(255,255,255,0.04)",
alignItems: "center",
justifyContent: "center",
marginBottom: 16,
},
emptyTitle: {
color: "#fff",
fontSize: 17,
fontWeight: "700",
},
emptyDesc: {
color: "#666",
fontSize: 13,
marginTop: 6,
textAlign: "center",
},

/* History */
historyCard: {
backgroundColor: "#161228",
padding: 16,
borderRadius: 16,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginBottom: 10,
},
historyCardLeft: {
flexDirection: "row",
alignItems: "center",
gap: 12,
},
historyIcon: {
width: 40,
height: 40,
borderRadius: 12,
backgroundColor: "rgba(167,139,250,0.10)",
alignItems: "center",
justifyContent: "center",
},
historyDate: {
color: "#fff",
fontSize: 14,
fontWeight: "600",
},
historyCount: {
color: "#666",
fontSize: 12,
marginTop: 2,
},
historyArrow: {
width: 28,
height: 28,
borderRadius: 14,
backgroundColor: "rgba(255,255,255,0.04)",
alignItems: "center",
justifyContent: "center",
},

/* Modal */
modalOverlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.6)",
},
modalSheet: {
position: "absolute",
bottom: 0,
left: 0,
right: 0,
backgroundColor: "#141027",
borderTopLeftRadius: 24,
borderTopRightRadius: 24,
paddingHorizontal: 24,
paddingBottom: 40,
paddingTop: 12,
alignItems: "center",
},
modalHandle: {
width: 40,
height: 4,
borderRadius: 2,
backgroundColor: "rgba(255,255,255,0.10)",
marginBottom: 20,
},
modalIconBig: {
width: 56,
height: 56,
borderRadius: 16,
backgroundColor: "rgba(167,139,250,0.12)",
alignItems: "center",
justifyContent: "center",
marginBottom: 16,
},
modalTitle: {
color: "#fff",
fontSize: 20,
fontWeight: "800",
},
modalDesc: {
color: "#7A6F9E",
fontSize: 14,
textAlign: "center",
marginTop: 8,
lineHeight: 20,
paddingHorizontal: 10,
},
modalStats: {
flexDirection: "row",
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.04)",
borderRadius: 14,
paddingVertical: 14,
paddingHorizontal: 24,
marginTop: 20,
marginBottom: 24,
width: "100%",
},
modalStatItem: {
flex: 1,
alignItems: "center",
},
modalStatValue: {
color: "#fff",
fontSize: 20,
fontWeight: "800",
},
modalStatLabel: {
color: "#666",
fontSize: 11,
marginTop: 4,
},
modalStatDivider: {
width: 1,
height: 32,
backgroundColor: "rgba(255,255,255,0.06)",
},
modalBtnPrimary: {
backgroundColor: "#6C63FF",
paddingVertical: 16,
borderRadius: 14,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 8,
width: "100%",
marginBottom: 10,
},
modalBtnText: {
color: "#fff",
fontSize: 16,
fontWeight: "800",
},
modalBtnSecondary: {
paddingVertical: 12,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 6,
},
modalBtnSecondaryText: {
color: "#FF6B6B",
fontSize: 14,
fontWeight: "600",
},
});
