// screens/CreateProductScreen.tsx
import React, { useState, useContext } from "react";
import {
View,
Text,
StyleSheet,
TextInput,
TouchableOpacity,
Alert,
ScrollView,
ActivityIndicator,
Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

function isValidYYYYMMDD(v: string) {
if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

const d = new Date(v);
if (isNaN(d.getTime())) return false;

const [y, m, day] = v.split("-").map(Number);
return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

export default function CreateProductScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();
const { token } = useContext(AuthContext);

// ✅ optionnel : on sait d’où on vient (stock / inventaire etc.)
const mode: "stock" | "inventory" | undefined = route?.params?.mode;

const [name, setName] = useState("");
const [category, setCategory] = useState("");

// ✅ Prix de vente (sellPrice)
const [sellPrice, setSellPrice] = useState("");

// ✅ Prix d’achat (purchasePrice) — optionnel pour V1
const [purchasePrice, setPurchasePrice] = useState("");

const [initialStock, setInitialStock] = useState("");
const [alertLevel, setAlertLevel] = useState("");
const [barcode, setBarcode] = useState("");

// ✅ Date d’expiration (YYYY-MM-DD) — optionnel
const [expirationDate, setExpirationDate] = useState("");

const [loading, setLoading] = useState(false);

// Scanner
const [cameraPermission, requestCameraPermission] = useCameraPermissions();
const [scanVisible, setScanVisible] = useState(false);
const [isScanning, setIsScanning] = useState(true);

const openScanner = async () => {
  if (!cameraPermission?.granted) {
    const perm = await requestCameraPermission();
    if (!perm.granted) {
      return Alert.alert("Permission refusée", "Active la caméra dans les réglages.");
    }
  }
  setIsScanning(true);
  setScanVisible(true);
};

const handleBarcodeScanned = ({ data }: any) => {
  if (!isScanning) return;
  setIsScanning(false);
  setBarcode(String(data || ""));
  setScanVisible(false);
};

const saveNewProduct = async () => {
if (!token) {
return Alert.alert("Erreur", "Session invalide. Reconnectez-vous.");
}

// ✅ si un jour tu appelles cet écran depuis INVENTAIRE, on peut bloquer ici
// (pour l’instant on autorise quand même, mais tu peux activer ce bloc si tu veux)
// if (mode === "inventory") {
// return Alert.alert("Erreur", "Ce mode inventaire fonctionne sur un produit existant.");
// }

if (!name.trim() || !sellPrice.trim() || !initialStock.trim()) {
return Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires.");
}

const sp = Number(sellPrice);
const q = Number(initialStock);
const a = alertLevel.trim() ? Number(alertLevel) : 3;

if (Number.isNaN(sp) || sp <= 0) {
return Alert.alert("Erreur", "Prix de vente invalide.");
}

if (Number.isNaN(q) || q < 0) {
return Alert.alert("Erreur", "Stock initial invalide.");
}

if (Number.isNaN(a) || a < 0) {
return Alert.alert("Erreur", "Seuil d’alerte invalide.");
}

// ✅ achat optionnel
const ppRaw = purchasePrice.trim();
const pp = ppRaw === "" ? 0 : Number(ppRaw);
if (ppRaw !== "" && (Number.isNaN(pp) || pp < 0)) {
return Alert.alert("Erreur", "Prix d'achat invalide.");
}

// ✅ expiration optionnelle -> tableau expirationDates
const exp = expirationDate.trim();
if (exp !== "" && !isValidYYYYMMDD(exp)) {
return Alert.alert(
"Erreur",
"Date d’expiration invalide. Format : YYYY-MM-DD (ex: 2026-01-31)"
);
}

try {
setLoading(true);

await API.post(
"/products",
{
name: name.trim(),
category: category.trim(),

// ✅ nouveaux champs (alignés Product.ts)
sellPrice: sp,
purchasePrice: pp,

quantity: q,
alertLevel: a,

barcode: barcode.trim() || undefined,

// ✅ Product.ts = expirationDates: Date[]
expirationDates: exp !== "" ? [exp] : [],
},
{
headers: {
Authorization: `Bearer ${token}`,
},
}
);

Alert.alert("Succès", "Produit ajouté au stock.");
navigation.goBack();
} catch (err: any) {
console.log("❌ Create product error:", err?.response?.data || err);
Alert.alert("Erreur", err?.response?.data?.error || "Une erreur est survenue.");
} finally {
setLoading(false);
}
};

return (
<View style={styles.container}>
<ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
{/* BACK */}
<TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Nouveau produit</Text>

{/* NOM */}
<Text style={styles.label}>Nom du produit</Text>
<TextInput
style={styles.input}
placeholder="Ex: Coca Cola 50cl"
placeholderTextColor="#777"
value={name}
onChangeText={setName}
/>

{/* CATÉGORIE */}
<Text style={styles.label}>Catégorie</Text>
<TextInput
style={styles.input}
placeholder="Ex: Boissons, Snacks..."
placeholderTextColor="#777"
value={category}
onChangeText={setCategory}
/>

{/* PRIX DE VENTE */}
<Text style={styles.label}>Prix de vente (FCFA)</Text>
<TextInput
style={styles.input}
keyboardType="numeric"
placeholder="Ex: 500"
placeholderTextColor="#777"
value={sellPrice}
onChangeText={setSellPrice}
/>

{/* PRIX D’ACHAT (OPTIONNEL) */}
<Text style={styles.label}>Prix d'achat (optionnel)</Text>
<TextInput
style={styles.input}
keyboardType="numeric"
placeholder="Ex: 350"
placeholderTextColor="#777"
value={purchasePrice}
onChangeText={setPurchasePrice}
/>

{/* STOCK INITIAL */}
<Text style={styles.label}>Stock initial</Text>
<TextInput
style={styles.input}
keyboardType="numeric"
placeholder="Ex: 12"
placeholderTextColor="#777"
value={initialStock}
onChangeText={setInitialStock}
/>

{/* DATE D’EXPIRATION */}
<Text style={styles.label}>Date d’expiration (optionnel)</Text>
<TextInput
style={styles.input}
placeholder="YYYY-MM-DD (ex: 2026-01-31)"
placeholderTextColor="#777"
value={expirationDate}
onChangeText={setExpirationDate}
autoCapitalize="none"
/>

{/* SEUIL */}
<Text style={styles.label}>Seuil d’alerte</Text>
<TextInput
style={styles.input}
keyboardType="numeric"
placeholder="Ex: 3"
placeholderTextColor="#777"
value={alertLevel}
onChangeText={setAlertLevel}
/>

{/* BARCODE */}
<Text style={styles.label}>Code-barres (optionnel)</Text>
<TouchableOpacity style={[styles.input, styles.scanBtn]} onPress={openScanner}>
  <Text style={{ color: barcode ? "#C6C0DD" : "#777" }}>
    {barcode ? `Code scanné : ${barcode}` : "Scanner le code-barres"}
  </Text>
</TouchableOpacity>
<TextInput
  style={[styles.input, { marginTop: -10 }]}
  placeholder="Ou taper manuellement"
  placeholderTextColor="#777"
  value={barcode}
  onChangeText={setBarcode}
/>
</ScrollView>

{/* SAVE */}
<TouchableOpacity
style={[styles.saveBtn, loading ? { opacity: 0.7 } : null]}
onPress={saveNewProduct}
disabled={loading}
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
  onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
/>
<TouchableOpacity style={styles.closeScanner} onPress={() => { setIsScanning(false); setScanVisible(false); }}>
  <Text style={{ color: "#fff", fontSize: 18 }}>Fermer</Text>
</TouchableOpacity>
</Modal>
</View>
);
}

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
saveBtn: {
backgroundColor: "#8A4DFF",
paddingVertical: 18,
alignItems: "center",
borderRadius: 14,
marginBottom: 30,
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
