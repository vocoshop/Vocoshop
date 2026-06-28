// screens/SalesScreen.tsx
import React, { useState } from "react";
import {
View,
Text,
ScrollView,
TouchableOpacity,
TextInput,
Modal,
ActivityIndicator,
StyleSheet,
FlatList,
Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import useSales, { Product } from "./useSales";
import useCloseDay from "./useCloseDay";

import OfflineBanner from "../../src/api/components/OfflineBanner";
import SyncIndicator from "../../src/api/components/SyncIndicator";

export default function SalesScreen() {
const navigation = useNavigation<any>();

const {
loading,
filtered,
search,
cart,
cartTotal,
selling,
applySearch,
addToCart,
  increaseQty,
  decreaseQty,
  removeFromCart,
  setItemQty,
finalizeSale,
} = useSales();

const { dayModal, dayLoading, daySummary, closeDay, setDayModal } = useCloseDay();

const [qty, setQty] = useState("1");
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
const [cartModal, setCartModal] = useState(false);
const [editingQty, setEditingQty] = useState<string | null>(null);
const [saleMsg, setSaleMsg] = useState<{ type: "success" | "offline" | "error"; text: string } | null>(null);

const handleFinalize = async () => {
const res = await finalizeSale();
if (res === "success") {
  setSaleMsg({ type: "success", text: "Vente enregistrée" });
  setCartModal(false);
  setTimeout(() => setSaleMsg(null), 2000);
} else if (res === "offline") {
  setSaleMsg({ type: "offline", text: "Vente enregistrée hors-ligne" });
  setCartModal(false);
  setTimeout(() => setSaleMsg(null), 3000);
} else {
  setSaleMsg({ type: "error", text: "Erreur lors de la vente" });
  setTimeout(() => setSaleMsg(null), 2500);
}
};

/* ================= LOADING ================= */
if (loading) {
return (
<View style={styles.container}>
    <SyncIndicator />
<OfflineBanner />
{/* HEADER */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Ventes</Text>

<View style={{ width: 26 }} />
</View>

<View style={styles.center}>
<ActivityIndicator size="large" color="#A78BFA" />
</View>
</View>
);
}

return (
<View style={styles.container}>
{/* ================= HEADER (avec retour) ================= */}
<View style={styles.headerRow}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Ventes</Text>

{/* Refresh optionnel (safe) */}
<TouchableOpacity
onPress={() => applySearch(search)}
activeOpacity={0.7}
>
<Ionicons name="refresh" size={22} color="#A8A3C2" />
</TouchableOpacity>
</View>

{/* ================= SEARCH ================= */}
<TextInput
placeholder="Rechercher un produit"
placeholderTextColor="#777"
value={search}
onChangeText={applySearch}
style={styles.search}
/>

{/* ================= SALE TOAST ================= */}
{saleMsg && (
<View style={[styles.toast, saleMsg.type === "success" && styles.toastSuccess, saleMsg.type === "offline" && styles.toastOffline, saleMsg.type === "error" && styles.toastError]}>
  <Ionicons
    name={saleMsg.type === "success" ? "checkmark-circle" : saleMsg.type === "offline" ? "cloud-done" : "alert-circle"}
    size={18}
    color="#fff"
  />
  <Text style={styles.toastText}>{saleMsg.text}</Text>
</View>
)}

{/* ================= CLOSE DAY ================= */}
<TouchableOpacity
style={styles.endDayBtn}
onPress={closeDay}
disabled={dayLoading}
>
<Text style={styles.endDayBtnText}>
{dayLoading ? "Clôture..." : "Terminer ma journée"}
</Text>
</TouchableOpacity>

  {/* ================= PRODUCTS (FlatList virtualisé) ================= */}
  <FlatList
    data={filtered}
    keyExtractor={(item) => item._id}
    initialNumToRender={15}
    maxToRenderPerBatch={10}
    windowSize={5}
    removeClippedSubviews={true}
    contentContainerStyle={{ paddingBottom: 120 }}
    renderItem={({ item }) => (
      <TouchableOpacity
        style={styles.productRow}
        activeOpacity={0.85}
        onPress={() => addToCart(item, 1)}
        onLongPress={() => {
          setSelectedProduct(item);
          setQty("1");
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productPrice}>
            {item.sellPrice} FCFA · Stock {item.quantity}
          </Text>
        </View>
        <Text style={styles.quickBadge}>+</Text>
      </TouchableOpacity>
    )}
    ListEmptyComponent={
      <Text style={styles.emptyText}>Aucun produit trouvé</Text>
    }
  />

  {/* ================= CART BOTTOM BAR ================= */}
  {cart.length > 0 && (
    <TouchableOpacity
      style={styles.cartBar}
      onPress={() => setCartModal(true)}
      activeOpacity={0.9}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        <Ionicons name="cart" size={22} color="#fff" />
        <Text style={styles.cartBarText}>
          {cart.length} article{cart.length > 1 ? "s" : ""}
        </Text>
      </View>
      <Text style={styles.cartBarTotal}>{cartTotal} FCFA</Text>
      <View style={styles.cartBarBtn}>
        <Text style={styles.cartBarBtnText}>Vendre</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </View>
    </TouchableOpacity>
  )}

{/* ================= QTY MODAL ================= */}
<Modal visible={!!selectedProduct} transparent animationType="fade">
<View style={styles.overlay}>
<View style={styles.qtyModal}>
<Text style={styles.modalTitle}>{selectedProduct?.name}</Text>

<TextInput
value={qty}
onChangeText={setQty}
keyboardType="numeric"
placeholder="Quantité"
placeholderTextColor="#777"
style={styles.qtyInput}
/>

<TouchableOpacity
style={styles.primaryBtn}
onPress={() => {
if (selectedProduct) {
addToCart(selectedProduct, Number(qty));
}
setSelectedProduct(null);
}}
>
<Text style={styles.btnText}>Ajouter au panier</Text>
</TouchableOpacity>

<TouchableOpacity onPress={() => setSelectedProduct(null)}>
<Text style={styles.link}>Annuler</Text>
</TouchableOpacity>
</View>
</View>
</Modal>

{/* ================= CART MODAL ================= */}
<Modal visible={cartModal} animationType="slide">
<View style={styles.modal}>
{/* Header modal panier */}
<View style={styles.modalHeaderRow}>
<TouchableOpacity onPress={() => setCartModal(false)}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.modalHeaderTitle}>Panier</Text>
<View style={{ width: 26 }} />
</View>

<ScrollView>
{cart.map((item) => (
<View key={item.product._id} style={styles.cartLine}>
<View style={styles.cartLineTop}>
<Text style={styles.cartName}>{item.product.name}</Text>
<TouchableOpacity
onPress={() => {
Alert.alert(
"Retirer du panier",
`Supprimer "${item.product.name}" ?`,
[
{ text: "Annuler", style: "cancel" },
{
text: "Supprimer",
style: "destructive",
onPress: () => removeFromCart(item.product._id),
},
]
);
}}
activeOpacity={0.8}
hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
<Ionicons name="trash-outline" size={20} color="#EF4444" />
</TouchableOpacity>
</View>

<View style={styles.cartLineBottom}>
{editingQty === item.product._id ? (
<TextInput
value={String(item.qty)}
onChangeText={(v) => {
const n = parseInt(v, 10);
if (!isNaN(n)) setItemQty(item.product._id, n);
}}
onBlur={() => setEditingQty(null)}
keyboardType="numeric"
style={styles.cartQtyInput}
autoFocus
/>
) : (
<TouchableOpacity onPress={() => setEditingQty(item.product._id)}>
<Text style={styles.cartQtyEdit}>{item.qty}</Text>
</TouchableOpacity>
)}

<Text style={styles.cartQtyLabel}>× {item.product.sellPrice} FCFA</Text>

<Text style={styles.cartTotalLine}>= {item.total} FCFA</Text>
</View>
</View>
))}
</ScrollView>

<Text style={styles.total}>Total : {cartTotal} FCFA</Text>

  <TouchableOpacity
    style={[styles.primaryBtn, selling && { opacity: 0.6 }]}
    onPress={handleFinalize}
    disabled={selling}
  >
    {selling ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <Text style={styles.btnText}>Valider la vente</Text>
    )}
  </TouchableOpacity>

<TouchableOpacity onPress={() => setCartModal(false)}>
<Text style={styles.link}>Fermer</Text>
</TouchableOpacity>
</View>
</Modal>

{/* ================= DAY MODAL ================= */}
<Modal visible={dayModal} animationType="slide">
<View style={styles.modal}>
{/* Header modal bilan */}
<View style={styles.modalHeaderRow}>
<TouchableOpacity onPress={() => setDayModal(false)}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.modalHeaderTitle}>Bilan du jour</Text>
<View style={{ width: 26 }} />
</View>

{daySummary ? (
<>
<Text style={styles.summaryText}>Ventes : {daySummary.totalSales}</Text>
<Text style={styles.summaryText}>
Total : {daySummary.totalRevenue} FCFA
</Text>
</>
) : (
<Text style={styles.summaryText}>Aucune vente</Text>
)}

<TouchableOpacity onPress={() => setDayModal(false)}>
<Text style={styles.link}>Fermer</Text>
</TouchableOpacity>
</View>
</Modal>
</View>
);
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
padding: 20,
paddingTop: 60,
},

