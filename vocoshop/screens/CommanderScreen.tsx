// screens/CommanderScreen.tsx
import React, { useContext, useMemo, useState, useCallback, useEffect } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
FlatList,
Modal,
ActivityIndicator,
Alert,
RefreshControl,
Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

/* ------------------------------------------
TYPES
--------------------------------------------*/
interface Product {
_id: string;
name: string;
category?: string;
purchasePrice?: number;
}

interface CartItem {
product: Product;
quantity: number;
unitPrice: number;
}

type OrderStatus = "draft" | "sent" | "received";

interface OrderItem {
productId: string;
name: string;
quantity: number;
unitPrice?: number;
receivedQty?: number;
}

interface Order {
_id: string;
storeId: string;
supplier?: string; // legacy
supplierId?: string; // ✅
supplierName?: string; // ✅ snapshot
status: OrderStatus;
items: OrderItem[];
totalEstimated?: number;
note?: string;
createdAt?: string;
updatedAt?: string;
}

interface Supplier {
_id: string;
name: string;
phone?: string;
whatsapp?: string;
}

/* ------------------------------------------
UTILS
--------------------------------------------*/
const formatAmount = (value?: number) => {
if (!value || isNaN(value)) return "0 FCFA";
return `${Math.round(value).toLocaleString("fr-FR")} FCFA`;
};

const statusLabel = (s: OrderStatus) =>
s === "draft" ? "Brouillon" : s === "sent" ? "Envoyée" : "Reçue";

const statusColor = (s: OrderStatus) =>
s === "draft" ? "#FACC15" : s === "sent" ? "#60A5FA" : "#22C55E";

function computeTotal(o: Order) {
if (typeof o.totalEstimated === "number") return o.totalEstimated;
return (o.items || []).reduce((sum, it) => {
const q = Number(it.quantity) || 0;
const p = Number(it.unitPrice) || 0;
return sum + q * p;
}, 0);
}

function formatDateFR(v?: string) {
if (!v) return "";
const d = new Date(v);
if (isNaN(d.getTime())) return "";
return d.toLocaleDateString("fr-FR");
}

function getSupplierDisplayForOrder(order: Order, suppliers: Supplier[]) {
const name = order.supplierName || order.supplier || "";



// pas de supplierId → legacy
if (!order.supplierId) return name;

const stillExists = suppliers.some((s) => s._id === order.supplierId);

if (!stillExists) {
return name ? `${name} (supprimé)` : "Fournisseur supprimé";
}

return name;
}

const cleanPhone = (v?: string) => (v || "").replace(/\D+/g, "");

function buildOrderShareText(params: {
supplierName?: string;
items: { name: string; quantity: number; unitPrice: number }[];
total: number;
}) {
const lines = params.items.map((it) => {
const lineTotal = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
return `• ${it.name} — ${it.quantity} × ${Math.round(it.unitPrice)} = ${Math.round(
lineTotal
)} FCFA`;
});

return [
`Bonjour ${params.supplierName || ""}`.trim(),
`Voici ma commande :`,
...lines,
`Total estimé : ${Math.round(params.total).toLocaleString("fr-FR")} FCFA`,
`Merci.`,
].join("\n");
}

// ✅ HYBRIDE : calcule progression réception d'une commande
function getOrderProgress(o: any) {
const items = Array.isArray(o?.items) ? o.items : [];
const ordered = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
const received = items.reduce((sum: number, it: any) => sum + (Number(it.receivedQty) || 0), 0);

const allReceived =
items.length > 0 &&
items.every((it: any) => (Number(it.receivedQty) || 0) >= (Number(it.quantity) || 0));

return { ordered, received, allReceived };
}

// ✅ statut “affiché” côté UI (Option A)
type UIOrderStatus = "draft" | "sent" | "received" | "in_progress";

function getEffectiveStatus(o: any): UIOrderStatus {
const p = getOrderProgress(o);

// backend déjà reçu
if (o?.status === "received") return "received";

// réception complète (même si status backend pas encore “received”)
if (p.allReceived) return "received";

// réception partielle
if (p.received > 0) return "in_progress";

// sinon statut normal
return o?.status === "draft" ? "draft" : "sent";
}

// ✅ label + couleur pour “En cours”
function statusLabelUI(s: UIOrderStatus) {
if (s === "in_progress") return "En cours";
return statusLabel(s as any);
}

function statusColorUI(s: UIOrderStatus) {
if (s === "in_progress") return "#A78BFA"; // violet pro
return statusColor(s as any);
}

function clamp(n: number, min: number, max: number) {
return Math.max(min, Math.min(max, n));
}

