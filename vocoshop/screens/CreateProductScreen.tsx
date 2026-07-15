// screens/CreateProductScreen.tsx — Assistant étape par étape
import React, { useState, useContext, useMemo } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Modal, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

// ===== PRESETS =====
const CATEGORIES = [
  "Boissons", "Épicerie", "Laitière", "Boucherie", "Hygiène",
  "Quincaillerie", "Pharmacie", "Alimentation", "Divers",
];
const UNIT_BY_CAT: Record<string, string[]> = {
  Boissons: ["bouteille", "canette", "litre", "verre", "gobelet", "casier", "carton"],
  Épicerie: ["kilogramme", "sachet", "paquet", "pièce", "litre"],
  Laitière: ["bouteille", "pot", "pièce", "litre"],
  Boucherie: ["kilogramme", "demi-kilo", "pièce"],
  Hygiène: ["pièce", "flacon", "tube", "sachet"],
  Quincaillerie: ["pièce", "boîte", "rouleau", "mètre"],
  Pharmacie: ["boîte", "plaquette", "flacon", "pièce"],
  Alimentation: ["kilogramme", "sachet", "paquet", "pièce", "litre"],
  Divers: ["pièce", "kilogramme", "litre", "sachet"],
};
const BUY_PRESETS = [
  "Casier", "Carton", "Sac", "Pack", "Palette",
  "Bouteille", "Sachet", "Boîte", "Lot", "Autre",
];
const SELL_PRESETS = [
  "À l'unité", "Casier", "Carton", "Pack", "Sac",
  "Lot", "Palette", "Autre",
];

