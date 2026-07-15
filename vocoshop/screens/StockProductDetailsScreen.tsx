// screens/StockProductDetailsScreen.tsx
import React, { useState, useContext, useEffect, useMemo, useCallback } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
Alert,
ActivityIndicator,
ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

// ✅ OFFLINE
// ⚠️ adapte les chemins si besoin
import { runOrQueue } from "../src/api/offline/queue";
import { isOffline } from "../src/api/utils/network";

type PurchaseConfig = {
  name: string;
  quantity: number;
  purchasePrice: number;
};

type Product = {
  _id: string;
  name: string;
  category?: string;
  quantity?: number;
  expirationDates?: string[];
  baseUnit?: string;
  unit?: string;
  purchaseConfigs?: PurchaseConfig[];
};

function isValidYYYYMMDD(v: string) {
if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
const d = new Date(v);
if (Number.isNaN(d.getTime())) return false;

const [y, m, day] = v.split("-").map(Number);
return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

function formatDateFR(v?: string | null) {
if (!v) return "-";
const d = new Date(v);
if (Number.isNaN(d.getTime())) return "-";
return d.toLocaleDateString("fr-FR");
}

function getNearestExpiry(expirationDates?: string[]) {
if (!Array.isArray(expirationDates) || expirationDates.length === 0) return null;

const now = Date.now();
const valid = expirationDates
.map((x) => {
const t = new Date(x).getTime();
return Number.isNaN(t) ? null : t;
})
.filter((t): t is number => t !== null);

if (valid.length === 0) return null;

const future = valid.filter((t) => t >= now).sort((a, b) => a - b);
if (future.length > 0) return new Date(future[0]).toISOString();

valid.sort((a, b) => b - a);
return new Date(valid[0]).toISOString();
}

export default function StockProductDetailsScreen({ route, navigation }: any) {
const { product, productId } = (route?.params || {}) as {
product?: Product;
productId?: string;
};

const realId = productId || product?._id;
const { token } = useContext(AuthContext);

  const [currentProduct, setCurrentProduct] = useState<Product | null>(product || null);
  const [quantity, setQuantity] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<PurchaseConfig | null>(null);

  const purchaseConfigs: PurchaseConfig[] = currentProduct?.purchaseConfigs || [];
  const hasConfigs = purchaseConfigs.length > 0;
  const baseUnit = currentProduct?.baseUnit || currentProduct?.unit || "pièce";

  // Auto-select first config on mount
  useEffect(() => {
    if (hasConfigs && !selectedConfig) {
      setSelectedConfig(purchaseConfigs[0]);
    }
  }, [hasConfigs]);

  const effectiveQty = selectedConfig
    ? Number(quantity || 0) * selectedConfig.quantity
    : Number(quantity || 0);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
}),
[token]
);

const displayedProduct =
currentProduct ||
product ||
({ _id: realId || "", name: "Produit", quantity: 0 } as Product);

const currentStock = displayedProduct.quantity ?? 0;
const nearestExpiry = getNearestExpiry(displayedProduct.expirationDates);

const canLoad = Boolean(token && realId);

// ================================
// Charger le produit depuis l’API (ONLINE)
// ================================
const loadProduct = useCallback(async () => {
if (!canLoad) return;

// si offline, pas la peine de taper API
if (isOffline()) return;

try {
setLoading(true);
const res = await API.get(`/products/${realId}`, { headers });
setCurrentProduct(res.data as Product);
} catch (error: any) {
console.log("❌ Erreur loadProduct :", error?.response?.status, error?.response?.data || error);
Alert.alert("Erreur", "Impossible de charger le produit mis à jour.");
} finally {
setLoading(false);
}
}, [canLoad, headers, realId]);

useEffect(() => {
loadProduct();
}, [loadProduct]);

// ================================
// Optimistic update local (quand offline)
// ================================
const applyOptimisticLocal = useCallback(
(qty: number, exp?: string) => {
setCurrentProduct((prev) => {
const base = prev || displayedProduct;
const beforeQty = Number(base?.quantity ?? 0);
const nextQty = beforeQty + qty;

let nextExp = Array.isArray(base.expirationDates) ? [...base.expirationDates] : [];
if (exp && exp.trim().length > 0) {
// on stocke en ISO (ou format brut) — on garde simple
// si ton backend attend YYYY-MM-DD, on garde la valeur brute
nextExp.unshift(exp.trim());
}

return {
...base,
quantity: nextQty,
expirationDates: nextExp,
};
});
},
[displayedProduct]
);

// ================================
// Ajouter du stock (+ offline queue)
// ================================
  const submitAddStock = async () => {
    const rawQty = Number(quantity);

    if (!token) return Alert.alert("Erreur", "Session invalide. Reconnectez-vous.");
    if (!realId) return Alert.alert("Erreur", "Produit introuvable (ID manquant).");

    if (!quantity || Number.isNaN(rawQty) || rawQty <= 0) {
      return Alert.alert("Erreur", "Veuillez entrer une quantité valide.");
    }

    const qty = effectiveQty; // déjà converti en unité de base

    const exp = expirationDate.trim();
if (exp.length > 0 && !isValidYYYYMMDD(exp)) {
return Alert.alert("Erreur", "Date invalide. Format YYYY-MM-DD (ex: 2026-01-31).");
}

setLoading(true);

try {
const body: any = {
productId: realId,
quantity: qty,
...(exp.length > 0 ? { expirationDate: exp } : {}),
};

// ✅ OFFLINE AWARE
const result = await runOrQueue({
title: "Ajout stock",
method: "POST",
url: "/stocks/add",
body,
headers,
});

// ✅ reset inputs
setQuantity("");
setExpirationDate("");

if (result.mode === "offline") {
// optimistic UI
applyOptimisticLocal(qty, exp);

Alert.alert(
"Hors-ligne ✅",
"Stock enregistré en hors-ligne. La synchronisation se fera automatiquement dès le retour Internet."
);

// revenir comme d’habitude
if (navigation.canGoBack()) navigation.goBack();
else navigation.navigate("AddStock", { refresh: Date.now() });
return;
}

// ONLINE OK
Alert.alert("Succès", "Stock ajouté avec succès !");
await loadProduct();

if (navigation.canGoBack()) navigation.goBack();
else navigation.navigate("AddStock", { refresh: Date.now() });
} catch (e: any) {
console.log("❌ Erreur ajout stock :", e?.response?.status, e?.response?.data || e);
Alert.alert(
"Erreur",
e?.response?.data?.error ||
e?.response?.data?.message ||
e?.message ||
"Impossible d’ajouter le stock."
);
} finally {
setLoading(false);
}
};

