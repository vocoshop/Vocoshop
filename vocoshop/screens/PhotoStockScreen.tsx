import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import API from "../src/api/api";
import { compressImage } from "../src/utils/imageProcessing";

const UNIT_OPTIONS = [
  "pièce",
  "litre",
  "kg",
  "sachet",
  "carton",
  "bouteille",
  "sac",
  "rouleau",
  "paquet",
  "boîte",
  "pot",
  "galon",
  "tasse",
  "portion",
];

interface DetectedProduct {
  name: string;
  category: string;
  unit: string;
  estimatedQuantity: number;
  suggestedExpirationDate: string;
  suggestedSellPrice: number;
  suggestedPurchasePrice: number;
  quantity: number;
  sellPrice: number;
  purchasePrice: number;
  expirationDate: string;
}

export default function PhotoStockScreen() {
  const navigation = useNavigation<any>();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [mode, setMode] = useState<"camera" | "preview" | "results">("camera");
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [products, setProducts] = useState<DetectedProduct[]>([]);
  const [unitPickerIndex, setUnitPickerIndex] = useState<number | null>(null);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });
      const compressed = await compressImage(photo.uri);
      setCapturedPhotos((prev) => [...prev, compressed.base64]);
    } catch {
      Alert.alert("Erreur", "Impossible de prendre la photo");
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const compressed = await compressImage(result.assets[0].uri);
        setCapturedPhotos((prev) => [...prev, compressed.base64]);
      }
    } catch {
      Alert.alert("Info", "Erreur lors de la sélection");
    }
  }, []);

  const removePhoto = useCallback((index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const analyzePhotos = useCallback(async () => {
    if (capturedPhotos.length === 0) return;
    setAnalyzing(true);
    try {
      const images = capturedPhotos.map(
        (p) => `data:image/jpeg;base64,${p}`
      );
      const res = await API.post("/ai/vision-products", { images });
      const data = res.data as { products: any[] };
      const detected = (data.products || []).map((p) => ({
        name: p.name || "",
        category: p.category || "",
        unit: p.unit || "pièce",
        estimatedQuantity: Math.max(1, parseInt(p.estimatedQuantity) || 1),
        suggestedExpirationDate: p.suggestedExpirationDate || "",
        suggestedSellPrice: p.suggestedSellPrice || 0,
        suggestedPurchasePrice: p.suggestedPurchasePrice || 0,
        quantity: Math.max(1, parseInt(p.estimatedQuantity) || 1),
        sellPrice: p.suggestedSellPrice || 0,
        purchasePrice: p.suggestedPurchasePrice || 0,
        expirationDate: p.suggestedExpirationDate || "",
        packaging: p.packaging || null,
      }));

      if (detected.length === 0) {
        Alert.alert("Aucun produit détecté", "L'IA n'a pas reconnu de produits. Essaye avec une meilleure photo.");
        return;
      }

      // Séparer : existants (avec _id) et nouveaux
      const existings = detected.filter((p: any) => p._id);
      const news = detected.filter((p: any) => !p._id);

      // Importer les existants directement
      if (existings.length > 0) {
        try {
          await API.post("/ai/vision-products/import", { products: existings });
        } catch {}
      }

      // Ouvrir l'écran de création pour le 1er nouveau produit
      if (news.length > 0) {
        const first = news[0];
        const pkg = first.packaging;
        navigation.navigate("CreateProduct", {
          prefill: {
            name: first.name || "",
            category: first.category || "",
            sellPrice: first.sellPrice || 0,
            baseUnit: first.unit || "pièce",
            buyUnit: pkg?.name || "",
            buyQty: pkg?.contains || "",
            buyPrice: first.purchasePrice || "",
            stockQty: String(first.quantity || ""),
            expirationDate: first.expirationDate || "",
          },
        });
        if (news.length > 1 || existings.length > 0) {
          const msg = [];
          if (existings.length > 0) msg.push(`${existings.length} produit(s) existant(s) mis à jour.`);
          if (news.length > 1) msg.push(`${news.length - 1} autre(s) nouveau(x) à créer manuellement.`);
          Alert.alert("Import partiel", msg.join("\n"));
        }
        return;
      }

      Alert.alert("Import terminé", `${existings.length} produit(s) mis à jour.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || "Erreur lors de l'analyse";
      Alert.alert("Erreur", msg);
    } finally {
      setAnalyzing(false);
    }
  }, [capturedPhotos]);

  const renderUnitPicker = () => {
    if (unitPickerIndex === null) return null;
    return (
      <Modal visible transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir l'unité</Text>
              <TouchableOpacity onPress={() => setUnitPickerIndex(null)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={UNIT_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.unitOption,
                    products[unitPickerIndex]?.unit === item &&
                      styles.unitOptionActive,
                  ]}
                  onPress={() => {
                    updateProduct(unitPickerIndex, "unit", item);
                    setUnitPickerIndex(null);
                  }}
                >
                  <Text
                    style={[
                      styles.unitOptionText,
                      products[unitPickerIndex]?.unit === item &&
                        styles.unitOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {products[unitPickerIndex]?.unit === item && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#8A4DFF"
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#8A4DFF" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permBox}>
          <Ionicons name="camera-outline" size={48} color="#8A4DFF" />
          <Text style={styles.permTitle}>Accès caméra requis</Text>
          <Text style={styles.permDesc}>
            Pour prendre des photos de produits
          </Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={requestPermission}
          >
            <Text style={styles.permBtnText}>Autoriser la caméra</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === "results"
            ? "Produits détectés"
            : "Photo des produits"}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {mode === "camera" || mode === "preview" ? (
        <>
          {mode === "camera" ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                ratio="4:3"
              />
              <View style={styles.overlayContainer}>
                <View style={styles.overlayTop}>
                  <Text style={styles.overlayHint}>
                    Photo 1 : l'unité · Photo 2 : l'emballage (casier, carton, sac)
                  </Text>
                  <Text style={styles.overlaySub}>
                    Prends 1-3 photos pour meilleure reconnaissance
                  </Text>
                </View>
                <View style={styles.overlayMid}>
                  <View style={styles.overlaySide} />
                  <View style={styles.frameBox}>
                    <View
                      style={[styles.corner, styles.cornerTL]}
                    />
                    <View
                      style={[styles.corner, styles.cornerTR]}
                    />
                    <View
                      style={[styles.corner, styles.cornerBL]}
                    />
                    <View
                      style={[styles.corner, styles.cornerBR]}
                    />
                  </View>
                  <View style={styles.overlaySide} />
                </View>
                <View style={styles.overlayBottom} />
              </View>
            </View>
          ) : (
            <View style={styles.reviewContainer}>
              <ScrollView
                contentContainerStyle={styles.reviewScrollContent}
              >
                {capturedPhotos.map((p, i) => (
                  <View key={i} style={styles.reviewCard}>
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${p}`,
                      }}
                      style={styles.reviewImg}
                    />
                    <TouchableOpacity
                      style={styles.reviewRetake}
                      onPress={() => removePhoto(i)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#FF6B6B"
                      />
                      <Text style={styles.reviewRetakeText}>
                        Supprimer
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.galleryBtn}
              onPress={pickFromGallery}
            >
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.actionLabel}>Galerie</Text>
            </TouchableOpacity>

            {mode === "camera" ? (
              <TouchableOpacity
                style={styles.captureBtn}
                onPress={takePicture}
              >
                <View style={styles.captureInner} />
                {capturedPhotos.length > 0 && (
                  <View style={styles.captureBadge}>
                    <Text style={styles.captureBadgeText}>
                      {capturedPhotos.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.captureBtn}
                onPress={() => setMode("camera")}
              >
                <Ionicons name="camera" size={30} color="#8A4DFF" />
              </TouchableOpacity>
            )}

            {capturedPhotos.length > 0 ? (
              mode === "camera" ? (
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setMode("preview")}
                >
                  <Ionicons name="checkmark" size={24} color="#fff" />
                  <Text style={styles.actionLabel}>
                    ({capturedPhotos.length})
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.analyzeBtn,
                    analyzing && { opacity: 0.6 },
                  ]}
                  onPress={analyzePhotos}
                  disabled={analyzing}
                >
                  {analyzing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="sparkles-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.analyzeBtnText}>
                        Analyser
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )
            ) : (
              <View style={{ width: 80 }} />
            )}
          </View>

          {capturedPhotos.length > 0 && (
            <View style={styles.thumbStrip}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbScroll}
              >
                {capturedPhotos.map((p, i) => (
                  <View key={i} style={styles.thumbWrap}>
                    <Image
                      source={{
                        uri: `data:image/jpeg;base64,${p}`,
                      }}
                      style={styles.thumb}
                    />
                    <TouchableOpacity
                      style={styles.thumbDel}
                      onPress={() => removePhoto(i)}
                    >
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color="#FF6B6B"
                      />
                    </TouchableOpacity>
                    <Text style={styles.thumbNum}>{i + 1}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.resultsScroll}
          >
            {products.map((p, i) => (
              <View key={i} style={styles.productCard}>
                <View style={styles.productCardHeader}>
                  <Text style={styles.productIndex}>#{i + 1}</Text>
                  <TouchableOpacity onPress={() => removeProduct(i)}>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#FF6B6B"
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Nom du produit</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={p.name}
                  onChangeText={(v) => updateProduct(i, "name", v)}
                />

                <Text style={styles.fieldLabel}>Catégorie</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={p.category}
                  onChangeText={(v) =>
                    updateProduct(i, "category", v)
                  }
                />

                <View style={styles.fieldRow}>
                  <View style={styles.fieldThird}>
                    <Text style={styles.fieldLabel}>Quantité</Text>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={String(p.quantity)}
                      onChangeText={(v) =>
                        updateProduct(
                          i,
                          "quantity",
                          Math.max(1, parseInt(v) || 1)
                        )
                      }
                    />
                  </View>
                  <View style={styles.fieldThird}>
                    <Text style={styles.fieldLabel}>Unité</Text>
                    <TouchableOpacity
                      style={styles.unitPicker}
                      onPress={() => setUnitPickerIndex(i)}
                    >
                      <Text style={styles.unitPickerText}>{p.unit}</Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color="#A8A3C2"
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.fieldThird}>
                    <Text style={styles.fieldLabel}>Prix achat</Text>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={String(p.purchasePrice || "")}
                      onChangeText={(v) =>
                        updateProduct(
                          i,
                          "purchasePrice",
                          Math.max(0, parseInt(v) || 0)
                        )
                      }
                    />
                  </View>
                </View>

                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>
                      Prix vente (FCFA)
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      keyboardType="numeric"
                      value={String(p.sellPrice || "")}
                      onChangeText={(v) =>
                        updateProduct(
                          i,
                          "sellPrice",
                          Math.max(0, parseInt(v) || 0)
                        )
                      }
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>
                      Expiration (AAAA-MM-JJ)
                    </Text>
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="2026-12-31"
                      placeholderTextColor="#555"
                      value={p.expirationDate}
                      onChangeText={(v) =>
                        updateProduct(i, "expirationDate", v)
                      }
                    />
                  </View>
                </View>
              </View>
            ))}

            {products.length === 0 && (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="cube-outline"
                  size={48}
                  color="#333"
                />
                <Text style={styles.emptyText}>
                  Aucun produit détecté
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setMode("camera")}
            >
              <Ionicons
                name="camera-outline"
                size={20}
                color="#fff"
              />
              <Text style={styles.footerText}>Reprendre photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.importBtn,
                importing && { opacity: 0.6 },
                products.length === 0 && { opacity: 0.3 },
              ]}
              onPress={importProducts}
              disabled={importing || products.length === 0}
            >
              {importing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="download-outline"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.footerText}>
                    Ajouter au stock ({products.length})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {renderUnitPicker()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  cameraContainer: { flex: 1, position: "relative" },
  overlayContainer: { ...StyleSheet.absoluteFillObject },
  overlayTop: {
    flex: 0.08,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 10,
  },
  overlayHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
  },
  overlaySub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  overlayMid: { flexDirection: "row", flex: 1 },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  frameBox: { width: "78%", height: "100%", position: "relative" },
  overlayBottom: { flex: 0.05, backgroundColor: "rgba(0,0,0,0.45)" },
  corner: { position: "absolute", width: 22, height: 22 },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: "#8A4DFF",
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: "#8A4DFF",
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: "#8A4DFF",
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: "#8A4DFF",
    borderBottomRightRadius: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "rgba(10,6,23,0.95)",
  },
  galleryBtn: { alignItems: "center", width: 80 },
  actionLabel: { color: "#A8A3C2", fontSize: 11, marginTop: 4 },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3.5,
    borderColor: "#8A4DFF",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#8A4DFF",
  },
  captureBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
  },
  captureBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  doneBtn: { alignItems: "center", width: 80 },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8A4DFF",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
  },
  analyzeBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  thumbStrip: {
    backgroundColor: "#0A0617",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E1735",
  },
  thumbScroll: { paddingHorizontal: 16, gap: 8 },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 52,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#241C39",
  },
  thumbDel: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  thumbNum: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#8A4DFF",
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    width: 16,
    height: 16,
    borderRadius: 8,
    textAlign: "center",
    lineHeight: 16,
    overflow: "hidden",
  },
  reviewContainer: { flex: 1 },
  reviewScrollContent: { padding: 16, gap: 16 },
  reviewCard: {
    backgroundColor: "#18122B",
    borderRadius: 16,
    overflow: "hidden",
  },
  reviewImg: { width: "100%", height: 200, resizeMode: "cover" },
  reviewRetake: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 6,
  },
  reviewRetakeText: { color: "#FF6B6B", fontSize: 13, fontWeight: "600" },
  resultsScroll: { padding: 16, paddingBottom: 120 },
  productCard: {
    backgroundColor: "#18122B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  productCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  productIndex: {
    color: "#8A4DFF",
    fontSize: 14,
    fontWeight: "800",
  },
  fieldLabel: {
    color: "#A8A3C2",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 8,
  },
  fieldInput: {
    backgroundColor: "#241C39",
    color: "#fff",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldHalf: { flex: 1 },
  fieldThird: { flex: 1 },
  unitPicker: {
    backgroundColor: "#241C39",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unitPickerText: { color: "#fff", fontSize: 15, flex: 1 },
  emptyBox: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#666", fontSize: 16, marginTop: 12 },
  permBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  permTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 16,
  },
  permDesc: {
    color: "#A8A3C2",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  permBtn: {
    backgroundColor: "#8A4DFF",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 14,
  },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingBottom: 30,
    backgroundColor: "#0A0617",
    borderTopWidth: 1,
    borderTopColor: "#1E1735",
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#241C39",
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  importBtn: {
    flex: 2,
    flexDirection: "row",
    backgroundColor: "#8A4DFF",
    padding: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  footerText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#18122B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  unitOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#241C39",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  unitOptionActive: {
    borderWidth: 1,
    borderColor: "#8A4DFF",
  },
  unitOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  unitOptionTextActive: {
    color: "#8A4DFF",
    fontWeight: "700",
  },
});
