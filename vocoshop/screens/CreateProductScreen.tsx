// screens/CreateProductScreen.tsx
import React, { useState, useContext, useMemo } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Modal, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

// ===================== PRESETS =====================
const CATEGORIES = [
  "Boissons", "Épicerie", "Laitière", "Boucherie", "Hygiène",
  "Quincaillerie", "Pharmacie", "Alimentation", "Divers",
];

const UNIT_PRESETS: Record<string, string[]> = {
  Boissons: ["bouteille", "canette", "litre"],
  Épicerie: ["kilogramme", "sachet", "paquet", "pièce", "litre"],
  Laitière: ["bouteille", "pot", "pièce", "litre"],
  Boucherie: ["kilogramme", "demi-kilo", "pièce"],
  Hygiène: ["pièce", "flacon", "tube", "sachet"],
  Quincaillerie: ["pièce", "boîte", "rouleau", "mètre"],
  Pharmacie: ["boîte", "plaquette", "flacon", "pièce"],
  Alimentation: ["kilogramme", "sachet", "paquet", "pièce", "litre"],
  Divers: ["pièce", "kilogramme", "litre", "sachet"],
};

const PACKAGING_PRESETS: Record<string, string[]> = {
  Boissons: ["Bouteille", "Pack", "Casier", "Carton", "Palette"],
  Épicerie: ["Pièce", "Sachet", "Paquet", "Sac", "Carton"],
  Laitière: ["Bouteille", "Pack", "Pot", "Casier"],
  Boucherie: ["Kilogramme", "Demi-kilo", "Carton", "Pièce"],
  Hygiène: ["Pièce", "Pack", "Carton", "Flacon"],
  Quincaillerie: ["Pièce", "Boîte", "Carton", "Lot"],
  Pharmacie: ["Boîte", "Plaquette", "Carton", "Pièce"],
  Alimentation: ["Pièce", "Sachet", "Paquet", "Sac", "Carton"],
  Divers: ["Pièce", "Carton", "Sac", "Lot"],
};

// ===================== TYPES =====================
type PurchaseConfig = { name: string; quantity: string; purchasePrice: string };
type SellConfig = { name: string; quantity: string; sellPrice: string };

