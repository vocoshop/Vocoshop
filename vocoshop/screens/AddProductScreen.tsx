// screens/AddProductScreen.tsx
import React, { useState, useContext, useEffect, useMemo, useCallback } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
TextInput,
Alert,
ActivityIndicator,
Modal,
KeyboardAvoidingView,
Platform,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";

import AsyncStorage from "@react-native-async-storage/async-storage";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

import { runOrQueue } from "../src/api/offline/queue";
import { isOffline } from "../src/api/utils/network";
type Product = {
_id: string;
name?: string;
category?: string;
barcode?: string;
price?: number;
};

type ApiProductsResponse = Product[] | { products?: Product[]; data?: Product[] } | any;

type StartInventorySessionResponse = {
sessionId: string;
status?: string;
};

export default function AddProductScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();

const {
token,
storeId,
inventorySessionId,
setInventoryActive,
setInventoryCount,
setInventorySessionId,
} = useContext(AuthContext);

const existingProduct: Product | null = route.params?.product ?? null;

// -----------------------------
// STATES
// -----------------------------
const [name, setName] = useState("");
const [category, setCategory] = useState("");
const [quantity, setQuantity] = useState(""); // nombre compté
const [barcode, setBarcode] = useState("");

const [loading, setLoading] = useState(false);

// Scanner
const [cameraPermission, requestCameraPermission] = useCameraPermissions();
const [scanVisible, setScanVisible] = useState(false);
const [isScanning, setIsScanning] = useState(true);

// Autocomplétion (optionnel, gardé)
const [allProducts, setAllProducts] = useState<Product[]>([]);
const [nameSuggestions, setNameSuggestions] = useState<Product[]>([]);
const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);

// IA : catégorie suggérée (optionnel)
const [suggestedCategory, setSuggestedCategory] = useState("");

// -----------------------------
// HELPERS
// -----------------------------
const safeHeaders = useMemo(() => {
const headers: any = {};
if (token) headers.Authorization = `Bearer ${token}`;
if (storeId) headers["x-store-id"] = String(storeId);
return headers;
}, [token, storeId]);

const showApiError = (err: any, fallback = "Une erreur est survenue.") => {
const status = err?.response?.status;
const msg =
err?.response?.data?.error ||
err?.response?.data?.message ||
err?.message ||
fallback;

console.log("❌ API error:", status, msg, err?.response?.data);
Alert.alert("Erreur", String(msg));
};

const isReady = Boolean(token && storeId);

// ✅ Save possible seulement si inventaire (produit existant) + qty > 0
const canSave =
!!existingProduct && isReady && quantity.trim().length > 0 && !loading;

// -----------------------------
// CHARGER TOUS LES PRODUITS (suggestions)
// -----------------------------
const loadProducts = useCallback(async () => {
try {
if (!token || !storeId) return;

const res = await API.get<ApiProductsResponse>("/products", {
headers: safeHeaders,
});

const data = res?.data;
let list: Product[] = [];

if (Array.isArray(data)) list = data;
else if (Array.isArray((data as any)?.products)) list = (data as any).products;
else if (Array.isArray((data as any)?.data)) list = (data as any).data;

setAllProducts(list);
} catch (err) {
console.log("❌ loadProducts error:", err);
}
}, [token, storeId, safeHeaders]);

useEffect(() => {
loadProducts();
}, [loadProducts]);

// -----------------------------
// IA : SUGGESTION CATÉGORIE (optionnel)
// -----------------------------
const askAISuggestion = async (productName: string) => {
try {
const res = await API.post("/ai/suggest-category", { name: productName });
const ai = res.data as any;
if (ai?.category) setSuggestedCategory(ai.category);
} catch (err) {
console.log("❌ AI category error:", err);
}
};

// -----------------------------
// AUTOCOMPLÉTION
// -----------------------------
const onNameChange = (text: string) => {
setName(text);

if (!text) {
setNameSuggestions([]);
setSuggestedCategory("");
return;
}

askAISuggestion(text);

const matches = allProducts.filter((p) =>
String(p.name || "").toLowerCase().includes(text.toLowerCase())
);

setNameSuggestions(matches.slice(0, 5));
};

const onCategoryChange = (text: string) => {
setCategory(text);

if (!text) {
setCategorySuggestions([]);
return;
}

const matches = allProducts
.map((p) => p.category)
.filter((cat: any) => cat && String(cat).toLowerCase().includes(text.toLowerCase()));

const unique = Array.from(new Set(matches as string[])).slice(0, 5);
setCategorySuggestions(unique);
};

// -----------------------------
// PRÉ-REMPLISSAGE
// -----------------------------
useEffect(() => {
if (!existingProduct) return;

setName(existingProduct.name ?? "");
setCategory(existingProduct.category ?? "");
setQuantity("");
setBarcode(existingProduct.barcode ?? "");
}, [existingProduct]);