/* Header */
headerRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginBottom: 14,
},
headerTitle: {
color: "#fff",
fontSize: 22,
fontWeight: "900",
},

center: {
flex: 1,
justifyContent: "center",
alignItems: "center",
},

search: {
backgroundColor: "#161228",
borderRadius: 10,
padding: 12,
color: "#fff",
marginBottom: 12,
},

endDayBtn: {
backgroundColor: "#7C3AED",
padding: 14,
borderRadius: 10,
alignItems: "center",
marginBottom: 16,
},
endDayBtnText: {
color: "#fff",
fontWeight: "700",
},

productRow: {
backgroundColor: "#161228",
padding: 14,
borderRadius: 10,
marginBottom: 10,
flexDirection: "row",
alignItems: "center",
},
productName: {
color: "#fff",
fontWeight: "700",
flex: 1,
},
productPrice: {
color: "#9CA3AF",
fontSize: 12,
},
quickBadge: {
color: "#7C3AED",
fontSize: 20,
fontWeight: "700",
marginLeft: 8,
},
cartBar: {
position: "absolute",
bottom: 20,
left: 20,
right: 20,
backgroundColor: "#1E1838",
borderRadius: 14,
padding: 14,
flexDirection: "row",
alignItems: "center",
borderWidth: 1,
borderColor: "rgba(124,58,237,0.3)",
},
cartBarText: {
color: "#fff",
fontWeight: "600",
fontSize: 14,
},
cartBarTotal: {
color: "#A78BFA",
fontWeight: "800",
fontSize: 15,
marginRight: 10,
},
cartBarBtn: {
backgroundColor: "#7C3AED",
paddingHorizontal: 14,
paddingVertical: 8,
borderRadius: 10,
flexDirection: "row",
alignItems: "center",
gap: 4,
},
cartBarBtnText: {
color: "#fff",
fontWeight: "700",
fontSize: 13,
},