const offlineNow = isOffline();

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {displayedProduct.name}
        </Text>
      </View>

      {/* OFFLINE BANNER */}
      {offlineNow && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color="#FACC15" />
          <Text style={styles.offlineText}>Mode hors-ligne : les actions seront synchronisees</Text>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <ActivityIndicator size="small" color="#8A4DFF" style={{ marginBottom: 16 }} />
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Infos produit */}
        <Text style={styles.label}>Categorie</Text>
        <Text style={styles.value}>{displayedProduct.category || "Non definie"}</Text>

        <Text style={styles.label}>Stock actuel</Text>
        <Text style={styles.value}>{currentStock}</Text>

        {/* Expiration */}
        <Text style={styles.label}>Prochaine date d'expiration</Text>
        <Text style={styles.value}>{formatDateFR(nearestExpiry)}</Text>

        <Text style={styles.label}>Nombre de dates enregistrees</Text>
        <Text style={styles.value}>
          {Array.isArray(displayedProduct.expirationDates) ? displayedProduct.expirationDates.length : 0}
        </Text>

        {/* Ajouter du stock */}
        <Text style={[styles.label, { marginTop: 22 }]}>Ajouter du stock</Text>

        {hasConfigs && (
          <>
            <Text style={styles.subLabel}>Conditionnement d'achat</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {purchaseConfigs.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.configChip, selectedConfig?.name === c.name && styles.configChipActive]}
                  onPress={() => setSelectedConfig(c)}
                >
                  <Text style={[styles.configChipText, selectedConfig?.name === c.name && styles.configChipTextActive]}>
                    {c.name} ({c.quantity} {baseUnit}s)
                  </Text>
                  {c.purchasePrice > 0 && (
                    <Text style={[styles.configChipSub, selectedConfig?.name === c.name && styles.configChipTextActive]}>
                      {c.purchasePrice.toLocaleString()} FCFA
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <TextInput
          placeholder={hasConfigs && selectedConfig ? `Nombre de ${selectedConfig.name.toLowerCase()}s` : "Ex: 10"}
          placeholderTextColor="#777"
          keyboardType="numeric"
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
        />

        {hasConfigs && selectedConfig && Number(quantity) > 0 && (
          <Text style={styles.conversionText}>
            = {effectiveQty} {baseUnit}s (total stock ajouté)
          </Text>
        )}

        {/* Date d'expiration */}
        <Text style={[styles.label, { marginTop: 12 }]}>Date d'expiration (optionnel)</Text>
        <TextInput
          placeholder="YYYY-MM-DD (ex: 2026-01-31)"
          placeholderTextColor="#777"
          style={styles.input}
          value={expirationDate}
          onChangeText={setExpirationDate}
          autoCapitalize="none"
        />
      </ScrollView>

      {/* FIXED FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, loading ? { opacity: 0.7 } : null]}
          onPress={submitAddStock}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? "Enregistrement..." : "Enregistrer"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", padding: 20, paddingTop: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
backBtn: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
marginRight: 15,
},
title: { color: "#fff", fontSize: 22, fontWeight: "800", flex: 1 },

offlineBanner: {
flexDirection: "row",
alignItems: "center",
gap: 8,
backgroundColor: "rgba(250, 204, 21, 0.10)",
borderWidth: 1,
borderColor: "rgba(250, 204, 21, 0.22)",
paddingVertical: 10,
paddingHorizontal: 12,
borderRadius: 12,
marginBottom: 14,
},
offlineText: { color: "#E5E7EB", fontWeight: "800", fontSize: 12, flex: 1 },

label: { color: "#999", marginTop: 10, fontSize: 14 },
value: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
input: {
backgroundColor: "#1A1425",
padding: 12,
borderRadius: 10,
color: "#fff",
marginTop: 8,
},
  btn: {
    backgroundColor: "#8A4DFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  footer: {
    paddingBottom: 30,
    paddingTop: 14,
    backgroundColor: "rgba(10,6,23,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  subLabel: { color: "#A8A3C2", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  configChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginRight: 8,
    alignItems: "center",
  },
  configChipActive: {
    backgroundColor: "rgba(167,139,250,0.15)",
    borderColor: "rgba(167,139,250,0.4)",
  },
  configChipText: { color: "#A8A3C2", fontSize: 13, fontWeight: "600" },
  configChipTextActive: { color: "#A78BFA" },
  configChipSub: { color: "#6B7280", fontSize: 11, marginTop: 2 },
  conversionText: {
    color: "#4ADE80",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 8,
    textAlign: "center",
  },
});