function getOrderProgressUI(o: any) {
const items = Array.isArray(o?.items) ? o.items : [];

const ordered = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
const received = items.reduce((sum: number, it: any) => sum + (Number(it.receivedQty) || 0), 0);

const allReceived =
items.length > 0 &&
items.every((it: any) => (Number(it.receivedQty) || 0) >= (Number(it.quantity) || 0));

return {
ordered,
received: clamp(received, 0, ordered),
allReceived,
};
}

/** ex: "Réception : 15/20" */
function receptionShort(o: any) {
const p = getOrderProgress(o);
if (p.received <= 0 || p.ordered <= 0) return "";
return `Réception : ${p.received}/${p.ordered}`;
}

/** ex: "Réception partielle" / "Réception complète" */
function receptionLabel(o: any) {
const p = getOrderProgress(o);
if (p.received <= 0) return "";
return p.allReceived || o?.status === "received" ? "Réception complète" : "Réception partielle";
}

/* ------------------------------------------
SCREEN
--------------------------------------------*/
export default function CommanderScreen() {
const navigation = useNavigation<any>();
const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
"x-store-id": storeId || "",
}),
[token, storeId]
);

const canLoad = !!token && !!storeId;

const route = useRoute<any>();
const preselectedSupplierId = route.params?.supplierId;

// Tabs
const [tab, setTab] = useState<"products" | "history">("products");

// Products
const [products, setProducts] = useState<Product[]>([]);
const [search, setSearch] = useState("");
const [loadingProducts, setLoadingProducts] = useState(false);

// Suppliers
const [suppliers, setSuppliers] = useState<Supplier[]>([]);
const [loadingSuppliers, setLoadingSuppliers] = useState(false);
const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

useEffect(() => {
  if (preselectedSupplierId) {
    setSelectedSupplierId(preselectedSupplierId);
  }
}, [preselectedSupplierId]);
const [showSupplierModal, setShowSupplierModal] = useState(false);

// Cart + modals
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
const [unitPriceInput, setUnitPriceInput] = useState("");
const [quantityInput, setQuantityInput] = useState("");
const [showProductModal, setShowProductModal] = useState(false);
const [showCartModal, setShowCartModal] = useState(false);
const [cart, setCart] = useState<CartItem[]>([]);
const [sendingOrder, setSendingOrder] = useState(false);

// History
const [orders, setOrders] = useState<Order[]>([]);
const [loadingOrders, setLoadingOrders] = useState(false);
const [refreshingOrders, setRefreshingOrders] = useState(false);
const [statusFilter, setStatusFilter] = useState<
"all" | OrderStatus | "in_progress"
>("all");

/* ------------------------------------------
LOAD PRODUCTS
--------------------------------------------*/
const loadProducts = useCallback(async (supplierId?: string) => {
if (!canLoad) return;
try {
setLoadingProducts(true);
let list: Product[] = [];
if (supplierId) {
const res = await API.get(`/products/by-supplier/${supplierId}`, { headers });
const data: any = res.data;
if (Array.isArray(data)) list = data;
} else {
const res = await API.get("/products", { headers });
const data: any = res.data;
if (Array.isArray(data)) list = data;
else if (data?.products && Array.isArray(data.products)) list = data.products;
}
list.sort((a, b) => a.name.localeCompare(b.name));
setProducts(list);
} catch (err) {
console.log("❌ loadProducts error:", err);
} finally {
setLoadingProducts(false);
}
}, [canLoad, headers]);

/* ------------------------------------------
LOAD SUPPLIERS
--------------------------------------------*/
const loadSuppliers = useCallback(async () => {
if (!canLoad) return;
try {
setLoadingSuppliers(true);
const res = await API.get("/suppliers", { headers });
setSuppliers(Array.isArray(res.data) ? (res.data as Supplier[]) : []);
} catch (err) {
console.log("❌ loadSuppliers error:", err);
setSuppliers([]);
} finally {
setLoadingSuppliers(false);
}
}, [canLoad, headers]);

/* ------------------------------------------
LOAD ORDERS
--------------------------------------------*/
const loadOrders = useCallback(async () => {
if (!canLoad) return;
try {
setLoadingOrders(true);
const res = await API.get("/orders", { headers });
setOrders(Array.isArray(res.data) ? (res.data as Order[]) : []);
} catch (err) {
console.log("❌ loadOrders error:", err);
setOrders([]);
} finally {
setLoadingOrders(false);
}
}, [canLoad, headers]);

useFocusEffect(
useCallback(() => {
loadProducts(selectedSupplierId || undefined);
loadSuppliers();
loadOrders();
}, [loadProducts, loadSuppliers, loadOrders, selectedSupplierId])
);

