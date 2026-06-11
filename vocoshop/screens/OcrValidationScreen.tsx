import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import API from "../src/api/api";

interface OcrLine {
  text: string;
  productName?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  confidence: number;
  type: string;
  corrected: boolean;
}

interface ScanData {
  _id: string;
  storeId: string;
  rawText: string;
  lines: OcrLine[];
  globalConfidence: number;
  status: string;
}

interface Product {
  _id: string;
  name: string;
  sellPrice: number;
  quantity: number;
  aliases?: string[];
}

export default function OcrValidationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scan: ScanData = route.params?.scan;

  const [lines, setLines] = useState<OcrLine[]>(scan?.lines || []);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const [linkingIndex, setLinkingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  const matchedCount = lines.filter((l) => l.productId).length;
  const unmatchedCount = lines.filter((l) => !l.productId).length;
  const totalAmount = lines.reduce((s, l) => s + (l.total || (l.quantity || 0) * (l.unitPrice || 0)), 0);

  const globalConfidence = scan?.globalConfidence ?? 0;
  const avgConfidence =
    lines.length > 0
      ? Math.round(lines.reduce((s, l) => s + l.confidence, 0) / lines.length)
      : 0;

  const handleEdit = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setEditValue(lines[index].text);
    },
    [lines]
  );

  const saveEdit = useCallback(() => {
    if (editingIndex === null) return;
    const updated = [...lines];
    updated[editingIndex] = {
      ...updated[editingIndex],
      text: editValue,
      corrected: editValue !== updated[editingIndex].text,
    };
    setLines(updated);
    setEditingIndex(null);
  }, [editingIndex, editValue, lines]);

  const updateLineField = useCallback(
    (index: number, field: keyof OcrLine, value: any) => {
      setLines((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value, corrected: true };
        if (field === "quantity" || field === "unitPrice") {
          const qty = field === "quantity" ? value : updated[index].quantity || 0;
          const price = field === "unitPrice" ? value : updated[index].unitPrice || 0;
          updated[index].total = qty * price;
        }
        return updated;
      });
    },
    []
  );

  const removeLine = useCallback((index: number) => {
    Alert.alert("Supprimer", "Supprimer cette ligne ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => setLines((prev) => prev.filter((_, i) => i !== index)),
      },
    ]);
  }, []);

  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res: any = await API.get(`/products?search=${encodeURIComponent(query)}`);
      setSearchResults(res.data?.data || res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const linkProduct = useCallback(
    (index: number, product: Product) => {
      setLines((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          productName: product.name,
          productId: product._id,
          unitPrice: product.sellPrice || updated[index].unitPrice,
          corrected: true,
        };
        if (updated[index].quantity && product.sellPrice) {
          updated[index].total = updated[index].quantity! * product.sellPrice;
        }
        return updated;
      });
      setLinkingIndex(null);
      setSearchQuery("");
      setSearchResults([]);
    },
    []
  );

  const handleValidate = useCallback(async () => {
    if (!scan) return;
    setSaving(true);
    try {
      await API.post(`/ocr/validate/${scan._id}`, {
        lines,
        feedback: { validatedAt: new Date().toISOString() },
      });
      Alert.alert("Validé", "Les données sont enregistrées.", [
        { text: "Importer", onPress: () => handleImport() },
        { text: "OK", style: "cancel" },
      ]);
    } catch (err: any) {
      Alert.alert("Erreur", err?.response?.data?.error || "Erreur");
    } finally {
      setSaving(false);
    }
  }, [scan, lines]);

  const handleImport = useCallback(async () => {
    if (!scan) return;
    setImporting(true);
    try {
      const res = await API.post(`/ocr/import/${scan._id}`);
      const data = res.data as { importedCount: number; errors: string[]; unmatchedCount?: number };
      const { importedCount, errors } = data;
      const unmatched = data.unmatchedCount ?? 0;

      let msg = `${importedCount} ligne(s) importée(s)`;
      if (unmatched > 0) msg += `\n${unmatched} ligne(s) sans produit correspondant`;
      if (errors.length) msg += `\n${errors.length} erreur(s)`;

      Alert.alert("Import terminé", msg, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Erreur", err?.response?.data?.error || "Erreur");
    } finally {
      setImporting(false);
    }
  }, [scan, navigation]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "sale": return "#4CAF50";
      case "stock_in": return "#2196F3";
      case "expense": return "#FF6B6B";
      case "debt": return "#FF9F43";
      default: return "#9CA3AF";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sale": return "Vente";
      case "stock_in": return "Stock";
      case "expense": return "Dépense";
      case "debt": return "Dette";
      default: return "?";
    }
  };

  const getConfidenceColor = (c: number) => {
    if (c >= 80) return "#4CAF50";
    if (c >= 50) return "#FF9F43";
    return "#FF6B6B";
  };

  const renderLine = ({ item, index }: { item: OcrLine; index: number }) => {
    const isLinked = !!item.productId;
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);

    return (
      <View style={[styles.lineCard, !isLinked && styles.lineCardUnlinked]}>
        <View style={styles.lineHeader}>
          <View style={[styles.typeBadge, { backgroundColor: getTypeColor(item.type) + "22" }]}>
            <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
              {getTypeLabel(item.type)}
            </Text>
          </View>

          {isLinked ? (
            <View style={styles.linkedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
              <Text style={styles.linkedText}>Lié</Text>
            </View>
          ) : (
            <View style={styles.unlinkedBadge}>
              <Ionicons name="alert-circle" size={14} color="#FF9F43" />
              <Text style={styles.unlinkedText}>Non lié</Text>
            </View>
          )}

          <View style={[styles.confBadge, { backgroundColor: getConfidenceColor(item.confidence) + "22" }]}>
            <Text style={[styles.confText, { color: getConfidenceColor(item.confidence) }]}>
              {Math.round(item.confidence)}%
            </Text>
          </View>
        </View>

        {editingIndex === index ? (
          <TextInput
            style={styles.editInput}
            value={editValue}
            onChangeText={setEditValue}
            autoFocus
            onSubmitEditing={saveEdit}
            onBlur={saveEdit}
          />
        ) : (
          <TouchableOpacity onPress={() => handleEdit(index)}>
            <Text style={styles.lineText}>
              {item.text}
              {item.corrected && <Text style={styles.correctedBadge}> modifié</Text>}
            </Text>
          </TouchableOpacity>
        )}

        {item.productName && (
          <Text style={styles.matchText}>
            → {item.productName}
          </Text>
        )}

        <View style={styles.lineValues}>
          <View style={styles.valueGroup}>
            <Text style={styles.valueLabel}>Qté</Text>
            <TextInput
              style={styles.valueInput}
              keyboardType="numeric"
              value={item.quantity?.toString() || ""}
              onChangeText={(v) => updateLineField(index, "quantity", parseInt(v) || 0)}
            />
          </View>
          <View style={styles.valueGroup}>
            <Text style={styles.valueLabel}>Prix</Text>
            <TextInput
              style={styles.valueInput}
              keyboardType="numeric"
              value={item.unitPrice?.toString() || ""}
              onChangeText={(v) => updateLineField(index, "unitPrice", parseInt(v) || 0)}
            />
          </View>
          <View style={styles.valueGroup}>
            <Text style={styles.valueLabel}>Total</Text>
            <Text style={styles.valueTotal}>{lineTotal.toLocaleString("fr-FR")} F</Text>
          </View>
        </View>

        <View style={styles.lineActions}>
          {!isLinked && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => setLinkingIndex(index)}
            >
              <Ionicons name="link-outline" size={16} color="#8A4DFF" />
              <Text style={styles.linkBtnText}>Lier</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.lineActionBtn} onPress={() => handleEdit(index)}>
            <Ionicons name="pencil-outline" size={16} color="#8A4DFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.lineActionBtn} onPress={() => removeLine(index)}>
            <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Valider le scan</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{lines.length}</Text>
          <Text style={styles.statLabel}>Lignes</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: matchedCount > 0 ? "#4CAF50" : "#FF6B6B" }]}>
            {matchedCount}/{lines.length}
          </Text>
          <Text style={styles.statLabel}>Produits liés</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: getConfidenceColor(avgConfidence) }]}>
            {avgConfidence}%
          </Text>
          <Text style={styles.statLabel}>Confiance</Text>
        </View>
      </View>

      {totalAmount > 0 && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Montant total estimé</Text>
          <Text style={styles.summaryValue}>{totalAmount.toLocaleString("fr-FR")} FCFA</Text>
        </View>
      )}

      {unmatchedCount > 0 && (
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={16} color="#FF9F43" />
          <Text style={styles.warningText}>
            {unmatchedCount} ligne{unmatchedCount > 1 ? "s" : ""} sans produit lié — clique "Lier" pour associer.
          </Text>
        </View>
      )}

      <FlatList
        data={lines}
        renderItem={renderLine}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune ligne détectée</Text>}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.validateBtn}
          onPress={handleValidate}
          disabled={saving || importing}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.footerText}>Valider</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.importBtn, unmatchedCount > 0 && { opacity: 0.7 }]}
          onPress={handleImport}
          disabled={saving || importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.footerText}>Importer</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={linkingIndex !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lier un produit</Text>
              <TouchableOpacity onPress={() => { setLinkingIndex(null); setSearchQuery(""); setSearchResults([]); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un produit..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={(v) => { setSearchQuery(v); searchProducts(v); }}
              autoFocus
            />

            {searching && <ActivityIndicator color="#8A4DFF" style={{ marginVertical: 16 }} />}

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.productItem}
                  onPress={() => linkingIndex !== null && linkProduct(linkingIndex, item)}
                >
                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.productPrice}>{item.sellPrice?.toLocaleString("fr-FR")} F</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                !searching && searchQuery.length >= 2 ? (
                  <Text style={styles.emptySearch}>Aucun produit trouvé</Text>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statsRow: {
    flexDirection: "row", justifyContent: "space-around",
    paddingVertical: 12, marginHorizontal: 20,
    backgroundColor: "#18122B", borderRadius: 16, marginBottom: 8,
  },
  statBox: { alignItems: "center" },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "900" },
  statLabel: { color: "#A8A3C2", fontSize: 11, marginTop: 2 },
  summaryBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginHorizontal: 20, marginBottom: 8, padding: 12,
    backgroundColor: "#1A2A1A", borderRadius: 12, borderWidth: 1, borderColor: "#2A4A2A",
  },
  summaryLabel: { color: "#7DA6FF", fontSize: 12, fontWeight: "600" },
  summaryValue: { color: "#4CAF50", fontSize: 18, fontWeight: "900" },
  warningBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#2A1F0A", marginHorizontal: 20, marginBottom: 8,
    padding: 10, borderRadius: 10, gap: 8,
  },
  warningText: { color: "#FF9F43", fontSize: 12, flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  lineCard: {
    backgroundColor: "#18122B", borderRadius: 14, padding: 12, marginBottom: 8,
  },
  lineCardUnlinked: { borderWidth: 1, borderColor: "#FF9F4333" },
  lineHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeText: { fontSize: 10, fontWeight: "700" },
  linkedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: "#1A3A1A" },
  linkedText: { color: "#4CAF50", fontSize: 10, fontWeight: "600" },
  unlinkedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: "#2A1F0A" },
  unlinkedText: { color: "#FF9F43", fontSize: 10, fontWeight: "600" },
  confBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  confText: { fontSize: 10, fontWeight: "700" },
  lineText: { color: "#E8E4F2", fontSize: 13, lineHeight: 18 },
  correctedBadge: { color: "#FF9F43", fontSize: 11, fontStyle: "italic" },
  matchText: { color: "#7DA6FF", fontSize: 12, marginTop: 4 },
  lineValues: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#2A2040",
  },
  valueGroup: { alignItems: "center" },
  valueLabel: { color: "#666", fontSize: 10, marginBottom: 2 },
  valueInput: {
    backgroundColor: "#241C39", color: "#fff", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, fontWeight: "700",
    width: 60, textAlign: "center",
  },
  valueTotal: { color: "#4CAF50", fontSize: 13, fontWeight: "700" },
  lineActions: {
    flexDirection: "row", justifyContent: "flex-end", alignItems: "center",
    gap: 8, marginTop: 8,
  },
  linkBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#8A4DFF22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  linkBtnText: { color: "#8A4DFF", fontSize: 11, fontWeight: "600" },
  lineActionBtn: { padding: 4 },
  editInput: {
    backgroundColor: "#241C39", color: "#fff", borderRadius: 8,
    padding: 8, fontSize: 13, marginBottom: 4,
  },
  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", gap: 12, padding: 16, paddingBottom: 30,
    backgroundColor: "#0A0617", borderTopWidth: 1, borderTopColor: "#1E1735",
  },
  validateBtn: {
    flex: 1, flexDirection: "row", backgroundColor: "#4CAF50",
    padding: 14, borderRadius: 12, justifyContent: "center", alignItems: "center", gap: 8,
  },
  importBtn: {
    flex: 1, flexDirection: "row", backgroundColor: "#8A4DFF",
    padding: 14, borderRadius: 12, justifyContent: "center", alignItems: "center", gap: 8,
  },
  footerText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyText: { color: "#A8A3C2", textAlign: "center", marginTop: 40 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#18122B", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  searchInput: {
    backgroundColor: "#241C39", color: "#fff", borderRadius: 12,
    padding: 14, fontSize: 15, marginBottom: 12,
  },
  productItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#241C39", padding: 14, borderRadius: 12, marginBottom: 8,
  },
  productName: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },
  productPrice: { color: "#4CAF50", fontSize: 14, fontWeight: "700" },
  emptySearch: { color: "#666", textAlign: "center", marginTop: 20, fontSize: 14 },
});