cartBtn: {
position: "absolute",
bottom: 30,
right: 30,
backgroundColor: "#7C3AED",
padding: 16,
borderRadius: 50,
flexDirection: "row",
gap: 6,
alignItems: "center",
justifyContent: "center",
},
cartText: {
color: "#fff",
fontWeight: "700",
},

overlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.7)",
justifyContent: "center",
padding: 20,
},
qtyModal: {
backgroundColor: "#1E1638",
borderRadius: 14,
padding: 20,
},
qtyInput: {
backgroundColor: "#2D2547",
color: "#fff",
padding: 12,
borderRadius: 10,
marginVertical: 12,
},

modal: {
flex: 1,
backgroundColor: "#0A0617",
padding: 20,
paddingTop: 60,
},

modalHeaderRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginBottom: 12,
},
modalHeaderTitle: {
color: "#fff",
fontSize: 20,
fontWeight: "900",
},

modalTitle: {
color: "#fff",
fontSize: 20,
fontWeight: "800",
marginBottom: 12,
},

cartLine: {
backgroundColor: "#161228",
padding: 12,
borderRadius: 10,
marginBottom: 10,
},
cartLineTop: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
marginBottom: 8,
},
cartName: {
color: "#fff",
fontWeight: "700",
flex: 1,
},
cartLineBottom: {
flexDirection: "row",
alignItems: "center",
gap: 6,
},
cartQtyEdit: {
color: "#A78BFA",
fontSize: 18,
fontWeight: "800",
backgroundColor: "#2D2547",
paddingHorizontal: 12,
paddingVertical: 4,
borderRadius: 8,
overflow: "hidden",
minWidth: 40,
textAlign: "center",
},
cartQtyInput: {
backgroundColor: "#2D2547",
color: "#A78BFA",
fontSize: 18,
fontWeight: "800",
paddingHorizontal: 12,
paddingVertical: 4,
borderRadius: 8,
minWidth: 50,
textAlign: "center",
},
cartQtyLabel: {
color: "#9CA3AF",
fontSize: 13,
},
cartTotalLine: {
color: "#A78BFA",
fontWeight: "700",
fontSize: 14,
marginLeft: "auto",
},
total: {
color: "#fff",
fontWeight: "800",
marginVertical: 14,
},

primaryBtn: {
backgroundColor: "#7C3AED",
padding: 14,
borderRadius: 10,
alignItems: "center",
marginTop: 10,
},
btnText: {
color: "#fff",
fontWeight: "700",
},
link: {
color: "#A78BFA",
marginTop: 16,
textAlign: "center",
},
summaryText: {
color: "#fff",
marginBottom: 8,
},
emptyText: {
color: "#777",
textAlign: "center",
marginTop: 40,
fontSize: 14,
},
toast: {
flexDirection: "row",
alignItems: "center",
gap: 8,
paddingVertical: 10,
paddingHorizontal: 14,
borderRadius: 10,
marginBottom: 12,
},
toastSuccess: {
backgroundColor: "#166534",
},
toastOffline: {
backgroundColor: "#854D0E",
},
toastError: {
backgroundColor: "#991B1B",
},
toastText: {
color: "#fff",
fontSize: 13,
fontWeight: "600",
},
});