/* ------------------------------------------
SEARCH
--------------------------------------------*/
const filteredProducts = products.filter((p) =>
p.name.toLowerCase().includes(search.toLowerCase())
);

/* ------------------------------------------
OPEN PRODUCT MODAL
--------------------------------------------*/
const openProductModal = (product: Product) => {
setShowCartModal(false);
setSelectedProduct(product);
setUnitPriceInput(product.purchasePrice ? String(product.purchasePrice) : "");
setQuantityInput("");
setShowProductModal(true);
};

/* ------------------------------------------
ADD TO CART
--------------------------------------------*/
const addToCart = async () => {
if (!selectedProduct) return;

if (!unitPriceInput || isNaN(Number(unitPriceInput))) {
return Alert.alert("Erreur", "Veuillez renseigner un prix d'achat valide.");
}
if (!quantityInput || isNaN(Number(quantityInput))) {
return Alert.alert("Erreur", "Veuillez renseigner une quantité valide.");
}

const unitPrice = Number(unitPriceInput);
const quantity = Number(quantityInput);

API.patch(`/products/${selectedProduct._id}`, { purchasePrice: unitPrice }, { headers }).catch(
(err) => console.log("⚠️ Erreur sauvegarde prix:", err)
);

const index = cart.findIndex((c) => c.product._id === selectedProduct._id);
const newCart = [...cart];

if (index >= 0) {
newCart[index] = {
...newCart[index],
quantity: newCart[index].quantity + quantity,
unitPrice,
};
} else {
newCart.push({ product: selectedProduct, quantity, unitPrice });
}

setCart(newCart);

setProducts((prev) =>
prev.map((p) =>
p._id === selectedProduct._id ? { ...p, purchasePrice: unitPrice } : p
)
);

setShowProductModal(false);
};

/* ------------------------------------------
TOTAL PANIER
--------------------------------------------*/
const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

const selectedSupplier = useMemo(() => {
if (!selectedSupplierId) return null;
return suppliers.find((s) => s._id === selectedSupplierId) || null;
}, [selectedSupplierId, suppliers]);

/* ------------------------------------------
SHARE (V1)
- SMS texte
- WhatsApp texte
- WhatsApp PDF (via share sheet)
--------------------------------------------*/
const shareBySMS = async () => {
if (!selectedSupplier) return Alert.alert("Info", "Choisis un fournisseur.");
const phone = cleanPhone(selectedSupplier.phone || selectedSupplier.whatsapp);
if (!phone) return Alert.alert("Info", "Ce fournisseur n’a pas de numéro.");

const text = buildOrderShareText({
supplierName: selectedSupplier.name,
items: cart.map((c) => ({ name: c.product.name, quantity: c.quantity, unitPrice: c.unitPrice })),
total: cartTotal,
});

const url = `sms:${phone}?body=${encodeURIComponent(text)}`;
const ok = await Linking.canOpenURL(url);
if (!ok) return Alert.alert("Erreur", "Impossible d’ouvrir les SMS.");
Linking.openURL(url);
};

const shareByWhatsAppText = async () => {
if (!selectedSupplier) return Alert.alert("Info", "Choisis un fournisseur.");
const phone = cleanPhone(selectedSupplier.whatsapp || selectedSupplier.phone);
if (!phone) return Alert.alert("Info", "Ce fournisseur n’a pas de WhatsApp/numéro.");

const text = buildOrderShareText({
supplierName: selectedSupplier.name,
items: cart.map((c) => ({ name: c.product.name, quantity: c.quantity, unitPrice: c.unitPrice })),
total: cartTotal,
});

const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
const ok = await Linking.canOpenURL(url);
if (!ok) return Alert.alert("Erreur", "WhatsApp n’est pas disponible.");
Linking.openURL(url);
};

const shareByWhatsAppPDF = async () => {
if (!selectedSupplier) return Alert.alert("Info", "Choisis un fournisseur.");

const html = `
<html>
<body style="font-family: Arial; padding: 16px;">
<h2>Commande</h2>
<p><b>Fournisseur :</b> ${selectedSupplier.name}</p>
<hr/>
<ul>
${cart
.map((c) => {
const lineTotal = c.quantity * c.unitPrice;
return `<li>${c.product.name} — ${c.quantity} × ${Math.round(c.unitPrice)} = ${Math.round(
lineTotal
)} FCFA</li>`;
})
.join("")}
</ul>
<hr/>
<h3>Total estimé : ${Math.round(cartTotal).toLocaleString("fr-FR")} FCFA</h3>
</body>
</html>
`;

try {
const { uri } = await Print.printToFileAsync({ html });
const canShare = await Sharing.isAvailableAsync();
if (!canShare) return Alert.alert("Erreur", "Partage indisponible sur cet appareil.");

await Sharing.shareAsync(uri, {
mimeType: "application/pdf",
dialogTitle: "Envoyer la commande (PDF)",
UTI: "com.adobe.pdf",
});
} catch (e) {
console.log("❌ PDF share error:", e);
Alert.alert("Erreur", "Impossible de générer/partager le PDF.");
}
};

