import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

interface Product {
  _id: string;
  name: string;
  category?: string;
  sellPrice: number;
}

interface Supplier {
  _id: string;
  name: string;
  phone?: string;
  phone2?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  category?: string;
  note?: string;
  isOnline?: boolean;
  isFavorite?: boolean;
}

export default function MesFournisseursScreen() {
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

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Supplier[]>([]);

  // add modal
  const [showAdd, setShowAdd] = useState(false);
  const [modalStep, setModalStep] = useState<"form" | "products">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // products for new supplier
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (query?: string) => {
      if (!canLoad) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await API.get("/suppliers", {
          headers,
          params: { q: (query ?? debouncedQ).trim() },
        });
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.log("❌ MesFournisseurs load error:", e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [canLoad, headers, debouncedQ]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load(debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loadAllProducts = useCallback(async () => {
    if (!canLoad) return;
    try {
      setLoadingProducts(true);
      const res = await API.get("/products", { headers, params: { limit: 500 } });
      const data: any = res.data;
      const list: Product[] = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];
      setAllProducts(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.log("❌ loadAllProducts error:", e);
    } finally {
      setLoadingProducts(false);
    }
  }, [canLoad, headers]);

  const resetForm = useCallback(() => {
    setName("");
    setPhone("");
    setWhatsapp("");
    setNote("");
    setSelectedProductIds(new Set());
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowAdd(true);
    loadAllProducts();
  }, [resetForm, loadAllProducts]);

  const closeAddModal = useCallback(() => {
    setShowAdd(false);
  }, []);

  const toggleProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const saveSupplier = useCallback(async () => {
    const n = name.trim();
    if (!n) return Alert.alert("Erreur", "Nom du fournisseur requis");
    if (!canLoad) return Alert.alert("Erreur", "Session invalide. Reconnecte-toi.");

    try {
      setSaving(true);
      const res = await API.post(
        "/suppliers",
        {
          name: n,
          phone: phone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          note: note.trim() || undefined,
        },
        { headers }
      );
      const newSupplier: any = res.data;
      const newId = newSupplier?._id;
      if (newId && selectedProductIds.size > 0) {
        await Promise.all(
          Array.from(selectedProductIds).map((pid) =>
            API.patch(`/products/${pid}`, { supplierId: newId }, { headers })
          )
        );
      }
      closeAddModal();
      resetForm();
      await load();
    } catch (e: any) {
      console.log("❌ create supplier error:", e?.response?.data || e);
      Alert.alert("Erreur", e?.response?.data?.error || "Impossible d'ajouter le fournisseur.");
    } finally {
      setSaving(false);
    }
  }, [name, phone, whatsapp, note, canLoad, headers, closeAddModal, resetForm, load, selectedProductIds]);

  const openSupplier = (s: Supplier) => {
    navigation.navigate("SupplierDetail", { supplierId: s._id });
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts;
    const q = productSearch.trim().toLowerCase();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
  }, [allProducts, productSearch]);

  const clearSearch = useCallback(() => {
    setQ("");
    load("");
  }, [load]);

  const renderItem = ({ item }: { item: Supplier }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openSupplier(item)}>
      <View style={styles.cardLeft}>
        <View style={[styles.statusDot, { backgroundColor: item.isOnline ? "#34D399" : "#4B5563" }]} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.titleName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isFavorite && <Ionicons name="star" size={14} color="#FBBF24" />}
          </View>
          {!!item.phone && <Text style={styles.small}>📞 {item.phone}</Text>}
          {!!item.whatsapp && <Text style={styles.small}>🟢 {item.whatsapp}</Text>}
          {(item.city || item.category) && (
            <Text style={styles.small}>
              {[item.city, item.category].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes fournisseurs</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          placeholder="Rechercher un fournisseur..."
          placeholderTextColor="#6B7280"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => load(q)}
          style={styles.search}
          returnKeyType="search"
        />
        {!!q && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color="#EDE9FE" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 20 }} />
      ) : items.length === 0 ? (
        <View style={{ marginTop: 30, alignItems: "center" }}>
          <Ionicons name="people-outline" size={34} color="#A8A3C2" />
          <Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>
            Aucun fournisseur
          </Text>
          <Text style={{ color: "#A8A3C2", marginTop: 6, textAlign: "center" }}>
            Ajoute ton premier fournisseur avec le bouton +
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={closeAddModal}>
        {modalStep === "form" ? (
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouveau fournisseur</Text>
                <TouchableOpacity onPress={closeAddModal}>
                  <Ionicons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Nom"
                placeholderTextColor="#777"
                style={styles.input}
                value={name}
                onChangeText={setName}
              />
              <TextInput
                placeholder="Téléphone"
                placeholderTextColor="#777"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                placeholder="WhatsApp (optionnel)"
                placeholderTextColor="#777"
                style={styles.input}
                value={whatsapp}
                onChangeText={setWhatsapp}
                keyboardType="phone-pad"
              />
              <TextInput
                placeholder="Note (optionnel)"
                placeholderTextColor="#777"
                style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                multiline
                value={note}
                onChangeText={setNote}
              />

              <TouchableOpacity
                style={styles.productToggle}
                onPress={() => setModalStep("products")}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Ionicons name="cube-outline" size={18} color="#A78BFA" />
                  <Text style={styles.productToggleText}>Produits fournis</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {selectedProductIds.size > 0 && (
                    <Text style={styles.selectedCount}>{selectedProductIds.size}</Text>
                  )}
                  <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bigBtn, { opacity: saving ? 0.7 : 1 }]}
                onPress={saveSupplier}
                activeOpacity={0.9}
                disabled={saving}
              >
                <Text style={styles.bigBtnText}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 10 }} onPress={closeAddModal}>
                <Text style={styles.cancel}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setModalStep("form")}>
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Produits fournis</Text>
                <TouchableOpacity onPress={closeAddModal}>
                  <Ionicons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {loadingProducts && allProducts.length === 0 ? (
                <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 30 }} />
              ) : allProducts.length === 0 ? (
                <View style={{ marginTop: 30, alignItems: "center" }}>
                  <Ionicons name="cube-outline" size={34} color="#A8A3C2" />
                  <Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>Aucun produit</Text>
                  <Text style={{ color: "#A8A3C2", marginTop: 6, textAlign: "center" }}>
                    Crée d'abord des produits dans l'inventaire
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.pickerSearchWrap}>
                    <Ionicons name="search" size={16} color="#6B7280" />
                    <TextInput
                      placeholder="Rechercher..."
                      placeholderTextColor="#6B7280"
                      value={productSearch}
                      onChangeText={setProductSearch}
                      style={styles.pickerSearch}
                    />
                    {!!productSearch && (
                      <TouchableOpacity onPress={() => setProductSearch("")}>
                        <Ionicons name="close-circle" size={18} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    data={filteredProducts}
                    keyExtractor={(i) => i._id}
                    renderItem={({ item }) => {
                      const isSelected = selectedProductIds.has(item._id);
                      return (
                        <TouchableOpacity
                          style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                          onPress={() => toggleProduct(item._id)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                            {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </View>
                          <Text style={styles.pickerRowName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.pickerRowPrice}>{item.sellPrice?.toLocaleString()} FCFA</Text>
                        </TouchableOpacity>
                      );
                    }}
                    contentContainerStyle={{ paddingBottom: 20 }}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.doneBtn, { opacity: loadingProducts ? 0.7 : 1 }]}
                onPress={() => setModalStep("form")}
                activeOpacity={0.9}
              >
                <Text style={styles.doneBtnText}>
                  OK ({selectedProductIds.size} sélectionné{selectedProductIds.size > 1 ? "s" : ""})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 60, paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900", flex: 1, textAlign: "center" },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: { position: "relative", marginTop: 14, marginBottom: 14 },
  search: {
    backgroundColor: "#18122B",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingRight: 44,
    color: "#fff",
  },
  clearBtn: {
    position: "absolute",
    right: 10,
    top: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,58,237,0.25)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  card: {
    backgroundColor: "#18122B",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  titleName: { color: "#fff", fontWeight: "900", fontSize: 15 },
  small: { color: "#A8A3C2", fontSize: 12, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modal: { backgroundColor: "#18122B", borderRadius: 16, padding: 16, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { color: "#fff", fontWeight: "900", fontSize: 18 },
  productToggle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1838",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  productToggleText: { color: "#A78BFA", fontWeight: "700", fontSize: 13 },
  emptyProducts: { color: "#6B7280", fontSize: 12, fontStyle: "italic", marginBottom: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  selectedCount: {
    backgroundColor: "#059669",
    color: "#fff",
    fontWeight: "900",
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  pickerContent: {
    backgroundColor: "#18122B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pickerTitle: { color: "#fff", fontWeight: "900", fontSize: 17 },
  pickerSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1838",
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  pickerSearch: { flex: 1, paddingVertical: 10, color: "#fff", fontSize: 13 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1838",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  pickerRowSelected: { backgroundColor: "rgba(16,185,129,0.1)" },
  pickerRowName: { color: "#E5E7EB", fontWeight: "700", fontSize: 13, flex: 1 },
  pickerRowPrice: { color: "#9CA3AF", fontSize: 12 },
  doneBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  doneBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
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
  bigBtnText: { color: "#fff", fontWeight: "900" },
  cancel: { color: "#9CA3AF", textAlign: "center" },
});
