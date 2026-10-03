// screens/SalesScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
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
Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { parseFrenchNumber, formatMoney } from "../../src/utils/parseFrenchNumber";
import AsyncStorage from "@react-native-async-storage/async-storage";

import API from "../../src/api/api";
import useSales, { Product } from "./useSales";
import useCloseDay from "./useCloseDay";

import OfflineBanner from "../../src/api/components/OfflineBanner";
import SyncIndicator from "../../src/api/components/SyncIndicator";

export default function SalesScreen() {
const navigation = useNavigation();

const {
loading,
filtered,
search,
cart,
cartTotal,
  selling,
  completedSales,
  dayActive,
  resetDayOpen,
  applySearch,
addToCart,
  increaseQty,
  decreaseQty,
  removeFromCart,
  setItemQty,
finalizeSale,
} = useSales();

const { dayModal, dayLoading, daySummary, closeDay, setDayModal } = useCloseDay();

const handleCloseModal = () => {
setDayModal(false);
resetDayOpen();
};

const [qty, setQty] = useState("1");
const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
const [cartModal, setCartModal] = useState(false);
const [editingQty, setEditingQty] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState("");
  const [selectedSellConfig, setSelectedSellConfig] = useState("");
  const [saleMsg, setSaleMsg] = useState<{ type: "success" | "offline" | "error"; text: string } | null>(null);
  const [hasSalesToday, setHasSalesToday] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const { data } = await API.get("/sales/today");
          const items = Array.isArray(data) ? data : data?.sales || [];
          if (mounted && items.length > 0) {
            setHasSalesToday(true);
          }
        } catch (e) { console.warn("check today sales", e); }
      })();
      return () => { mounted = false; };
    }, [])
  );

  // Rappel : journée auto-clôturée → proposer d'envoyer le bilan
  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem("voco_auto_closed");
        if (flag && flag !== "true") {
          // flag = reportId → ouvrir le bilan directement
          await AsyncStorage.removeItem("voco_auto_closed");
          navigation.navigate("ReportDetail", { reportId: flag });
        } else if (flag === "true") {
          await AsyncStorage.removeItem("voco_auto_closed");
          Alert.alert(
            "Journée clôturée",
            "La journée d'hier a été clôturée automatiquement.\nVoulez-vous envoyer le bilan au propriétaire ?",
            [
              { text: "Plus tard" },
              {
                text: "Voir le bilan",
                onPress: () => {
                  navigation.navigate("MyReports");
                },
              },
            ]
          );
        }
      } catch (_) { console.warn("auto-close flag", _); }
    })();
  }, []);

  const handleFinalize = async () => {
  Keyboard.dismiss();
  // Appliquer la quantite en cours d'edition AVANT de construire les items
  if (editingQty) {
    const n = parseFrenchNumber(editingQtyValue);
    if (n > 0) {
      setItemQty(editingQty, n);
    } else {
      setItemQty(editingQty, 0);
    }
    setEditingQty(null);
    setEditingQtyValue("");
  }
  // Lire le cart mis à jour via functional updater
  const items = cart.map((c) => ({
    productId: c.product._id,
    quantity: editingQty && c.product._id === editingQty
      ? (parseFrenchNumber(editingQtyValue) || c.qty)
      : c.qty,
  }));
const res = await finalizeSale(items);
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
      {(dayActive || hasSalesToday) && (hasSalesToday || completedSales > 0) && (
        <TouchableOpacity
          style={styles.endDayBtn}
          onPress={() =>
            Alert.alert(
              "Clôturer la journée",
              "Confirmer la clôture de la journée ?",
              [
                { text: "Annuler", style: "cancel" },
                { text: "Clôturer", style: "destructive", onPress: closeDay },
              ]
            )
          }
          disabled={dayLoading}
        >
          <Text style={styles.endDayBtnText}>
            {dayLoading ? "Clôture..." : "Terminer ma journée"}
          </Text>
        </TouchableOpacity>
      )}

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
            {formatMoney(item.sellPrice)} FCFA · Stock {item.quantity}
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

              {selectedProduct?.sellConfigs && selectedProduct.sellConfigs.length > 0 && (
                <>
                  <Text style={{ color: "#A8A3C2", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 4 }}>
                    Mode de vente
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    <TouchableOpacity
                      key="unite"
                      style={[styles.sellChip, !selectedSellConfig && styles.sellChipActive]}
                      onPress={() => setSelectedSellConfig("")}
                    >
                      <Text style={[styles.sellChipText, !selectedSellConfig && styles.sellChipTextActive]}>
                        Unité ({formatMoney(selectedProduct?.sellPrice || 0)} F)
                      </Text>
                    </TouchableOpacity>
                    {selectedProduct.sellConfigs.map((c, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.sellChip, selectedSellConfig === c.name && styles.sellChipActive]}
                        onPress={() => setSelectedSellConfig(c.name)}
                      >
                        <Text style={[styles.sellChipText, selectedSellConfig === c.name && styles.sellChipTextActive]}>
                          {c.name} ({c.quantity} × {c.quantity > 0 ? Math.round(c.sellPrice / c.quantity) : c.sellPrice} F)
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

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
                    let finalQty = parseFrenchNumber(qty);
                    let priceOverride: number | undefined;
                    if (selectedSellConfig && selectedProduct.sellConfigs) {
                      const cfg = selectedProduct.sellConfigs.find(c => c.name === selectedSellConfig);
                      if (cfg) {
                        finalQty = finalQty * cfg.quantity;
                        priceOverride = cfg.quantity > 0 ? cfg.sellPrice / cfg.quantity : cfg.sellPrice;
                      }
                    }
                    addToCart(selectedProduct, finalQty, priceOverride);
                  }
                  setSelectedProduct(null);
                  setSelectedSellConfig("");
                }}
              >
                <Text style={styles.btnText}>Ajouter au panier</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setSelectedProduct(null); setSelectedSellConfig(""); }}>
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
value={editingQtyValue}
onChangeText={setEditingQtyValue}
onBlur={() => {
  const n = parseFrenchNumber(editingQtyValue);
  setItemQty(item.product._id, n);
  setEditingQty(null);
}}
keyboardType="numeric"
style={styles.cartQtyInput}
autoFocus
/>
) : (
<TouchableOpacity onPress={() => {
  setEditingQty(item.product._id);
  setEditingQtyValue(String(item.qty));
}}>
<Text style={styles.cartQtyEdit}>{item.qty}</Text>
</TouchableOpacity>
)}