const chooseShareMethod = () => {
if (!selectedSupplierId) {
return Alert.alert("Info", "Tu n’as pas choisi de fournisseur.");
}

Alert.alert("Envoyer au fournisseur", "Choisis une méthode", [
{ text: "SMS", onPress: shareBySMS },
{
text: "WhatsApp",
onPress: () => {
Alert.alert("WhatsApp", "Envoyer comment ?", [
{ text: "Texte", onPress: shareByWhatsAppText },
{ text: "PDF", onPress: shareByWhatsAppPDF },
{ text: "Annuler", style: "cancel" },
]);
},
},
{ text: "Annuler", style: "cancel" },
]);
};

/* ------------------------------------------
SEND ORDER (backend) ✅ supplierId
-> puis propose partage (V1)
--------------------------------------------*/
const sendOrder = async () => {
if (cart.length === 0) return Alert.alert("Erreur", "Votre panier est vide.");

try {
setSendingOrder(true);

const payload: any = {
items: cart.map((c) => ({
productId: c.product._id,
name: c.product.name,
quantity: c.quantity,
unitPrice: c.unitPrice,
})),
totalEstimated: cartTotal,
};

if (selectedSupplierId) payload.supplierId = selectedSupplierId;

const created = await API.post<{ _id: string }>("/orders", payload, { headers });
const orderId = created.data?._id;
if (!orderId) throw new Error("ID de commande manquant");

await API.post(`/orders/${orderId}/confirm`, {}, { headers });

Alert.alert(
"Succès",
`Commande envoyée.\nTotal : ${formatAmount(cartTotal)}${
selectedSupplier ? `\nFournisseur : ${selectedSupplier.name}` : ""
}`,
[
{ text: "OK" },
...(selectedSupplierId ? [{ text: "Envoyer au fournisseur", onPress: chooseShareMethod }] : []),
]
);

// reset
setCart([]);
setSelectedSupplierId("");
setShowCartModal(false);

await loadOrders();
loadProducts();
setTab("history");
} catch (e: any) {
console.log("❌ sendOrder error:", e?.response?.data || e);
Alert.alert(
"Erreur",
e?.response?.data?.error ||
e?.response?.data?.message ||
"Impossible d'envoyer la commande."
);
} finally {
setSendingOrder(false);
}
};

/* ------------------------------------------
HISTORY FILTER
--------------------------------------------*/
const filteredOrders = useMemo(() => {
const list = orders || [];
if (statusFilter === "all") return list;

return list.filter((o) => getEffectiveStatus(o) === statusFilter);
}, [orders, statusFilter]);

const onRefreshOrders = useCallback(async () => {
setRefreshingOrders(true);
try {
await loadOrders();
} finally {
setRefreshingOrders(false);
}
}, [loadOrders]);

/* ------------------------------------------
RENDER PRODUCT
--------------------------------------------*/
const renderProduct = ({ item }: { item: Product }) => (
<TouchableOpacity style={styles.productRow} onPress={() => openProductModal(item)}>
<View style={{ flex: 1, paddingRight: 10 }}>
<Text style={styles.productName} numberOfLines={1}>
{item.name}
</Text>
{item.category ? <Text style={styles.productCategory}>{item.category}</Text> : null}
</View>

<Text style={[styles.productPrice, !item.purchasePrice && { color: "#FACC15" }]}>
{item.purchasePrice ? formatAmount(item.purchasePrice) : "Prix non défini"}
</Text>
</TouchableOpacity>
);

