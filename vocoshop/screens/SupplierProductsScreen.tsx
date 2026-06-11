import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

interface Product {
  _id: string;
  name: string;
  category?: string;
  sellPrice: number;
}

export default function SupplierProductsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { supplierId, supplierName } = route.params || {};

  const { token, storeId } = useContext(AuthContext);

  const headers = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : "",
      "x-store-id": storeId || "",
    }),
    [token, storeId]
  );

  const canLoad = !!token && !!storeId && !!supplierId;

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [supplierProductIds, setSupplierProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!canLoad) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [allRes, supRes] = await Promise.all([
        API.get("/products", { headers, params: { limit: 500 } }),
        API.get(`/products/by-supplier/${supplierId}`, { headers }),
      ]);
      const data: any = allRes.data;
      const all = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];
      const supData: any = supRes.data;
      const sup = Array.isArray(supData) ? supData : [];
      setAllProducts(all);
      setSupplierProductIds(new Set(sup.map((p: Product) => p._id)));
    } catch (e) {
      console.log("❌ SupplierProducts load error:", e);
    } finally {
      setLoading(false);
    }
  }, [canLoad, headers, supplierId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleProduct = useCallback(
    async (productId: string, currentlyAssigned: boolean) => {
      try {
        setSaving(true);
        if (currentlyAssigned) {
          await API.patch(`/products/${productId}`, { supplierId: null }, { headers });
          setSupplierProductIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        } else {
          await API.patch(`/products/${productId}`, { supplierId }, { headers });
          setSupplierProductIds((prev) => {
            const next = new Set(prev);
            next.add(productId);
            return next;
          });
        }
      } catch (e: any) {
        console.log("❌ toggleProduct error:", e?.response?.data || e);
        Alert.alert("Erreur", "Impossible de modifier le produit.");
      } finally {
        setSaving(false);
      }
    },
    [headers, supplierId]
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return allProducts;
    const query = q.trim().toLowerCase();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.category || "").toLowerCase().includes(query)
    );
  }, [allProducts, q]);

  const renderItem = ({ item }: { item: Product }) => {
    const assigned = supplierProductIds.has(item._id);
    return (
      <TouchableOpacity
        style={[styles.row, assigned && styles.rowActive]}
        activeOpacity={0.8}
        onPress={() => toggleProduct(item._id, assigned)}
        disabled={saving}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.checkbox, assigned && styles.checkboxActive]}>
            {assigned && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>{item.name}</Text>
            {item.category ? <Text style={styles.rowCat}>{item.category}</Text> : null}
          </View>
        </View>
        <Text style={styles.rowPrice}>{item.sellPrice?.toLocaleString()} FCFA</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Produits fournis</Text>
          <Text style={styles.headerSub}>
            {supplierName || "Fournisseur"} · {supplierProductIds.size} produit{supplierProductIds.size > 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#6B7280" />
        <TextInput
          placeholder="Rechercher un produit..."
          placeholderTextColor="#6B7280"
          value={q}
          onChangeText={setQ}
          style={styles.search}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={18} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 30 }} />
      ) : filtered.length === 0 ? (
        <View style={{ marginTop: 30, alignItems: "center" }}>
          <Ionicons name="cube-outline" size={34} color="#A8A3C2" />
          <Text style={{ color: "#fff", fontWeight: "900", marginTop: 10 }}>
            {q.trim() ? "Aucun résultat" : "Aucun produit"}
          </Text>
          <Text style={{ color: "#A8A3C2", marginTop: 6, textAlign: "center" }}>
            {q.trim()
              ? "Essaie un autre mot-clé"
              : "Ajoute d'abord des produits dans ton inventaire"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 60, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  headerSub: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18122B",
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  search: { flex: 1, paddingVertical: 10, color: "#fff", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18122B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowActive: { borderColor: "rgba(16,185,129,0.4)" },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#4B5563",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  rowName: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rowCat: { color: "#9CA3AF", fontSize: 11, marginTop: 2 },
  rowPrice: { color: "#A78BFA", fontSize: 12, fontWeight: "600" },
});