// ===================== COMPONENT =====================
export default function CreateProductScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { token } = useContext(AuthContext);

  // Part 1
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Boissons");
  const [baseUnit, setBaseUnit] = useState("pièce");
  const [customUnit, setCustomUnit] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);

  // Part 2 — achats
  const [purchaseConfigs, setPurchaseConfigs] = useState<PurchaseConfig[]>([]);

  // Part 3 — ventes
  const [sellConfigs, setSellConfigs] = useState<SellConfig[]>([
    { name: "Unité", quantity: "1", sellPrice: "" },
  ]);

  // Summary
  const summary = useMemo(() => {
    const defaultBuyConfig = purchaseConfigs.length > 0 ? purchaseConfigs[0] : null;
    const defaultSellConfig = sellConfigs.length > 0 ? sellConfigs[0] : null;

    const unitBuyPrice = defaultBuyConfig
      ? Number(defaultBuyConfig.purchasePrice || 0) / Math.max(1, Number(defaultBuyConfig.quantity || 0))
      : 0;
    const unitSellPrice = defaultSellConfig
      ? Number(defaultSellConfig.sellPrice || 0) / Math.max(1, Number(defaultSellConfig.quantity || 0))
      : 0;
    const profit = unitSellPrice - unitBuyPrice;
    const margin = unitSellPrice > 0 ? Math.round((profit / unitSellPrice) * 100) : 0;

    return { unitBuyPrice, unitSellPrice, profit, margin };
  }, [purchaseConfigs, sellConfigs]);

  const effectiveUnit = customUnit.trim() || baseUnit;

  // ===================== HELPERS =====================
  const addPurchaseConfig = () => {
    const presets = PACKAGING_PRESETS[category] || PACKAGING_PRESETS.Divers;
    const defaultName = purchaseConfigs.length === 0 ? presets[0] : presets[purchaseConfigs.length % presets.length] || "Carton";
    setPurchaseConfigs([...purchaseConfigs, { name: defaultName, quantity: "", purchasePrice: "" }]);
  };

  const removePurchaseConfig = (i: number) => {
    setPurchaseConfigs(purchaseConfigs.filter((_, idx) => idx !== i));
  };

  const updatePurchase = (i: number, field: keyof PurchaseConfig, value: string) => {
    const updated = [...purchaseConfigs];
    updated[i] = { ...updated[i], [field]: value };
    setPurchaseConfigs(updated);
  };

  const addSellConfig = () => {
    setSellConfigs([...sellConfigs, { name: "Unité", quantity: "1", sellPrice: "" }]);
  };

  const removeSellConfig = (i: number) => {
    if (sellConfigs.length <= 1) return;
    setSellConfigs(sellConfigs.filter((_, idx) => idx !== i));
  };

  const updateSell = (i: number, field: keyof SellConfig, value: string) => {
    const updated = [...sellConfigs];
    updated[i] = { ...updated[i], [field]: value };
    setSellConfigs(updated);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission refusée", "Accès à la galerie requis.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  // ===================== SAVE =====================
  const saveProduct = async () => {
    if (!name.trim()) return Alert.alert("Erreur", "Nom du produit requis.");
    if (!token) return Alert.alert("Erreur", "Session invalide.");

    const sellCfg = sellConfigs.find(c => Number(c.sellPrice) > 0 && Number(c.quantity) > 0);
    if (!sellCfg) return Alert.alert("Erreur", "Ajoutez au moins un mode de vente avec un prix.");

    const unitSellPrice = Number(sellCfg.sellPrice) / Math.max(1, Number(sellCfg.quantity));
    const buyCfg = purchaseConfigs.find(c => Number(c.purchasePrice) > 0 && Number(c.quantity) > 0);
    const unitBuyPrice = buyCfg
      ? Number(buyCfg.purchasePrice) / Math.max(1, Number(buyCfg.quantity))
      : 0;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("category", category);
      formData.append("baseUnit", effectiveUnit);
      formData.append("unit", effectiveUnit);
      formData.append("sellPrice", String(Math.round(unitSellPrice)));
      formData.append("purchasePrice", String(Math.round(unitBuyPrice)));
      formData.append("quantity", "0");
      formData.append("alertLevel", "3");
      formData.append("purchaseConfigs", JSON.stringify(purchaseConfigs.map(c => ({
        name: c.name, quantity: Number(c.quantity) || 0, purchasePrice: Number(c.purchasePrice) || 0,
      })).filter(c => c.quantity > 0)));
      formData.append("sellConfigs", JSON.stringify(sellConfigs.map(c => ({
        name: c.name, quantity: Number(c.quantity) || 0, sellPrice: Number(c.sellPrice) || 0,
      })).filter(c => c.quantity > 0 && c.sellPrice > 0)));

      if (imageUri) {
        const filename = imageUri.split("/").pop() || "photo.jpg";
        formData.append("image", { uri: imageUri, name: filename, type: `image/${filename.split(".").pop() || "jpg"}` } as any);
      }

      await API.post("/products", formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Succès", "Produit créé avec ses conditionnements.");
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Erreur", err?.response?.data?.error || "Une erreur est survenue.");
    } finally { setLoading(false); }
  };

  const fmt = (v: number) => v.toLocaleString("fr-FR");

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Nouveau produit</Text>
        <TouchableOpacity onPress={saveProduct} disabled={loading} style={styles.saveHeaderBtn}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveHeaderText}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ===== PART 1 : INFOS DE BASE ===== */}
        <Text style={styles.sectionTitle}>Informations du produit</Text>

        <Text style={styles.label}>Nom du produit *</Text>
        <TextInput style={styles.input} placeholder="Ex: Coca-Cola 50cl" placeholderTextColor="#555" value={name} onChangeText={setName} />

        <Text style={styles.label}>Catégorie</Text>
        <TouchableOpacity style={styles.input} onPress={() => setShowCatPicker(true)}>
          <Text style={{ color: "#fff" }}>{category}</Text>
        </TouchableOpacity>
        <Modal visible={showCatPicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Catégorie</Text>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[styles.pickerItem, category === c && styles.pickerItemActive]} onPress={() => { setCategory(c); setBaseUnit((UNIT_PRESETS[c] || ["pièce"])[0]); setShowCatPicker(false); }}>
                  <Text style={[styles.pickerText, category === c && styles.pickerTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>

        <Text style={styles.label}>Unité de base</Text>
        <View style={styles.unitRow}>
          {(UNIT_PRESETS[category] || ["pièce"]).map((u) => (
            <TouchableOpacity key={u} style={[styles.unitChip, baseUnit === u && customUnit === "" && styles.unitChipActive]} onPress={() => { setBaseUnit(u); setCustomUnit(""); }}>
              <Text style={[styles.unitChipText, baseUnit === u && customUnit === "" && styles.unitChipTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
          <TextInput style={[styles.unitChip, styles.unitInput, customUnit !== "" && styles.unitChipActive]} placeholder="Autre..." placeholderTextColor="#555" value={customUnit} onChangeText={setCustomUnit} />
        </View>

        {/* Photo */}
        <Text style={styles.label}>Photo (optionnel)</Text>
        <TouchableOpacity style={styles.photoPicker} onPress={pickImage}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.photoPreview} /> : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={28} color="#555" />
              <Text style={{ color: "#555", marginTop: 4 }}>Ajouter une photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ===== PART 2 : ACHATS ===== */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Comment achetez-vous ce produit ?</Text>
        <Text style={styles.sectionHint}>Ajoutez vos conditionnements d'achat habituels.</Text>

        {purchaseConfigs.map((c, i) => (
          <View key={i} style={styles.configCard}>
            <View style={styles.configHeader}>
              <Text style={styles.configLabel}>Conditionnement {i + 1}</Text>
              <TouchableOpacity onPress={() => removePurchaseConfig(i)}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <View style={styles.configRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Nom</Text>
                <TextInput style={styles.smallInput} placeholder="Casier" placeholderTextColor="#555" value={c.name} onChangeText={(v) => updatePurchase(i, "name", v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Qté contient</Text>
                <TextInput style={styles.smallInput} placeholder="24" placeholderTextColor="#555" keyboardType="numeric" value={c.quantity} onChangeText={(v) => updatePurchase(i, "quantity", v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Prix (FCFA)</Text>
                <TextInput style={styles.smallInput} placeholder="12000" placeholderTextColor="#555" keyboardType="numeric" value={c.purchasePrice} onChangeText={(v) => updatePurchase(i, "purchasePrice", v)} />
              </View>
            </View>
            {(c.presets || (PACKAGING_PRESETS[category] || PACKAGING_PRESETS.Divers)).map((p) => (
              <TouchableOpacity key={p} style={styles.presetChip} onPress={() => updatePurchase(i, "name", p)}>
                <Text style={styles.presetChipText}>{p}</Text>
              </TouchableOpacity>
            )).length > 0 ? (
              <View style={styles.presetRow}>
                {(PACKAGING_PRESETS[category] || PACKAGING_PRESETS.Divers).slice(0, 5).map((p) => (
                  <TouchableOpacity key={p} style={[styles.presetChip, c.name === p && styles.presetChipActive]} onPress={() => updatePurchase(i, "name", p)}>
                    <Text style={[styles.presetChipText, c.name === p && styles.presetChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addPurchaseConfig}>
          <Ionicons name="add-circle-outline" size={18} color="#A78BFA" />
          <Text style={styles.addBtnText}>Ajouter un conditionnement d'achat</Text>
        </TouchableOpacity>

        {/* ===== PART 3 : VENTES ===== */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Comment vendez-vous ce produit ?</Text>
        <Text style={styles.sectionHint}>Ajoutez vos différents modes de vente.</Text>

        {sellConfigs.map((c, i) => (
          <View key={i} style={styles.configCard}>
            <View style={styles.configHeader}>
              <Text style={styles.configLabel}>Mode de vente {i + 1}</Text>
              {sellConfigs.length > 1 && (
                <TouchableOpacity onPress={() => removeSellConfig(i)}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.configRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Nom</Text>
                <TextInput style={styles.smallInput} placeholder="Bouteille" placeholderTextColor="#555" value={c.name} onChangeText={(v) => updateSell(i, "name", v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Qté ({effectiveUnit})</Text>
                <TextInput style={styles.smallInput} placeholder="1" placeholderTextColor="#555" keyboardType="numeric" value={c.quantity} onChangeText={(v) => updateSell(i, "quantity", v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Prix (FCFA)</Text>
                <TextInput style={styles.smallInput} placeholder="700" placeholderTextColor="#555" keyboardType="numeric" value={c.sellPrice} onChangeText={(v) => updateSell(i, "sellPrice", v)} />
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={addSellConfig}>
          <Ionicons name="add-circle-outline" size={18} color="#A78BFA" />
          <Text style={styles.addBtnText}>Ajouter un mode de vente</Text>
        </TouchableOpacity>

        {/* ===== PART 4 : RÉSUMÉ ===== */}
        {purchaseConfigs.length > 0 && sellConfigs.length > 0 ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Résumé</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Prix d'achat unitaire</Text>
                <Text style={styles.summaryValue}>{fmt(Math.round(summary.unitBuyPrice))} FCFA / {effectiveUnit}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Prix de vente unitaire</Text>
                <Text style={styles.summaryValue}>{fmt(Math.round(summary.unitSellPrice))} FCFA / {effectiveUnit}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bénéfice unitaire</Text>
                <Text style={[styles.summaryValue, { color: summary.profit >= 0 ? "#4ADE80" : "#ef4444" }]}>{fmt(Math.round(summary.profit))} FCFA</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Marge</Text>
                <Text style={[styles.summaryValue, { color: "#A78BFA" }]}>{summary.margin}%</Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FIXED FOOTER SAVE */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={saveProduct} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Enregistrer le produit</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 55 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, marginBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", flex: 1 },
  saveHeaderBtn: { backgroundColor: "#7C3AED", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveHeaderText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  saveBtn: { backgroundColor: "#7C3AED", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  footer: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 14, backgroundColor: "rgba(10,6,23,0.96)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },

  sectionTitle: { color: "#fff", fontSize: 17, fontWeight: "800", marginBottom: 4, paddingHorizontal: 20, marginTop: 16 },
  sectionHint: { color: "#6B7280", fontSize: 12, marginBottom: 10, paddingHorizontal: 20 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 16, marginHorizontal: 20 },

  label: { color: "#A8A3C2", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 10, paddingHorizontal: 20 },
  input: { backgroundColor: "#1A152A", padding: 14, borderRadius: 12, color: "#fff", fontSize: 15, marginHorizontal: 20, marginBottom: 8 },

  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  unitChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  unitChipActive: { backgroundColor: "rgba(167,139,250,0.15)", borderColor: "rgba(167,139,250,0.4)" },
  unitChipText: { color: "#A8A3C2", fontSize: 13, fontWeight: "600" },
  unitChipTextActive: { color: "#A78BFA" },
  unitInput: { color: "#fff", minWidth: 80, textAlign: "center" },

  photoPicker: { borderRadius: 14, marginHorizontal: 20, overflow: "hidden", backgroundColor: "#1A152A", marginBottom: 8 },
  photoPreview: { width: "100%", height: 160, resizeMode: "cover" },
  photoPlaceholder: { height: 100, alignItems: "center", justifyContent: "center" },

  configCard: { backgroundColor: "#161228", borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" },
  configHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  configLabel: { color: "#C6C0DD", fontSize: 13, fontWeight: "700" },
  configRow: { flexDirection: "row", gap: 8 },
  fieldLabel: { color: "#6B7280", fontSize: 10, fontWeight: "600", marginBottom: 4 },
  smallInput: { backgroundColor: "#1E1638", paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, color: "#fff", fontSize: 13 },

  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  presetChipActive: { backgroundColor: "rgba(167,139,250,0.15)", borderColor: "rgba(167,139,250,0.3)" },
  presetChipText: { color: "#6B7280", fontSize: 11, fontWeight: "600" },
  presetChipTextActive: { color: "#A78BFA" },

  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  addBtnText: { color: "#A78BFA", fontSize: 13, fontWeight: "700" },

  summaryCard: { backgroundColor: "#161228", borderRadius: 14, padding: 16, marginHorizontal: 20, borderWidth: 1, borderColor: "rgba(167,139,250,0.15)" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { color: "#A8A3C2", fontSize: 13 },
  summaryValue: { color: "#fff", fontSize: 13, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 30 },
  modalContent: { backgroundColor: "#18122B", borderRadius: 16, padding: 20 },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 12 },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  pickerItemActive: { backgroundColor: "rgba(167,139,250,0.12)" },
  pickerText: { color: "#A8A3C2", fontSize: 14 },
  pickerTextActive: { color: "#A78BFA", fontWeight: "700" },
});