/* ------------------------------------------
RENDER ORDER
--------------------------------------------*/
const renderOrder = ({ item }: { item: Order }) => {
const total = computeTotal(item);
const dateTxt = formatDateFR(item.createdAt || item.updatedAt);
const supplierTxt = getSupplierDisplayForOrder(item, suppliers);

const recLabel = receptionLabel(item);
const recShort = receptionShort(item);

return (
<TouchableOpacity
style={styles.orderCard}
activeOpacity={0.9}
onPress={() => navigation.navigate("OrderDetail", { orderId: item._id })}
>
<View style={styles.orderRow}>
<Text style={styles.orderTitle} numberOfLines={1}>
Commande • {dateTxt || "—"}
</Text>

<View style={[styles.badge, { borderColor: statusColor(getEffectiveStatus(item) as any) }]}>
<Text style={[styles.badgeText, { color: statusColor(getEffectiveStatus(item) as any) }]}>
{statusLabel(getEffectiveStatus(item) as any)}
</Text>
</View>
</View>

{!!supplierTxt && <Text style={styles.orderSmall}>Fournisseur : {supplierTxt}</Text>}

{!!recLabel && <Text style={[styles.orderSmall, { marginTop: 4 }]}>{recLabel}</Text>}

<View style={[styles.orderRow, { marginTop: 6 }]}>
<Text style={styles.orderSmall}>
{recShort || `${(item.items?.length || 0)} produit${(item.items?.length || 0) > 1 ? "s" : ""}`}
</Text>

<Text style={styles.orderTotal}>{formatAmount(total)}</Text>
</View>
</TouchableOpacity>
);
};

/* ------------------------------------------
JSX
--------------------------------------------*/
return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.title}>Commander</Text>
<View style={{ width: 26 }} />
</View>

{/* TABS */}
<View style={styles.tabs}>
<TouchableOpacity
style={[styles.tabBtn, tab === "products" && styles.tabBtnActive]}
onPress={() => setTab("products")}
activeOpacity={0.9}
>
<Text style={[styles.tabText, tab === "products" && styles.tabTextActive]}>Produits</Text>
</TouchableOpacity>

<TouchableOpacity
style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
onPress={() => setTab("history")}
activeOpacity={0.9}
>
<Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>
Historique
</Text>
</TouchableOpacity>
</View>

{/* PRODUCTS TAB */}
{tab === "products" && (
<>
{selectedSupplier && (
<View style={styles.activeSupplierBanner}>
<Ionicons name="business" size={16} color="#A78BFA" />
<Text style={styles.activeSupplierText} numberOfLines={1}>
{selectedSupplier.name}
</Text>
<TouchableOpacity onPress={() => { setSelectedSupplierId(""); loadProducts(); }}>
<Ionicons name="close-circle" size={18} color="#6B7280" />
</TouchableOpacity>
</View>
)}
<TextInput
placeholder="Rechercher un produit..."
placeholderTextColor="#6B7280"
style={styles.searchInput}
value={search}
onChangeText={setSearch}
/>

{loadingProducts ? (
<ActivityIndicator size="large" color="#A78BFA" />
) : !selectedSupplierId ? (
<View style={{ marginTop: 30, alignItems: "center" }}>
<Ionicons name="cart-outline" size={34} color="#A8A3C2" />
<Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>
Sélectionne un fournisseur
</Text>
<Text style={{ color: "#A8A3C2", marginTop: 6, textAlign: "center", maxWidth: 220 }}>
Ajoute d'abord des produits à ton fournisseur dans "Produits fournis"
</Text>
</View>
) : filteredProducts.length === 0 ? (
<View style={{ marginTop: 30, alignItems: "center" }}>
<Ionicons name="cube-outline" size={34} color="#A8A3C2" />
<Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>
Aucun produit
</Text>
<Text style={{ color: "#A8A3C2", marginTop: 6, textAlign: "center", maxWidth: 220 }}>
Ce fournisseur n'a pas encore de produits. Assigne-lui des produits dans "Produits fournis"
</Text>
</View>
) : (
<FlatList
data={filteredProducts}
keyExtractor={(i) => i._id}
renderItem={renderProduct}
contentContainerStyle={{ paddingBottom: 180 }}
/>
)}
</>
)}

{/* HISTORY TAB */}
{tab === "history" && (
<>
<View style={styles.filters}>
<Chip label="Toutes" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
<Chip label="Brouillon" active={statusFilter === "draft"} onPress={() => setStatusFilter("draft")} />
<Chip label="Envoyée" active={statusFilter === "sent"} onPress={() => setStatusFilter("sent")} />
<Chip label="En cours" active={statusFilter === "in_progress"} onPress={() => setStatusFilter("in_progress")} />
<Chip label="Reçue" active={statusFilter === "received"} onPress={() => setStatusFilter("received")} />
</View>

{loadingOrders ? (
<ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 10 }} />
) : filteredOrders.length === 0 ? (
<View style={{ marginTop: 30, alignItems: "center" }}>
<Ionicons name="file-tray-outline" size={34} color="#A8A3C2" />
<Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>
Aucune commande
</Text>
<Text style={{ color: "#A8A3C2", marginTop: 6 }}>
Crée une commande dans l’onglet Produits.
</Text>
</View>
) : (
<FlatList
data={filteredOrders}
keyExtractor={(o) => o._id}
renderItem={renderOrder}
contentContainerStyle={{ paddingBottom: 40 }}
refreshControl={
<RefreshControl refreshing={refreshingOrders} onRefresh={onRefreshOrders} />
}
/>
)}
</>
)}