<Text style={styles.cartQtyLabel}>× {formatMoney(item.sellPrice ?? item.product.sellPrice)} FCFA</Text>

<Text style={styles.cartTotalLine}>= {formatMoney(item.total)} FCFA</Text>
</View>
</View>
))}
</ScrollView>

<Text style={styles.total}>Total : {formatMoney(cartTotal)} FCFA</Text>

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
<TouchableOpacity onPress={handleCloseModal}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>
<Text style={styles.modalHeaderTitle}>Bilan du jour</Text>
<View style={{ width: 26 }} />
</View>

{daySummary ? (
<>
<Text style={styles.summaryText}>Ventes : {daySummary.totalSales}</Text>
<Text style={styles.summaryText}>
Total : {formatMoney(daySummary.totalRevenue)} FCFA
</Text>
</>
) : (
<Text style={styles.summaryText}>Aucune vente</Text>
)}

<TouchableOpacity onPress={handleCloseModal}>
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  endDayBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
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
  sellChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sellChipActive: {
    backgroundColor: "rgba(167,139,250,0.15)",
    borderColor: "rgba(167,139,250,0.4)",
  },
  sellChipText: { color: "#A8A3C2", fontSize: 12, fontWeight: "600" },
  sellChipTextActive: { color: "#A78BFA" },

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