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

export default function CreateProductScreen() {
  const nav = useNavigation<any>();
  const { token } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Boissons");
  const [baseUnit, setBaseUnit] = useState("bouteille");
  const [customUnit, setCustomUnit] = useState("");
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // Vente
  const [sellUnit, setSellUnit] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [showSellUnitPicker, setShowSellUnitPicker] = useState(false);
  const [sellCustomUnit, setSellCustomUnit] = useState("");

  // Achat
  const [buyUnit, setBuyUnit] = useState("");
  const [buyQty, setBuyQty] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [showBuyUnitPicker, setShowBuyUnitPicker] = useState(false);
  const [buyCustomUnit, setBuyCustomUnit] = useState("");

  // Stock
  const [stockQty, setStockQty] = useState("");
  const [stockUnit, setStockUnit] = useState("");
  const [showStockUnitPicker, setShowStockUnitPicker] = useState(false);

  const [expirationDate, setExpirationDate] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const effectiveUnit = customUnit.trim() || baseUnit;
  const units = UNIT_BY_CAT[category] || UNIT_BY_CAT.Divers;
  const sellLabel = sellCustomUnit.trim() || sellUnit || effectiveUnit;
  const buyLabel = buyCustomUnit.trim() || buyUnit || effectiveUnit;

  const stockUnitLabel = stockUnit || effectiveUnit;
  const buyCfgQty = Number(buyQty || 1);
  const finalStock = buyCfgQty > 1 ? Number(stockQty || 0) * buyCfgQty : Number(stockQty || 0);

  const summary = useMemo(() => {
    const ub = buyCfgQty > 0 ? Number(buyPrice || 0) / buyCfgQty : 0;
    const us = Number(sellPrice || 0);
    return { ub, us, profit: us - ub, margin: us > 0 ? Math.round(((us - ub) / us) * 100) : 0 };
  }, [sellPrice, buyPrice, buyCfgQty]);

  const pickImage = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) return Alert.alert("Permission refusée");
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!r.canceled) setImageUri(r.assets[0].uri);
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert("", "Nom du produit requis.");
    if (!sellPrice || Number(sellPrice) <= 0) return Alert.alert("", "Prix de vente requis.");
    if (!token) return Alert.alert("", "Session invalide.");
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("category", category);
      fd.append("baseUnit", effectiveUnit);
      fd.append("unit", effectiveUnit);
      fd.append("sellPrice", sellPrice);
      fd.append("purchasePrice", buyPrice || "0");
      fd.append("quantity", String(finalStock));
      fd.append("alertLevel", "3");
      if (expirationDate.trim()) fd.append("expirationDate", expirationDate.trim());
      if (buyUnit && Number(buyPrice) > 0) {
        fd.append("purchaseConfigs", JSON.stringify([{ name: buyLabel, quantity: buyCfgQty, purchasePrice: Number(buyPrice) }]));
      } else {
        fd.append("purchaseConfigs", "[]");
      }
      if (sellUnit && Number(sellPrice) > 0) {
        fd.append("sellConfigs", JSON.stringify([{ name: sellLabel, quantity: 1, sellPrice: Number(sellPrice) }]));
      } else {
        fd.append("sellConfigs", JSON.stringify([{ name: effectiveUnit, quantity: 1, sellPrice: Number(sellPrice) }]));
      }
      if (imageUri) { const fn = imageUri.split("/").pop() || "p.jpg"; fd.append("image", { uri: imageUri, name: fn, type: `image/${fn.split(".").pop() || "jpg"}` } as any); }
      await API.post("/products", fd, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
      Alert.alert("Produit créé", name);
      nav.goBack();
    } catch (e: any) { Alert.alert("Erreur", e?.response?.data?.error || "Échec."); }
    finally { setLoading(false); }
  };

  const fmt = (v: number) => v.toLocaleString("fr-FR");

  return (
    <View style={S.container}>
      <View style={S.headerRow}>
        <TouchableOpacity onPress={() => nav.goBack()} style={S.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={S.title}>Nouveau produit</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* NOM */}
        <Text style={S.label}>Nom du produit</Text>
        <TextInput style={S.input} placeholder='Ex : "Coca-Cola 50cl"' placeholderTextColor="#555" value={name} onChangeText={setName} />

        {/* CATÉGORIE */}
        <Text style={S.label}>Catégorie</Text>
        <TouchableOpacity style={S.input} onPress={() => setShowCatPicker(true)}>
          <Text style={{ color: "#fff" }}>{category}</Text>
        </TouchableOpacity>

        {/* UNITÉ DE BASE */}
        <Text style={S.label}>Unité de mesure</Text>
        <TouchableOpacity style={S.input} onPress={() => setShowUnitPicker(true)}>
          <Text style={{ color: "#fff" }}>{effectiveUnit}</Text>
        </TouchableOpacity>

        {/* VENTE */}
        <View style={S.divider} />
        <Text style={S.sectionTitle}>Vous le vendez en...</Text>
        <TouchableOpacity style={S.input} onPress={() => setShowSellUnitPicker(true)}>
          <Text style={{ color: sellLabel !== effectiveUnit ? "#A78BFA" : "#fff" }}>{sellLabel}</Text>
        </TouchableOpacity>
        <View style={S.row2}>
          <TextInput style={S.inputHalf} placeholder="Prix de vente" placeholderTextColor="#555" keyboardType="numeric" value={sellPrice} onChangeText={setSellPrice} />
          <Text style={{ color: "#6B7280", fontSize: 13, alignSelf: "center", marginHorizontal: 4 }}>FCFA</Text>
        </View>

        {/* ACHAT */}
        <View style={S.divider} />
        <Text style={S.sectionTitle}>Vous l'achetez en...</Text>
        <TouchableOpacity style={S.input} onPress={() => setShowBuyUnitPicker(true)}>
          <Text style={{ color: buyLabel !== effectiveUnit ? "#A78BFA" : "#fff" }}>1 {buyLabel} =</Text>
        </TouchableOpacity>
        <View style={S.row2}>
          <TextInput style={S.inputHalf} placeholder="Contient combien ?" placeholderTextColor="#555" keyboardType="numeric" value={buyQty} onChangeText={setBuyQty} />
          <Text style={{ color: "#6B7280", fontSize: 13, alignSelf: "center", marginHorizontal: 4 }}>{effectiveUnit}(s)</Text>
        </View>
        <View style={S.row2}>
          <TextInput style={S.inputHalf} placeholder="Prix payé" placeholderTextColor="#555" keyboardType="numeric" value={buyPrice} onChangeText={setBuyPrice} />
          <Text style={{ color: "#6B7280", fontSize: 13, alignSelf: "center", marginHorizontal: 4 }}>FCFA</Text>
        </View>

        {Number(buyPrice) > 0 && buyCfgQty > 1 && (
          <Text style={S.hint}>
            ≈ {fmt(Math.round(Number(buyPrice) / buyCfgQty))} FCFA / {effectiveUnit}
          </Text>
        )}

        {/* STOCK */}
        <View style={S.divider} />
        <Text style={S.sectionTitle}>Stock actuel</Text>
        <Text style={S.label}>Le stock est en...</Text>
        <TouchableOpacity style={S.input} onPress={() => setShowStockUnitPicker(true)}>
          <Text style={{ color: stockUnit ? "#A78BFA" : "#fff" }}>{stockUnit || effectiveUnit}</Text>
        </TouchableOpacity>
        <View style={S.row2}>
          <TextInput style={S.inputHalf} placeholder="Quantité" placeholderTextColor="#555" keyboardType="numeric" value={stockQty} onChangeText={setStockQty} />
          <Text style={{ color: "#6B7280", fontSize: 13, alignSelf: "center", marginHorizontal: 4 }}>{stockUnit || effectiveUnit}(s)</Text>
        </View>
        {stockUnit && Number(stockQty) > 0 && (
          <Text style={S.hint2}>
            = {finalStock} {effectiveUnit}s
          </Text>
        )}

        {/* DATE & PHOTO */}
        <View style={S.divider} />
        <Text style={S.label}>Date d'expiration (facultatif)</Text>
        <TextInput style={S.input} placeholder="YYYY-MM-DD" placeholderTextColor="#555" value={expirationDate} onChangeText={setExpirationDate} autoCapitalize="none" />

        <Text style={S.label}>Photo (facultatif)</Text>
        <TouchableOpacity style={S.photoBtn} onPress={pickImage}>
          {imageUri ? <Image source={{ uri: imageUri }} style={S.photo} /> : (
            <View style={S.photoPlaceholder}><Ionicons name="camera-outline" size={28} color="#555" /><Text style={{ color: "#555", marginTop: 4 }}>Ajouter</Text></View>
          )}
        </TouchableOpacity>

        {/* RÉSUMÉ */}
        {Number(sellPrice) > 0 && (
          <>
            <View style={S.divider} />
            <Text style={S.sectionTitle}>Résumé</Text>
            <View style={S.summaryCard}>
              <View style={S.sumRow}><Text style={S.sumLabel}>Prix vente</Text><Text style={S.sumVal}>{fmt(Number(sellPrice))} FCFA / {sellLabel}</Text></View>
              {Number(buyPrice) > 0 && (
                <>
                  <View style={S.sumRow}><Text style={S.sumLabel}>Prix achat</Text><Text style={S.sumVal}>{fmt(Math.round(summary.ub))} FCFA / {effectiveUnit}</Text></View>
                  <View style={S.sumRow}><Text style={S.sumLabel}>Bénéfice</Text><Text style={[S.sumVal, { color: summary.profit >= 0 ? "#4ADE80" : "#ef4444" }]}>{fmt(Math.round(summary.profit))} FCFA</Text></View>
                  <View style={S.sumRow}><Text style={S.sumLabel}>Marge</Text><Text style={[S.sumVal, { color: "#A78BFA" }]}>{summary.margin}%</Text></View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={S.footer}>
        <TouchableOpacity style={[S.saveBtn, loading && { opacity: 0.7 }]} onPress={save} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={S.saveText}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>

      {/* Catégorie modal */}
      <Modal visible={showCatPicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Catégorie</Text>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[S.pickItem, category === c && S.pickItemActive]} onPress={() => { setCategory(c); setBaseUnit((UNIT_BY_CAT[c] || ["pièce"])[0]); setShowCatPicker(false); }}>
              <Text style={[S.pickText, category === c && S.pickTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View></View>
      </Modal>

      {/* Unité modal */}
      <Modal visible={showUnitPicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Unité de mesure</Text>
          {units.map(u => (
            <TouchableOpacity key={u} style={[S.pickItem, baseUnit === u && !customUnit && S.pickItemActive]} onPress={() => { setBaseUnit(u); setCustomUnit(""); setShowUnitPicker(false); }}>
              <Text style={[S.pickText, baseUnit === u && !customUnit && S.pickTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput style={[S.input, { flex: 1, marginBottom: 0 }]} placeholder="Autre..." placeholderTextColor="#555" value={customUnit} onChangeText={setCustomUnit} />
            <TouchableOpacity style={[S.btnSm, { paddingVertical: 14, paddingHorizontal: 20 }]} onPress={() => { if (customUnit.trim()) { setBaseUnit(""); setShowUnitPicker(false); } }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Sell unit modal */}
      <Modal visible={showSellUnitPicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Vous vendez en...</Text>
          <TouchableOpacity style={[S.pickItem, !sellUnit && !sellCustomUnit && S.pickItemActive]} onPress={() => { setSellUnit(""); setSellCustomUnit(""); setShowSellUnitPicker(false); }}>
            <Text style={[S.pickText, !sellUnit && !sellCustomUnit && S.pickTextActive]}>À l'unité ({effectiveUnit})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, sellUnit === "Lot" && S.pickItemActive]} onPress={() => { setSellUnit("Lot"); setSellCustomUnit(""); setShowSellUnitPicker(false); }}>
            <Text style={[S.pickText, sellUnit === "Lot" && S.pickTextActive]}>Lot</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, sellUnit === "Pack" && S.pickItemActive]} onPress={() => { setSellUnit("Pack"); setSellCustomUnit(""); setShowSellUnitPicker(false); }}>
            <Text style={[S.pickText, sellUnit === "Pack" && S.pickTextActive]}>Pack</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, sellUnit === "Casier" && S.pickItemActive]} onPress={() => { setSellUnit("Casier"); setSellCustomUnit(""); setShowSellUnitPicker(false); }}>
            <Text style={[S.pickText, sellUnit === "Casier" && S.pickTextActive]}>Casier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, sellUnit === "Carton" && S.pickItemActive]} onPress={() => { setSellUnit("Carton"); setSellCustomUnit(""); setShowSellUnitPicker(false); }}>
            <Text style={[S.pickText, sellUnit === "Carton" && S.pickTextActive]}>Carton</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, sellUnit === "Sac" && S.pickItemActive]} onPress={() => { setSellUnit("Sac"); setSellCustomUnit(""); setShowSellUnitPicker(false); }}>
            <Text style={[S.pickText, sellUnit === "Sac" && S.pickTextActive]}>Sac</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput style={[S.input, { flex: 1, marginBottom: 0 }]} placeholder="Autre..." placeholderTextColor="#555" value={sellCustomUnit} onChangeText={setSellCustomUnit} />
            <TouchableOpacity style={[S.btnSm, { paddingVertical: 14, paddingHorizontal: 20 }]} onPress={() => { if (sellCustomUnit.trim()) { setSellUnit(""); setShowSellUnitPicker(false); } }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Buy unit modal */}
      <Modal visible={showBuyUnitPicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Vous achetez en...</Text>
          <TouchableOpacity style={[S.pickItem, !buyUnit && !buyCustomUnit && S.pickItemActive]} onPress={() => { setBuyUnit(""); setBuyCustomUnit(""); setShowBuyUnitPicker(false); }}>
            <Text style={[S.pickText, !buyUnit && !buyCustomUnit && S.pickTextActive]}>À l'unité ({effectiveUnit})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, buyUnit === "Casier" && S.pickItemActive]} onPress={() => { setBuyUnit("Casier"); setBuyCustomUnit(""); setShowBuyUnitPicker(false); }}>
            <Text style={[S.pickText, buyUnit === "Casier" && S.pickTextActive]}>Casier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, buyUnit === "Carton" && S.pickItemActive]} onPress={() => { setBuyUnit("Carton"); setBuyCustomUnit(""); setShowBuyUnitPicker(false); }}>
            <Text style={[S.pickText, buyUnit === "Carton" && S.pickTextActive]}>Carton</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, buyUnit === "Sac" && S.pickItemActive]} onPress={() => { setBuyUnit("Sac"); setBuyCustomUnit(""); setShowBuyUnitPicker(false); }}>
            <Text style={[S.pickText, buyUnit === "Sac" && S.pickTextActive]}>Sac</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, buyUnit === "Pack" && S.pickItemActive]} onPress={() => { setBuyUnit("Pack"); setBuyCustomUnit(""); setShowBuyUnitPicker(false); }}>
            <Text style={[S.pickText, buyUnit === "Pack" && S.pickTextActive]}>Pack</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, buyUnit === "Palette" && S.pickItemActive]} onPress={() => { setBuyUnit("Palette"); setBuyCustomUnit(""); setShowBuyUnitPicker(false); }}>
            <Text style={[S.pickText, buyUnit === "Palette" && S.pickTextActive]}>Palette</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.pickItem, buyUnit === "Bouteille" && S.pickItemActive]} onPress={() => { setBuyUnit("Bouteille"); setBuyCustomUnit(""); setShowBuyUnitPicker(false); }}>
            <Text style={[S.pickText, buyUnit === "Bouteille" && S.pickTextActive]}>Bouteille</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput style={[S.input, { flex: 1, marginBottom: 0 }]} placeholder="Autre..." placeholderTextColor="#555" value={buyCustomUnit} onChangeText={setBuyCustomUnit} />
            <TouchableOpacity style={[S.btnSm, { paddingVertical: 14, paddingHorizontal: 20 }]} onPress={() => { if (buyCustomUnit.trim()) { setBuyUnit(""); setShowBuyUnitPicker(false); } }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      {/* Stock unit modal */}
      <Modal visible={showStockUnitPicker} transparent animationType="fade">
        <View style={S.modalBg}><View style={S.modalCard}>
          <Text style={S.modalTitle}>Le stock est en...</Text>
          <TouchableOpacity style={[S.pickItem, !stockUnit && S.pickItemActive]} onPress={() => { setStockUnit(""); setShowStockUnitPicker(false); }}>
            <Text style={[S.pickText, !stockUnit && S.pickTextActive]}>{effectiveUnit} (unité de base)</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TextInput style={[S.input, { flex: 1, marginBottom: 0 }]} placeholder="Ex: Carton..." placeholderTextColor="#555" value={stockUnit} onChangeText={setStockUnit} />
            <TouchableOpacity style={[S.btnSm, { paddingVertical: 14, paddingHorizontal: 20 }]} onPress={() => setShowStockUnitPicker(false)}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 55, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", flex: 1 },
  label: { color: "#A8A3C2", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#1A152A", padding: 14, borderRadius: 12, color: "#fff", fontSize: 15, marginBottom: 8 },
  inputHalf: { backgroundColor: "#1A152A", padding: 14, borderRadius: 12, color: "#fff", fontSize: 15, marginBottom: 8, flex: 1 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 14 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  row2: { flexDirection: "row", gap: 8 },
  row3: { flexDirection: "row", gap: 8 },
  hint: { color: "#4ADE80", fontSize: 12, fontWeight: "600", marginBottom: 8, marginTop: -4 },
  hint2: { color: "#4ADE80", fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 4, textAlign: "center" },
  photoBtn: { borderRadius: 14, overflow: "hidden", backgroundColor: "#1A152A" },
  photo: { width: "100%", height: 140, resizeMode: "cover" },
  photoPlaceholder: { height: 90, alignItems: "center", justifyContent: "center" },
  summaryCard: { backgroundColor: "#161228", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(167,139,250,0.15)" },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  sumLabel: { color: "#A8A3C2", fontSize: 13 },
  sumVal: { color: "#fff", fontSize: 13, fontWeight: "700" },
  footer: { paddingBottom: 30, paddingTop: 14, backgroundColor: "rgba(10,6,23,0.96)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  saveBtn: { backgroundColor: "#7C3AED", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 30 },
  modalCard: { backgroundColor: "#18122B", borderRadius: 16, padding: 20 },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 12 },
  pickItem: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 4 },
  pickItemActive: { backgroundColor: "rgba(167,139,250,0.12)" },
  pickText: { color: "#A8A3C2", fontSize: 14 },
  pickTextActive: { color: "#A78BFA", fontWeight: "700" },
  btnSm: { backgroundColor: "#7C3AED", borderRadius: 12, alignItems: "center" },
});