{/* CART BUTTON */}
{tab === "products" && cart.length > 0 && (
<TouchableOpacity
style={styles.cartButton}
onPress={() => {
setShowProductModal(false);
setShowCartModal(true);
}}
>
<Ionicons name="cart-outline" size={26} color="#fff" />
<View style={styles.cartBadge}>
<Text style={styles.cartBadgeText}>{cart.length}</Text>
</View>
</TouchableOpacity>
)}

{/* -------- PRODUCT MODAL -------- */}
<Modal visible={showProductModal} transparent animationType="fade">
<View style={styles.modalOverlay}>
<View style={styles.modalContent}>
<Text style={styles.modalTitle}>{selectedProduct?.name ?? "Produit"}</Text>

<TextInput
placeholder="Prix d'achat (FCFA)"
placeholderTextColor="#777"
keyboardType="numeric"
style={styles.input}
value={unitPriceInput}
onChangeText={setUnitPriceInput}
/>

<TextInput
placeholder="Quantité à commander"
placeholderTextColor="#777"
keyboardType="numeric"
style={styles.input}
value={quantityInput}
onChangeText={setQuantityInput}
/>

<TouchableOpacity style={styles.bigBtn} onPress={addToCart}>
<Text style={styles.bigBtnText}>Ajouter au panier</Text>
</TouchableOpacity>

<TouchableOpacity style={{ marginTop: 10 }} onPress={() => setShowProductModal(false)}>
<Text style={styles.cancelText}>Annuler</Text>
</TouchableOpacity>
</View>
</View>
</Modal>

{/* -------- CART MODAL -------- */}
<Modal
visible={showCartModal}
transparent
animationType="slide"
onRequestClose={() => setShowCartModal(false)}
>
<View style={styles.modalOverlay}>
<View style={styles.cartModalContent}>
<Text style={styles.modalTitle}>Mon Panier</Text>

{/* Fournisseur */}
<View style={styles.supplierBlock}>
<Text style={styles.supplierLabel}>Fournisseur</Text>

<TouchableOpacity
activeOpacity={0.9}
style={styles.supplierSelectBtn}
onPress={() => {
// évite bug de modals superposés
setShowCartModal(false);
setTimeout(() => setShowSupplierModal(true), 150);
}}
>
<View style={{ flex: 1 }}>
<Text style={styles.supplierSelected} numberOfLines={1}>
{selectedSupplier ? selectedSupplier.name : "Aucun"}
</Text>
<Text style={styles.supplierHint}>Appuie pour choisir / rechercher</Text>
</View>

<Ionicons name="chevron-forward" size={18} color="#A78BFA" />
</TouchableOpacity>
</View>

<FlatList
data={cart}
keyExtractor={(item) => item.product._id}
style={{ marginVertical: 10 }}
showsVerticalScrollIndicator={false}
renderItem={({ item }) => (
<View style={styles.cartRow}>
<View style={{ flex: 1, paddingRight: 10 }}>
<Text style={styles.productName} numberOfLines={1}>
{item.product.name} × {item.quantity}
</Text>
<Text style={styles.productCategory}>{formatAmount(item.unitPrice)}</Text>
</View>

<Text style={styles.cartAmount}>
{formatAmount(item.unitPrice * item.quantity)}
</Text>
</View>
)}
ListFooterComponent={
<>
<View style={styles.cartTotalRow}>
<Text style={styles.cartTotalLabel}>Total</Text>
<Text style={styles.cartTotalValue}>{formatAmount(cartTotal)}</Text>
</View>

<TouchableOpacity
style={[styles.bigBtn, { marginTop: 20, opacity: sendingOrder ? 0.7 : 1 }]}
onPress={sendOrder}
disabled={sendingOrder}
>
<Text style={styles.bigBtnText}>
{sendingOrder ? "Envoi..." : "Valider & Envoyer"}
</Text>
</TouchableOpacity>

<TouchableOpacity style={{ marginTop: 12 }} onPress={() => setShowCartModal(false)}>
<Text style={styles.cancelText}>Fermer</Text>
</TouchableOpacity>
</>
}
/>
</View>
</View>
</Modal>