export default function CreateProductScreen() {
  const nav = useNavigation<any>();
  const { token } = useContext(AuthContext);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Boissons");
  const [baseUnit, setBaseUnit] = useState("pièce");
  const [customUnit, setCustomUnit] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showBuyTypePicker, setShowBuyTypePicker] = useState(false);
  const [showSellTypePicker, setShowSellTypePicker] = useState(false);

  // Step 2 — achats
  const [buyList, setBuyList] = useState<{ name: string; qty: string; price: string }[]>([]);
  const [buyCustomName, setBuyCustomName] = useState("");
  const [buyQty, setBuyQty] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [showBuyForm, setShowBuyForm] = useState(false);
  const [selectedBuyPreset, setSelectedBuyPreset] = useState("");

  // Step 3 — ventes
  const [sellList, setSellList] = useState<{ name: string; qty: string; price: string }[]>([]);
  const [sellCustomName, setSellCustomName] = useState("");
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [showSellForm, setShowSellForm] = useState(false);
  const [selectedSellPreset, setSelectedSellPreset] = useState("");

  const effectiveUnit = customUnit.trim() || baseUnit;
  const units = UNIT_BY_CAT[category] || UNIT_BY_CAT.Divers;

  // Summary
  const summary = useMemo(() => {
    const buyCfg = [...buyList].sort((a, b) => Number(a.price || 0) / Math.max(1, Number(a.qty || 0)) - Number(b.price || 0) / Math.max(1, Number(b.qty || 0)))[0];
    const sellCfg = [...sellList].sort((a, b) => Number(a.price || 0) / Math.max(1, Number(a.qty || 0)) - Number(b.price || 0) / Math.max(1, Number(b.qty || 0)))[0];
    const ub = buyCfg ? Number(buyCfg.price || 0) / Math.max(1, Number(buyCfg.qty || 0)) : 0;
    const us = sellCfg ? Number(sellCfg.price || 0) / Math.max(1, Number(sellCfg.qty || 0)) : 0;
    return { ub, us, profit: us - ub, margin: us > 0 ? Math.round(((us - ub) / us) * 100) : 0 };
  }, [buyList, sellList]);

  // Step 2 helpers
  const addBuy = () => {
    const presetName = selectedBuyPreset === "Autre" ? buyCustomName.trim() : selectedBuyPreset;
    if (!presetName || !buyQty || !buyPrice) return;
    setBuyList([...buyList, { name: presetName, qty: buyQty, price: buyPrice }]);
    setSelectedBuyPreset(""); setBuyCustomName(""); setBuyQty(""); setBuyPrice(""); setShowBuyForm(false);
  };
  const removeBuy = (i: number) => setBuyList(buyList.filter((_, idx) => idx !== i));

  // Step 3 helpers
  const addSell = () => {
    const presetName = selectedSellPreset === "Autre" ? sellCustomName.trim() : selectedSellPreset;
    if (!presetName || !sellQty || !sellPrice) return;
    setSellList([...sellList, { name: presetName, qty: sellQty, price: sellPrice }]);
    setSelectedSellPreset(""); setSellCustomName(""); setSellQty(""); setSellPrice(""); setShowSellForm(false);
  };
  const removeSell = (i: number) => setSellList(sellList.filter((_, idx) => idx !== i));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission refusée");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!r.canceled) setImageUri(r.assets[0].uri);
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert("", "Donnez un nom au produit.");
    const sc = sellList.length > 0 ? sellList : buyList.length > 0 ? [{ name: "Unité", qty: "1", price: String(summary.us || 0) }] : [];
    if (sc.length === 0) return Alert.alert("", "Ajoutez au moins un mode de vente.");
    if (!token) return Alert.alert("", "Session invalide.");
    const us = sc[0] ? Number(sc[0].price) / Math.max(1, Number(sc[0].qty)) : 0;
    const bc = [...buyList].sort((a, b) => Number(a.price || 0) / Math.max(1, Number(a.qty || 0)) - Number(b.price || 0) / Math.max(1, Number(b.qty || 0)))[0];
    const ub = bc ? Number(bc.price || 0) / Math.max(1, Number(bc.qty || 0)) : 0;
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("category", category);
      fd.append("baseUnit", effectiveUnit);
      fd.append("unit", effectiveUnit);
      fd.append("sellPrice", String(Math.round(us)));
      fd.append("purchasePrice", String(Math.round(ub)));
      fd.append("quantity", initialStock || "0");
      fd.append("alertLevel", "3");
      fd.append("purchaseConfigs", JSON.stringify(buyList.map(c => ({ name: c.name, quantity: Number(c.qty) || 0, purchasePrice: Number(c.price) || 0 })).filter(c => c.quantity > 0)));
      fd.append("sellConfigs", JSON.stringify(sc.map(c => ({ name: c.name, quantity: Number(c.qty) || 0, sellPrice: Number(c.price) || 0 })).filter(c => c.quantity > 0 && c.sellPrice > 0)));
      if (imageUri) { const fn = imageUri.split("/").pop() || "p.jpg"; fd.append("image", { uri: imageUri, name: fn, type: `image/${fn.split(".").pop() || "jpg"}` } as any); }
      await API.post("/products", fd, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
      Alert.alert("Produit créé", `${name} a été ajouté.`);
      nav.goBack();
    } catch (e: any) { Alert.alert("Erreur", e?.response?.data?.error || "Échec."); }
    finally { setLoading(false); }
  };

  const fmt = (v: number) => v.toLocaleString("fr-FR");

  return (
    <View style={S.container}>
      {/* HEADER + PROGRESS */}
      <View style={S.headerRow}>
        <TouchableOpacity onPress={() => (step === 1 ? nav.goBack() : setStep(step - 1))} style={S.backBtn}>
          <Ionicons name={step === 1 ? "close" : "chevron-back"} size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.title}>Nouveau produit</Text>
          <View style={S.progressRow}>
            {[1, 2, 3, 4].map(s => (
              <View key={s} style={[S.progressDot, step >= s && S.progressDotDone]} />
            ))}
            <Text style={S.progressText}>Étape {step} sur 4</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ============================ STEP 1 ============================ */}
        {step === 1 && (
          <View style={S.stepWrap}>
            <Text style={S.stepTitle}>1. Décrivez le produit</Text>

            <Text style={S.label}>Nom du produit</Text>
            <TextInput style={S.input} placeholder='Ex : "Coca-Cola 50cl"' placeholderTextColor="#555" value={name} onChangeText={setName} />

            <Text style={S.label}>Catégorie</Text>
            <TouchableOpacity style={S.input} onPress={() => setShowCatPicker(true)}>
              <Text style={{ color: "#fff" }}>{category}</Text>
            </TouchableOpacity>

            <Text style={S.label}>Unité de mesure</Text>
            <TouchableOpacity style={S.input} onPress={() => setShowUnitPicker(true)}>
              <Text style={{ color: "#fff" }}>{effectiveUnit}</Text>
            </TouchableOpacity>

            <Text style={S.label}>Stock initial (facultatif)</Text>
            <TextInput style={S.input} placeholder="Ex: 100" placeholderTextColor="#555" keyboardType="numeric" value={initialStock} onChangeText={setInitialStock} />

            <Text style={S.label}>Photo (facultatif)</Text>
            <TouchableOpacity style={S.photoBtn} onPress={pickImage}>
              {imageUri ? <Image source={{ uri: imageUri }} style={S.photo} /> : (
                <View style={S.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color="#555" />
                  <Text style={{ color: "#555", marginTop: 4 }}>Ajouter</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ============================ STEP 2 ============================ */}
        {step === 2 && (
          <View style={S.stepWrap}>
            <Text style={S.stepTitle}>2. Vous achetez en…</Text>
            <Text style={S.stepHint}>
              Exemple : Casier · Carton · Sac · Palette
            </Text>
            <Text style={S.stepHint2}>Comment recevez-vous ce produit ?</Text>

            {buyList.map((b, i) => (
              <View key={i} style={S.configRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.configName}>{b.name}</Text>
                  <Text style={S.configDetail}>Contient {b.qty} {effectiveUnit}s · Payé {fmt(Number(b.price))} FCFA</Text>
                </View>
                <TouchableOpacity onPress={() => removeBuy(i)}><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
              </View>
            ))}

            {!showBuyForm ? (
              <TouchableOpacity style={S.addBtn} onPress={() => setShowBuyForm(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#A78BFA" />
                <Text style={S.addBtnText}>Ajouter un conditionnement</Text>
              </TouchableOpacity>
            ) : (
              <View style={S.formCard}>
                <Text style={S.formLabel}>Type</Text>
                <TouchableOpacity style={S.input} onPress={() => setShowBuyTypePicker(true)}>
                  <Text style={{ color: selectedBuyPreset ? "#fff" : "#555" }}>{selectedBuyPreset || "Choisir..."}</Text>
                </TouchableOpacity>
                {selectedBuyPreset === "Autre" && (
                  <TextInput style={S.input} placeholder="Nom du conditionnement" placeholderTextColor="#555" value={buyCustomName} onChangeText={setBuyCustomName} />
                )}
                <Text style={S.formLabel}>Contient (en {effectiveUnit}s)</Text>
                <TextInput style={S.input} placeholder="Ex: 24" placeholderTextColor="#555" keyboardType="numeric" value={buyQty} onChangeText={setBuyQty} />
                <Text style={S.formLabel}>Prix payé (FCFA)</Text>
                <TextInput style={S.input} placeholder="Ex: 12000" placeholderTextColor="#555" keyboardType="numeric" value={buyPrice} onChangeText={setBuyPrice} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity style={[S.btn, S.btnOutline, { flex: 1 }]} onPress={() => { setShowBuyForm(false); setSelectedBuyPreset(""); }}>
                    <Text style={S.btnOutlineText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.btn, { flex: 1 }]} onPress={addBuy}>
                    <Text style={S.btnText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ============================ STEP 3 ============================ */}
        {step === 3 && (
          <View style={S.stepWrap}>
            <Text style={S.stepTitle}>3. Vous vendez en…</Text>
            <Text style={S.stepHint}>
              Exemple : À l'unité · Casier · Pack
            </Text>
            <Text style={S.stepHint2}>Comment vos clients achètent ce produit ?</Text>

            {sellList.map((s, i) => (
              <View key={i} style={S.configRow}>
                <View style={{ flex: 1 }}>
                  <Text style={S.configName}>{s.name}</Text>
                  <Text style={S.configDetail}>{s.qty} {effectiveUnit}(s) · Vendu {fmt(Number(s.price))} FCFA</Text>
                </View>
                <TouchableOpacity onPress={() => removeSell(i)}><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
              </View>
            ))}

            {!showSellForm ? (
              <TouchableOpacity style={S.addBtn} onPress={() => setShowSellForm(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#A78BFA" />
                <Text style={S.addBtnText}>Ajouter un mode de vente</Text>
              </TouchableOpacity>
            ) : (
              <View style={S.formCard}>
                <Text style={S.formLabel}>Type</Text>
                <TouchableOpacity style={S.input} onPress={() => setShowSellTypePicker(true)}>
                  <Text style={{ color: selectedSellPreset ? "#fff" : "#555" }}>{selectedSellPreset || "Choisir..."}</Text>
                </TouchableOpacity>
                {selectedSellPreset === "Autre" && (
                  <TextInput style={S.input} placeholder="Nom du mode de vente" placeholderTextColor="#555" value={sellCustomName} onChangeText={setSellCustomName} />
                )}
                <Text style={S.formLabel}>Quantité (en {effectiveUnit}s)</Text>
                <TextInput style={S.input} placeholder="Ex: 6" placeholderTextColor="#555" keyboardType="numeric" value={sellQty} onChangeText={setSellQty} />
                <Text style={S.formLabel}>Prix de vente (FCFA)</Text>
                <TextInput style={S.input} placeholder="Ex: 4500" placeholderTextColor="#555" keyboardType="numeric" value={sellPrice} onChangeText={setSellPrice} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity style={[S.btn, S.btnOutline, { flex: 1 }]} onPress={() => { setShowSellForm(false); setSelectedSellPreset(""); }}>
                    <Text style={S.btnOutlineText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[S.btn, { flex: 1 }]} onPress={addSell}>
                    <Text style={S.btnText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ============================ STEP 4 ============================ */}
        {step === 4 && (
          <View style={S.stepWrap}>
            <Text style={S.stepTitle}>4. Résumé</Text>
            <View style={S.summaryCard}>
              <View style={S.summaryRow}><Text style={S.sumLabel}>Produit</Text><Text style={S.sumValue}>{name || "—"}</Text></View>
              <View style={S.summaryRow}><Text style={S.sumLabel}>Catégorie</Text><Text style={S.sumValue}>{category}</Text></View>
              <View style={S.summaryRow}><Text style={S.sumLabel}>Unité</Text><Text style={S.sumValue}>{effectiveUnit}</Text></View>
              <View style={S.summaryRow}><Text style={S.sumLabel}>Stock initial</Text><Text style={S.sumValue}>{initialStock || "0"} {effectiveUnit}s</Text></View>
              <View style={S.sumDiv} />
              <View style={S.summaryRow}><Text style={S.sumLabel}>Achat unitaire</Text><Text style={S.sumValue}>{fmt(Math.round(summary.ub))} FCFA</Text></View>
              <View style={S.summaryRow}><Text style={S.sumLabel}>Vente unitaire</Text><Text style={S.sumValue}>{fmt(Math.round(summary.us))} FCFA</Text></View>
              <View style={S.summaryRow}><Text style={S.sumLabel}>Bénéfice</Text><Text style={[S.sumValue, { color: summary.profit >= 0 ? "#4ADE80" : "#ef4444" }]}>{fmt(Math.round(summary.profit))} FCFA</Text></View>
              <View style={S.summaryRow}><Text style={S.sumLabel}>Marge</Text><Text style={[S.sumValue, { color: "#A78BFA" }]}>{summary.margin}%</Text></View>
            </View>
            {buyList.length > 0 && (
              <>
                <Text style={[S.stepHint, { marginTop: 16 }]}>Conditionnements d'achat</Text>
                {buyList.map((b, i) => (
                  <Text key={i} style={S.sumSub}>• {b.name} : {b.qty} {effectiveUnit}s · {fmt(Number(b.price))} FCFA</Text>
                ))}
              </>
            )}
            {sellList.length > 0 && (
              <>
                <Text style={[S.stepHint, { marginTop: 12 }]}>Modes de vente</Text>
                {sellList.map((s, i) => (
                  <Text key={i} style={S.sumSub}>• {s.name} : {s.qty} {effectiveUnit}(s) · {fmt(Number(s.price))} FCFA</Text>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* FOOTER NAVIGATION */}
      <View style={S.footer}>
        {step < 4 ? (
          <TouchableOpacity style={S.footerBtn} onPress={() => setStep(step + 1)}>
            <Text style={S.footerBtnText}>Suivant</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[S.footerBtn, loading && { opacity: 0.7 }]} onPress={save} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.footerBtnText}>Créer le produit</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Catégorie picker modal */}
      <Modal visible={showCatPicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Catégorie</Text>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[S.pickerItem, category === c && S.pickerItemActive]} onPress={() => { setCategory(c); setBaseUnit((UNIT_BY_CAT[c] || ["pièce"])[0]); setShowCatPicker(false); }}>
              <Text style={[S.pickerText, category === c && S.pickerTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View></View>
      </Modal>

      {/* Unité picker modal */}
      <Modal visible={showUnitPicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Unité de mesure</Text>
          {units.map(u => (
            <TouchableOpacity key={u} style={[S.pickerItem, baseUnit === u && !customUnit && S.pickerItemActive]} onPress={() => { setBaseUnit(u); setCustomUnit(""); setShowUnitPicker(false); }}>
              <Text style={[S.pickerText, baseUnit === u && !customUnit && S.pickerTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
            <TextInput style={[S.input, { flex: 1, marginBottom: 0 }]} placeholder="Autre unité..." placeholderTextColor="#555" value={customUnit} onChangeText={setCustomUnit} />
            <TouchableOpacity style={[S.btn, { paddingVertical: 14, paddingHorizontal: 20 }]} onPress={() => { if (customUnit.trim()) { setBaseUnit(""); setShowUnitPicker(false); } }}>
              <Text style={S.btnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Buy type picker */}
      <Modal visible={showBuyTypePicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Type de conditionnement</Text>
          {BUY_PRESETS.map(p => (
            <TouchableOpacity key={p} style={[S.pickerItem, selectedBuyPreset === p && S.pickerItemActive]} onPress={() => { setSelectedBuyPreset(p); setBuyCustomName(""); setShowBuyTypePicker(false); }}>
              <Text style={[S.pickerText, selectedBuyPreset === p && S.pickerTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View></View>
      </Modal>

      {/* Sell type picker */}
      <Modal visible={showSellTypePicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Type de vente</Text>
          {SELL_PRESETS.map(p => (
            <TouchableOpacity key={p} style={[S.pickerItem, selectedSellPreset === p && S.pickerItemActive]} onPress={() => { setSelectedSellPreset(p); setSellCustomName(""); setShowSellTypePicker(false); }}>
              <Text style={[S.pickerText, selectedSellPreset === p && S.pickerTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View></View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 55 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, marginBottom: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 20, fontWeight: "900" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  progressDot: { width: 18, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.10)" },
  progressDotDone: { backgroundColor: "#A78BFA", width: 22 },
  progressText: { color: "#6B7280", fontSize: 11, marginLeft: 8 },

  stepWrap: { paddingHorizontal: 20 },
  stepTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 4, marginTop: 8 },
  stepHint: { color: "#6B7280", fontSize: 13, marginBottom: 6 },
  stepHint2: { color: "#A78BFA", fontSize: 14, fontWeight: "600", marginBottom: 12 },

  label: { color: "#A8A3C2", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#1A152A", padding: 14, borderRadius: 12, color: "#fff", fontSize: 15, marginBottom: 8 },
  unitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  unitChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  unitChipActive: { backgroundColor: "rgba(167,139,250,0.15)", borderColor: "rgba(167,139,250,0.4)" },
  unitChipText: { color: "#A8A3C2", fontSize: 13, fontWeight: "600" },
  unitChipTextActive: { color: "#A78BFA" },
  unitInputSmall: { color: "#fff", minWidth: 70, textAlign: "center" },
  photoBtn: { borderRadius: 14, overflow: "hidden", backgroundColor: "#1A152A", marginBottom: 8 },
  photo: { width: "100%", height: 140, resizeMode: "cover" },
  photoPlaceholder: { height: 90, alignItems: "center", justifyContent: "center" },

  // Step 2-3
  configRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#161228", padding: 14, borderRadius: 12, marginBottom: 8, gap: 10 },
  configName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  configDetail: { color: "#A8A3C2", fontSize: 12, marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 },
  addBtnText: { color: "#A78BFA", fontSize: 14, fontWeight: "700" },
  formCard: { backgroundColor: "#161228", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(167,139,250,0.15)" },
  formLabel: { color: "#A8A3C2", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  presetChipActive: { backgroundColor: "rgba(167,139,250,0.15)", borderColor: "rgba(167,139,250,0.4)" },
  presetChipText: { color: "#A8A3C2", fontSize: 13, fontWeight: "600" },
  presetChipTextActive: { color: "#A78BFA" },
  btn: { backgroundColor: "#7C3AED", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  btnOutlineText: { color: "#A8A3C2", fontSize: 15, fontWeight: "600" },

  // Step 4
  summaryCard: { backgroundColor: "#161228", borderRadius: 14, padding: 18, borderWidth: 1, borderColor: "rgba(167,139,250,0.15)" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  sumLabel: { color: "#A8A3C2", fontSize: 14 },
  sumValue: { color: "#fff", fontSize: 14, fontWeight: "700" },
  sumDiv: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 4 },
  sumSub: { color: "#9CA3AF", fontSize: 12, marginLeft: 4, marginTop: 2 },

  // Footer
  footer: { paddingHorizontal: 20, paddingBottom: 30, paddingTop: 14, backgroundColor: "rgba(10,6,23,0.96)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  footerBtn: { backgroundColor: "#7C3AED", paddingVertical: 16, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  footerBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 30 },
  modalCard: { backgroundColor: "#18122B", borderRadius: 16, padding: 20 },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 12 },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  pickerItemActive: { backgroundColor: "rgba(167,139,250,0.12)" },
  pickerText: { color: "#A8A3C2", fontSize: 14 },
  pickerTextActive: { color: "#A78BFA", fontWeight: "700" },
});
