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
} catch (err: any) {
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

const showTopBar = inventoryCount > 0;

return (
    <View style={styles.container}>

      {/* ===== HEADER ===== */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventaire</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* ===== SEARCH BAR ===== */}
      <View style={styles.searchBar}>
<Ionicons name="search-outline" size={20} color="#AAA" />
<TextInput
style={styles.searchInput}
placeholder="Rechercher un produit..."
placeholderTextColor="#777"
value={search}
onChangeText={setSearch}
/>
</View>

      {/* ===== HISTORIQUE (LIGNE HORIZONTALE) ===== */}
      {historySessions.length > 0 && (
        <View style={styles.historyRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {historySessions.slice(0, 10).map((s: any, i: number) => (
              <TouchableOpacity
                key={i}
                style={styles.historyChip}
                onPress={() => navigation.navigate("AppliedInventoryDetail", { sessionId: s._id })}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={14} color="#A78BFA" />
                <Text style={styles.historyChipText}>
                  {new Date(s.appliedAt || s.createdAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ===== TOP ACTION BAR ===== */}
{showTopBar && (
<View style={styles.topActionRow}>
<View>
<Text style={styles.topActionTitle}>Inventaire actif</Text>
<Text style={styles.topActionSub}>
{inventoryCount} produit(s) compté(s)
</Text>
</View>

<TouchableOpacity
style={styles.finishBtn}
onPress={finishInventory}
activeOpacity={0.85}
>
<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
<Text style={styles.finishText}>Terminer</Text>
</TouchableOpacity>
</View>
)}

{loading && (
<ActivityIndicator color="#8A4DFF" style={{ marginTop: 10 }} />
)}

{/* ===== LIST ===== */}
<Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
<FlatList
data={products}
keyExtractor={(item) => item._id}
contentContainerStyle={{ paddingBottom: 180 }}
windowSize={5}
initialNumToRender={10}
maxToRenderPerBatch={10}
removeClippedSubviews={true}
refreshControl={
<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
}
renderItem={({ item }) => (
<TouchableOpacity
style={styles.productCard}
activeOpacity={0.85}
onPress={() => {
navigation.navigate("AddProduct", {
product: item,
fromInventory: true,
});
}}
>
<View style={styles.iconBox}>
<Ionicons name="cube-outline" size={26} color="#A78BFA" />
</View>

<View style={{ flex: 1 }}>
<Text style={styles.productName}>{item.name}</Text>
<Text style={styles.productMeta}>{item.category || "—"}</Text>
</View>

<View style={styles.itemRight}>
<Text style={styles.productPrice}>
{typeof item.price === "number" ? item.price : 0} FCFA
</Text>
</View>
</TouchableOpacity>
)}
ListEmptyComponent={
!loading ? (
<View style={{ marginTop: 30, alignItems: "center" }}>
<Text style={{ color: "#A8A3C2" }}>Aucun produit trouvé.</Text>
</View>
) : null
}
/>
</Animated.View>

{/* ===== MODAL REPRENDRE SESSION ===== */}
<Modal
visible={showResumeModal}
transparent
animationType="fade"
onRequestClose={() => setShowResumeModal(false)}
>
<Pressable
style={styles.modalOverlay}
onPress={() => setShowResumeModal(false)}
/>

<View style={styles.modalCenter}>
<View style={styles.modalBox}>
<View style={styles.modalHeader}>
<View style={styles.modalIcon}>
<Ionicons name="clipboard-outline" size={22} color="#A78BFA" />
</View>

<View style={{ flex: 1 }}>
<Text style={styles.modalTitle}>Session en cours</Text>
<Text style={styles.modalText}>
Tu as déjà compté {inventoryCount} produit(s). Tu veux continuer ?
</Text>
</View>

<TouchableOpacity
style={styles.modalCloseBtn}
onPress={() => setShowResumeModal(false)}
activeOpacity={0.8}
>
<Ionicons name="close" size={18} color="#E5E7EB" />
</TouchableOpacity>
</View>

<View style={styles.modalActionsRow}>
<TouchableOpacity
style={[styles.modalBtn, styles.modalBtnPrimary]}
activeOpacity={0.9}
onPress={() => setShowResumeModal(false)}
>
<Ionicons name="play-outline" size={18} color="#fff" />
<Text style={styles.modalBtnText}>Continuer</Text>
</TouchableOpacity>

<TouchableOpacity
style={[styles.modalBtn, styles.modalBtnDanger]}
activeOpacity={0.9}
onPress={async () => {
const sid = await ensureSessionId();
Alert.alert(
"Annuler la session",
"Tu es sûr de vouloir annuler ? Les comptages en cours seront supprimés.",
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
<Ionicons name="close-circle-outline" size={18} color="#fff" />
<Text style={styles.modalBtnText}>Annuler</Text>
</TouchableOpacity>
</View>
</View>
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
paddingTop: 20,
paddingHorizontal: 20,
},

modalOverlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.55)",
},
modalCenter: {
position: "absolute",
left: 20,
right: 20,
top: "35%",
},
modalBox: {
backgroundColor: "#141027",
padding: 18,
width: "100%",
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
modalHeader: {
flexDirection: "row",
alignItems: "center",
gap: 12,
marginBottom: 14,
},
modalIcon: {
width: 44,
height: 44,
borderRadius: 14,
backgroundColor: "rgba(167,139,250,0.18)",
alignItems: "center",
justifyContent: "center",
},
modalTitle: {
color: "#fff",
fontSize: 18,
fontWeight: "900",
},
modalText: {
color: "#B9B3D1",
fontSize: 13,
marginTop: 4,
},
modalCloseBtn: {
width: 36,
height: 36,
borderRadius: 12,
alignItems: "center",
justifyContent: "center",
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},

modalActionsRow: {
flexDirection: "row",
gap: 10,
marginTop: 6,
},
modalBtn: {
flex: 1,
paddingVertical: 12,
borderRadius: 14,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 8,
},
modalBtnPrimary: {
backgroundColor: "#6C63FF",
},
modalBtnDanger: {
backgroundColor: "#FF5B5B",
},
modalBtnText: {
color: "#fff",
fontWeight: "900",
},

searchBar: {
marginTop: 60,
flexDirection: "row",
alignItems: "center",
backgroundColor: "#1A152A",
paddingHorizontal: 15,
paddingVertical: 12,
borderRadius: 16,
marginBottom: 12,
},
searchInput: {
color: "#fff",
flex: 1,
marginLeft: 10,
},

topActionRow: {
backgroundColor: "#161228",
borderRadius: 16,
padding: 14,
marginBottom: 10,
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
},
topActionTitle: {
color: "#fff",
fontWeight: "900",
fontSize: 15,
},
topActionSub: {
color: "#A8A3C2",
marginTop: 2,
fontSize: 12,
},
finishBtn: {
backgroundColor: "#8A4DFF",
paddingVertical: 10,
paddingHorizontal: 12,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
gap: 6,
},
finishText: {
color: "white",
fontWeight: "900",
},

productCard: {
backgroundColor: "#161228",
padding: 16,
borderRadius: 18,
flexDirection: "row",
alignItems: "center",
marginTop: 12,
},
iconBox: {
width: 52,
height: 52,
borderRadius: 14,
backgroundColor: "#1E1838",
alignItems: "center",
justifyContent: "center",
marginRight: 14,
},
productName: {
color: "#fff",
fontSize: 16,
fontWeight: "900",
},
productMeta: {
color: "#A8A3C2",
marginTop: 4,
fontSize: 12,
},
itemRight: {
alignItems: "flex-end",
marginLeft: 10,
},
productPrice: {
color: "#C59CFF",
fontSize: 14,
      fontWeight: "900",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 50,
      paddingBottom: 8,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#1E1838",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "900",
      flex: 1,
      textAlign: "center",
    },
    swipeHint: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    historyRow: {
      marginBottom: 12,
      paddingLeft: 2,
    },
    historyChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#1E1838",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginRight: 8,
      gap: 6,
    },
    historyChipText: {
      color: "#C6C0DD",
      fontSize: 12,
      fontWeight: "600",
    },
  });