{/* -------- SELECT SUPPLIER MODAL -------- */}
<SelectSupplierModal
visible={showSupplierModal}
onClose={() => {
setShowSupplierModal(false);
setTimeout(() => setShowCartModal(true), 150);
}}
suppliers={suppliers}
loading={loadingSuppliers}
selectedSupplierId={selectedSupplierId}
onSelect={(id) => {
setSelectedSupplierId(id);
setShowSupplierModal(false);
loadProducts(id);
setTimeout(() => setShowCartModal(true), 150);
}}
onRefresh={loadSuppliers}
/>
</View>
);
}

/* ------------------------------------------
CHIP
--------------------------------------------*/
function Chip({
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
activeOpacity={0.9}
style={[styles.chip, active && styles.chipActive]}
>
<Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
</TouchableOpacity>
);
}

/* ------------------------------------------
SELECT SUPPLIER MODAL (local)
--------------------------------------------*/
function SelectSupplierModal({
visible,
onClose,
suppliers,
loading,
selectedSupplierId,
onSelect,
onRefresh,
}: {
visible: boolean;
onClose: () => void;
suppliers: Supplier[];
loading: boolean;
selectedSupplierId: string;
onSelect: (id: string) => void;
onRefresh: () => Promise<void> | void;
}) {
const [q, setQ] = useState("");

const filtered = useMemo(() => {
const s = (q || "").trim().toLowerCase();
if (!s) return suppliers;
return (suppliers || []).filter((x) => x.name.toLowerCase().includes(s));
}, [q, suppliers]);

const pickNone = () => {
onSelect("");
onClose();
};

const pick = (id: string) => {
onSelect(id);
onClose();
};

return (
<Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
<View style={styles.modalOverlay}>
<View style={styles.supplierModal}>
<View style={styles.supplierModalHeader}>
<Text style={styles.supplierModalTitle}>Choisir un fournisseur</Text>
<TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.85}>
<Ionicons name="close" size={18} color="#fff" />
</TouchableOpacity>
</View>

<TextInput
placeholder="Rechercher..."
placeholderTextColor="#6B7280"
style={styles.supplierSearch}
value={q}
onChangeText={setQ}
/>

{loading ? (
<ActivityIndicator size="small" color="#A78BFA" style={{ marginTop: 10 }} />
) : suppliers.length === 0 ? (
<Text style={styles.supplierEmpty}>
Aucun fournisseur. Ajoute-en dans le module Fournisseurs.
</Text>
) : (
<FlatList
data={[{ _id: "", name: "Aucun" } as any, ...filtered]}
keyExtractor={(it: any, idx: number) => (it?._id ? it._id : `none-${idx}`)}
style={{ marginTop: 10 }}
refreshControl={
<RefreshControl
refreshing={false}
onRefresh={async () => {
try {
await onRefresh();
} catch {}
}}
/>
}
renderItem={({ item }: any) => {
const isNone = !item._id;
const active = isNone ? !selectedSupplierId : selectedSupplierId === item._id;

return (
<TouchableOpacity
style={[styles.supplierRow, active && styles.supplierRowActive]}
activeOpacity={0.9}
onPress={() => (isNone ? pickNone() : pick(item._id))}
>
<View style={{ flex: 1, paddingRight: 10 }}>
<Text
style={[styles.supplierRowTitle, active && { color: "#EDE9FE" }]}
numberOfLines={1}
>
{item.name}
</Text>

{!isNone && (item.phone || item.whatsapp) ? (
<Text style={styles.supplierRowSmall} numberOfLines={1}>
{item.phone ? `📞 ${item.phone}` : ""}{" "}
{item.whatsapp ? `• 🟢 ${item.whatsapp}` : ""}
</Text>
) : null}
</View>

{active ? <Ionicons name="checkmark-circle" size={20} color="#A78BFA" /> : null}
</TouchableOpacity>
);
}}
/>
)}
</View>
</View>
</Modal>
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

tabs: {
flexDirection: "row",
backgroundColor: "#18122B",
borderRadius: 14,
padding: 6,
marginBottom: 14,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
tabBtn: {
flex: 1,
paddingVertical: 10,
borderRadius: 12,
alignItems: "center",
},
tabBtnActive: {
backgroundColor: "rgba(124,58,237,0.25)",
borderWidth: 1,
borderColor: "rgba(167,139,250,0.55)",
},
tabText: {
color: "#A8A3C2",
fontWeight: "900",
},
tabTextActive: {
color: "#EDE9FE",
},

searchInput: {
backgroundColor: "#18122B",
borderRadius: 14,
paddingHorizontal: 14,
paddingVertical: 10,
color: "#fff",
marginBottom: 16,
},

productRow: {
backgroundColor: "#18122B",
borderRadius: 14,
padding: 16,
marginBottom: 10,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},

productName: { color: "#fff", fontSize: 15, fontWeight: "700" },
productCategory: { color: "#9CA3AF", fontSize: 12 },
productPrice: { color: "#22C55E", fontWeight: "700", fontSize: 12 },

cartButton: {
position: "absolute",
bottom: 30,
right: 20,
width: 64,
height: 64,
borderRadius: 32,
backgroundColor: "#7C3AED",
justifyContent: "center",
alignItems: "center",
},

cartBadge: {
position: "absolute",
top: 6,
right: 7,
backgroundColor: "#F97316",
paddingHorizontal: 6,
paddingVertical: 1,
borderRadius: 10,
},

cartBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },

modalOverlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.55)",
justifyContent: "center",
padding: 20,
},