// -----------------------------
// SCANNER
// -----------------------------
const openScanner = async () => {
try {
if (!cameraPermission?.granted) {
const perm = await requestCameraPermission();
if (!perm.granted) {
return Alert.alert("Permission refusée", "Active la caméra dans les réglages.");
}
}

setIsScanning(true);
setScanVisible(true);
} catch (err) {
console.log("❌ openScanner error:", err);
}
};

const handleBarCodeScanned = ({ data }: any) => {
if (!isScanning) return;
setIsScanning(false);

setBarcode(String(data || ""));
setScanVisible(false);
};

const closeScanner = () => {
setIsScanning(false);
setScanVisible(false);
};

// -----------------------------
// ✅ SESSION : créer si absente (au moment d'enregistrer)
// - source: context -> storage -> backend
// -----------------------------
const ensureSession = useCallback(async (): Promise<string | null> => {
if (!token || !storeId) return null;

// 1) context
if (inventorySessionId) return inventorySessionId;

// 2) storage
try {
const sidStorage = await AsyncStorage.getItem("inventorySessionId");
if (sidStorage && sidStorage.trim()) {
const clean = sidStorage.trim();
setInventorySessionId(clean);
return clean;
}
} catch {}

// 3) backend
try {
const response = await API.post<StartInventorySessionResponse>(
"/inventory/session/start",
{},
{ headers: safeHeaders }
);

const sid = String((response as any)?.data?.sessionId || "").trim();
if (!sid) return null;

setInventorySessionId(sid);
await AsyncStorage.setItem("inventorySessionId", sid);

return sid;
} catch (err: any) {
showApiError(err, "Impossible de démarrer une session d’inventaire.");
return null;
}
}, [token, storeId, inventorySessionId, safeHeaders, setInventorySessionId]);

// ✅ Recalcule le compteur réel depuis le backend + active flag (source de vérité)
const refreshCountAndActive = useCallback(
async (sid: string) => {
if (!token || !storeId || !sid) return;

try {
const sessionRes = await API.get(`/inventory/session/${sid}`, {
headers: safeHeaders,
});

const data = sessionRes.data as any;
const lines = Array.isArray(data?.lines) ? data.lines : [];
const count = lines.length;

setInventoryCount(count);
setInventoryActive(count > 0);
} catch {
// silencieux
}
},
[token, storeId, safeHeaders, setInventoryCount, setInventoryActive]
);

// -----------------------------
// SAVE INVENTAIRE (EMPLOYÉ)
// -----------------------------
const saveProduct = async () => {
if (!existingProduct) {
return Alert.alert(
"Erreur",
"Ce mode inventaire fonctionne sur un produit existant."
);
}

const q = Number(quantity);
if (!Number.isFinite(q) || q <= 0) {
return Alert.alert(
"Erreur",
"Veuillez renseigner un nombre compté valide (ex: 12)."
);
}

if (!token || !storeId) {
return Alert.alert("Erreur", "Session non prête. Réessaie.");
}

setLoading(true);

try {
// 🔥 Sécurité offline : pas de création session offline
if (!inventorySessionId && isOffline()) {
Alert.alert(
"Mode hors-ligne",
"Lance d’abord un inventaire en ligne pour pouvoir compter hors-ligne."
);
setLoading(false);
return;
}

const sid = await ensureSession();
if (!sid) {
setLoading(false);
return Alert.alert("Erreur", "Impossible de démarrer la session d’inventaire.");
}

const result = await runOrQueue({
title: `Inventaire ${existingProduct.name}`,
method: "POST",
url: `/inventory/session/${sid}/add-line`,
body: {
productId: existingProduct._id,
countedQuantity: q,
},
headers: safeHeaders,
});

// ✅ OFFLINE
if (result.mode === "offline") {
setInventoryCount((prev: number) => prev + 1);
setInventoryActive(true);

Alert.alert(
"Hors-ligne ✅",
"Produit compté hors-ligne. Synchronisation automatique."
);

navigation.navigate({
name: "Inventory",
params: { justCounted: true, countedAt: Date.now() },
merge: true,
});

return;
}

// ✅ ONLINE
await refreshCountAndActive(sid);

Alert.alert("Succès", "Produit compté avec succès.");

navigation.navigate({
name: "Inventory",
params: { justCounted: true, countedAt: Date.now() },
merge: true,
});

} catch (err: any) {
showApiError(err, "Impossible d’enregistrer le comptage.");
} finally {
setLoading(false);
}
};