modalContent: {
backgroundColor: "#18122B",
borderRadius: 16,
padding: 20,
},

cartModalContent: {
backgroundColor: "#18122B",
borderRadius: 16,
padding: 20,
maxHeight: "85%",
width: "100%",
},

modalTitle: {
color: "#fff",
fontWeight: "900",
fontSize: 18,
},

input: {
backgroundColor: "#1E1838",
borderRadius: 10,
padding: 12,
marginBottom: 10,
color: "#fff",
},

bigBtn: {
backgroundColor: "#7C3AED",
borderRadius: 12,
paddingVertical: 14,
alignItems: "center",
},

bigBtnText: {
color: "#fff",
fontWeight: "700",
fontSize: 14,
},

cancelText: {
color: "#9CA3AF",
textAlign: "center",
},

cartRow: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 10,
},

cartAmount: {
color: "#22C55E",
fontWeight: "900",
},

cartTotalRow: {
flexDirection: "row",
justifyContent: "space-between",
borderTopWidth: 1,
borderTopColor: "#2D2450",
paddingTop: 14,
marginTop: 14,
},

cartTotalLabel: { color: "#E5E7EB", fontWeight: "900" },
cartTotalValue: { color: "#22C55E", fontWeight: "900" },

activeSupplierBanner: {
flexDirection: "row",
alignItems: "center",
backgroundColor: "#18122B",
borderRadius: 10,
padding: 10,
marginBottom: 8,
gap: 8,
},
activeSupplierText: { color: "#A78BFA", fontWeight: "700", fontSize: 13, flex: 1 },

supplierBlock: {
marginTop: 12,
backgroundColor: "#1E1838",
borderRadius: 14,
padding: 12,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
supplierLabel: {
color: "#EDE9FE",
fontWeight: "900",
marginBottom: 8,
},
supplierHint: {
color: "#A8A3C2",
marginTop: 4,
fontSize: 12,
fontWeight: "700",
},
supplierSelectBtn: {
flexDirection: "row",
alignItems: "center",
gap: 10,
padding: 12,
borderRadius: 14,
backgroundColor: "rgba(255,255,255,0.04)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
supplierSelected: {
color: "#fff",
fontWeight: "900",
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
fontWeight: "900",
},
chipTextActive: {
color: "#EDE9FE",
},

orderCard: {
backgroundColor: "#18122B",
borderRadius: 14,
padding: 16,
marginBottom: 10,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
},
orderRow: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
marginBottom: 8,
},
orderTitle: {
color: "#fff",
fontWeight: "900",
flex: 1,
},
orderSmall: {
color: "#A8A3C2",
fontSize: 12,
fontWeight: "700",
},
orderTotal: {
color: "#22C55E",
fontWeight: "900",
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

supplierModal: {
backgroundColor: "#18122B",
borderRadius: 16,
padding: 16,
width: "100%",
maxHeight: "85%",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
supplierModalHeader: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 10,
},
supplierModalTitle: {
color: "#fff",
fontWeight: "900",
fontSize: 16,
flex: 1,
},
iconBtn: {
width: 36,
height: 36,
borderRadius: 12,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
supplierSearch: {
marginTop: 12,
backgroundColor: "#1E1838",
borderRadius: 12,
paddingHorizontal: 12,
paddingVertical: 10,
color: "#fff",
},
supplierEmpty: {
marginTop: 12,
color: "#A8A3C2",
},
supplierRow: {
flexDirection: "row",
alignItems: "center",
gap: 10,
paddingVertical: 12,
paddingHorizontal: 12,
borderRadius: 14,
backgroundColor: "rgba(255,255,255,0.04)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.06)",
marginBottom: 8,
},
supplierRowActive: {
borderColor: "rgba(167,139,250,0.8)",
backgroundColor: "rgba(124,58,237,0.18)",
},
supplierRowTitle: {
color: "#fff",
fontWeight: "900",
},
supplierRowSmall: {
color: "#A8A3C2",
marginTop: 4,
fontSize: 12,
},
});