// -----------------------------
// UI
// -----------------------------
return (
<View style={styles.container}>
<KeyboardAvoidingView
style={{ flex: 1 }}
behavior={Platform.OS === "ios" ? "padding" : undefined}
>
<ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
{/* BACK */}
<TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>
{existingProduct ? "Inventaire produit" : "Nouveau produit"}
</Text>

{/* NOM */}
<Text style={styles.label}>Nom du produit</Text>
<TextInput
style={styles.input}
placeholder="Ex: Coca Cola 50cl"
placeholderTextColor="#777"
value={name}
onChangeText={onNameChange}
editable={false}
/>

{nameSuggestions.length > 0 && (
<View style={styles.suggestionBox}>
{nameSuggestions.map((p, i) => (
<TouchableOpacity
key={`${p._id}_${i}`}
onPress={() => {
setName(p.name ?? "");
if (p.category) setCategory(p.category);
setNameSuggestions([]);
}}
>
<Text style={styles.suggestionText}>{p.name}</Text>
</TouchableOpacity>
))}
</View>
)}

{suggestedCategory ? (
<TouchableOpacity
onPress={() => setCategory(suggestedCategory)}
style={{ marginBottom: 8 }}
>
<Text style={{ color: "#8A4DFF" }}>
💡 Suggestion IA : {suggestedCategory} (toucher pour utiliser)
</Text>
</TouchableOpacity>
) : null}

{/* CATÉGORIE */}
<Text style={styles.label}>Catégorie</Text>
<TextInput
style={styles.input}
placeholder="Ex: Boissons, Snacks..."
placeholderTextColor="#777"
value={category}
onChangeText={onCategoryChange}
editable={false}
/>

{categorySuggestions.length > 0 && (
<View style={styles.suggestionBox}>
{categorySuggestions.map((cat, i) => (
<TouchableOpacity
key={`${cat}_${i}`}
onPress={() => {
setCategory(cat);
setCategorySuggestions([]);
}}
>
<Text style={styles.suggestionText}>{cat}</Text>
</TouchableOpacity>
))}
</View>
)}

{/* NOMBRE COMPTÉ */}
<Text style={styles.label}>Nombre compté pendant l’inventaire</Text>
<TextInput
style={styles.input}
keyboardType="numeric"
placeholder="Ex: 12"
placeholderTextColor="#777"
value={quantity}
onChangeText={setQuantity}
/>

{/* BARCODE */}
<Text style={styles.label}>Code-barres (optionnel)</Text>
<TouchableOpacity style={[styles.input, styles.scanBtn]} onPress={openScanner}>
<Text style={{ color: barcode ? "#C6C0DD" : "#777" }}>
{barcode ? `Code scanné : ${barcode}` : "Scanner le code-barres"}
</Text>
</TouchableOpacity>

{!isReady && (
<Text style={styles.warningText}>
⚠️ Session non prête. Réessaie dans quelques secondes.
</Text>
)}
</ScrollView>

{/* BOUTON SAVE */}
<TouchableOpacity
style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
onPress={saveProduct}
disabled={!canSave}
>
{loading ? (
<ActivityIndicator color="#fff" />
) : (
<Text style={styles.saveText}>Enregistrer</Text>
)}
</TouchableOpacity>

{/* MODAL SCANNER */}
<Modal visible={scanVisible} animationType="slide">
<CameraView
style={{ flex: 1 }}
facing="back"
onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
/>
<TouchableOpacity style={styles.closeScanner} onPress={closeScanner}>
<Text style={{ color: "#fff", fontSize: 18 }}>Fermer</Text>
</TouchableOpacity>
</Modal>
</KeyboardAvoidingView>
</View>
);
}

// -----------------------------
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
paddingTop: 55,
paddingHorizontal: 20,
},
backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
},
title: {
fontSize: 32,
color: "#fff",
fontWeight: "900",
marginBottom: 30,
marginTop: 10,
},
label: {
color: "#ccc",
marginBottom: 8,
fontSize: 14,
},
input: {
backgroundColor: "#1A152A",
paddingVertical: 14,
paddingHorizontal: 15,
borderRadius: 14,
color: "#fff",
fontSize: 16,
marginBottom: 18,
},
suggestionBox: {
backgroundColor: "#17112A",
padding: 10,
marginTop: -10,
marginBottom: 10,
borderRadius: 10,
},
suggestionText: {
color: "#ccc",
paddingVertical: 8,
},
warningText: {
color: "#A8A3C2",
marginTop: -6,
marginBottom: 18,
},
saveBtn: {
backgroundColor: "#8A4DFF",
paddingVertical: 18,
alignItems: "center",
borderRadius: 14,
marginBottom: 24,
},
saveText: {
color: "#fff",
fontSize: 18,
fontWeight: "700",
},
scanBtn: {
justifyContent: "center",
},
closeScanner: {
position: "absolute",
bottom: 40,
left: 0,
right: 0,
alignItems: "center",
},
});
