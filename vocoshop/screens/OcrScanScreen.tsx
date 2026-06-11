import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import API from "../src/api/api";
import {
  enqueueOcrScan,
  getPendingCount,
  syncPendingScans,
  onOcrSync,
} from "../src/api/ocr/ocrOfflineQueue";
import { compressImage, checkImageQuality } from "../src/utils/imageProcessing";

const TABS = [
  { key: "sale", label: "Vente", icon: "cart-outline" as const },
  { key: "stock_in", label: "Stock", icon: "cube-outline" as const },
  { key: "expense", label: "Dépense", icon: "wallet-outline" as const },
  { key: "history", label: "Historique", icon: "time-outline" as const },
];

interface ScanLine {
  text: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  type: string;
}

interface ScanItem {
  _id: string;
  status: string;
  lines: ScanLine[];
  images: string[];
  globalConfidence: number;
  pageCount: number;
  needsReview: boolean;
  createdAt: string;
}

export default function OcrScanScreen() {
  const navigation = useNavigation<any>();
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhotos, setCapturedPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [scanning, setScanning] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [mode, setMode] = useState<"camera" | "review">("camera");
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState("sale");

  const pageType = activeTab === "history" ? "sale" : activeTab;

  const takePicture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });
      setCompressing(true);

      const compressed = await compressImage(photo.uri);

      const qualityCheck = await checkImageQuality(compressed.base64);
      if (!qualityCheck.isSharp) {
        Alert.alert("Attention", qualityCheck.warning || "Image floue, reprends la photo");
      }

      setCapturedPhotos((prev) => [...prev, { uri: compressed.uri, base64: compressed.base64 }]);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de prendre la photo");
    } finally {
      setCompressing(false);
    }
  }, []);

  const removePhoto = useCallback((index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const sendForOcr = useCallback(async () => {
    if (capturedPhotos.length === 0) return;
    setScanning(true);
    try {
      const images = capturedPhotos.map((p) => `data:image/jpeg;base64,${p.base64}`);

      try {
        const res = await API.post("/ocr/scan", {
          images,
          pageCount: images.length,
          defaultLineType: pageType,
        });
        navigation.replace("OcrValidation", { scan: res.data });
      } catch (apiErr) {
        await enqueueOcrScan(capturedPhotos.map((p) => p.base64), pageType);
        Alert.alert(
          "Scan mis en attente",
          "Impossible de contacter le serveur. Le scan sera synchronisé automatiquement.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erreur lors du scan";
      Alert.alert("Erreur OCR", msg);
    } finally {
      setScanning(false);
    }
  }, [capturedPhotos, navigation, pageType]);

  const finishCapture = useCallback(() => {
    if (capturedPhotos.length === 0) return;
    setMode("review");
  }, [capturedPhotos]);

  useEffect(() => {
    getPendingCount().then(setPendingCount);
    const unsub = onOcrSync(() => getPendingCount().then(setPendingCount));
    return unsub;
  }, []);

  const pickFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setCompressing(true);
        const compressed = await compressImage(result.assets[0].uri);
        setCapturedPhotos((prev) => [...prev, { uri: compressed.uri, base64: compressed.base64 }]);
      }
    } catch {
      Alert.alert("Info", "Utilise la caméra pour scanner ton cahier");
    } finally {
      setCompressing(false);
    }
  }, []);

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
            Pour scanner tes documents et cahiers
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Autoriser la caméra</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner un cahier</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons name={t.icon} size={14} color={activeTab === t.key ? "#8A4DFF" : "#666"} />
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "history" ? (
        <HistoryTab navigation={navigation} />
      ) : mode === "camera" ? (
        <>
          {pendingCount > 0 && (
            <View style={styles.pendingBanner}>
              <Ionicons name="cloud-upload-outline" size={18} color="#FF9F43" />
              <Text style={styles.pendingBannerText}>
                {pendingCount} scan{pendingCount > 1 ? "s" : ""} en attente de synchronisation
              </Text>
            </View>
          )}

          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              ratio="4:3"
            />

            <View style={styles.overlayContainer}>
              <View style={styles.overlayTop}>
                <Text style={styles.overlayHint}>Cadre le cahier dans le cadre</Text>
              </View>
              <View style={styles.overlayMid}>
                <View style={styles.overlaySide} />
                <View style={styles.frameBox}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom} />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.galleryBtn}
              onPress={pickFromGallery}
              disabled={compressing}
            >
              <Ionicons name="images-outline" size={24} color={compressing ? "#555" : "#fff"} />
              <Text style={[styles.galleryText, compressing && { color: "#555" }]}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureBtn}
              onPress={takePicture}
              disabled={compressing}
            >
              {compressing ? (
                <ActivityIndicator color="#8A4DFF" size="small" />
              ) : (
                <>
                  <View style={styles.captureInner} />
                  {capturedPhotos.length > 0 && (
                    <View style={styles.captureBadge}>
                      <Text style={styles.captureBadgeText}>{capturedPhotos.length}</Text>
                    </View>
                  )}
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.doneBtn, capturedPhotos.length === 0 && { opacity: 0.4 }]}
              onPress={finishCapture}
              disabled={capturedPhotos.length === 0}
            >
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.doneBtnText}>OK</Text>
            </TouchableOpacity>
          </View>

          {capturedPhotos.length > 0 && (
            <View style={styles.thumbStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbScroll}>
                {capturedPhotos.map((p, i) => (
                  <View key={i} style={styles.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} />
                    <TouchableOpacity style={styles.thumbDel} onPress={() => removePhoto(i)}>
                      <Ionicons name="close-circle" size={22} color="#FF6B6B" />
                    </TouchableOpacity>
                    <Text style={styles.thumbNum}>{i + 1}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        <View style={styles.reviewContainer}>
          <ScrollView
            style={styles.reviewScroll}
            contentContainerStyle={styles.reviewScrollContent}
          >
            {capturedPhotos.map((p, i) => (
              <View key={i} style={styles.reviewCard}>
                <Image source={{ uri: p.uri }} style={styles.reviewImg} />
                <TouchableOpacity
                  style={styles.reviewRetake}
                  onPress={() => removePhoto(i)}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  <Text style={styles.reviewRetakeText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.reviewActions}>
            <TouchableOpacity
              style={styles.reviewAddBtn}
              onPress={() => setMode("camera")}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.reviewAddText}>Ajouter une photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reviewSendBtn}
              onPress={sendForOcr}
              disabled={scanning}
            >
              {scanning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={20} color="#fff" />
                  <Text style={styles.reviewSendText}>
                    Analyser ({capturedPhotos.length} photo{capturedPhotos.length > 1 ? "s" : ""})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function HistoryTab({ navigation }: { navigation: any }) {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadScans = useCallback(async (pageNum: number = 1, append = false) => {
    try {
      const res: any = await API.get(`/ocr/history?page=${pageNum}&limit=20`);
      const data = res.data?.data || [];
      if (append) {
        setScans((prev) => [...prev, ...data]);
      } else {
        setScans(data);
      }
      setHasMore(data.length >= 20);
      setPage(pageNum);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadScans(1);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadScans(1);
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadScans(page + 1, true);
    }
  }, [page, hasMore, loading]);

  const downloadImages = useCallback(async (scan: ScanItem) => {
    if (!scan.images || scan.images.length === 0) {
      Alert.alert("Info", "Aucune image pour ce scan");
      return;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission requise", "Autorise l'accès à la galerie pour sauvegarder les images");
      return;
    }

    setDownloadingId(scan._id);
    try {
      let saved = 0;
      for (let i = 0; i < scan.images.length; i++) {
        const img = scan.images[i];
        const base64Data = img.includes(",") ? img.split(",")[1] : img;
        const fileName = `scan_${scan._id.slice(-8)}_${i + 1}.jpg`;
        const fileUri = FileSystem.cacheDirectory + fileName;

        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        await MediaLibrary.saveToLibraryAsync(fileUri);
        saved++;
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }

      Alert.alert("Succès", `${saved} image${saved > 1 ? "s" : ""} sauvegardée${saved > 1 ? "s" : ""} dans la galerie`);
    } catch (err) {
      Alert.alert("Erreur", "Impossible de sauvegarder les images");
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "imported": return "#4CAF50";
      case "validated": return "#2196F3";
      case "pending": return "#FF9F43";
      case "rejected": return "#FF6B6B";
      default: return "#9CA3AF";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "imported": return "Importé";
      case "validated": return "Validé";
      case "pending": return "En attente";
      case "rejected": return "Rejeté";
      default: return status;
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

  const renderScan = ({ item }: { item: ScanItem }) => {
    const saleLines = item.lines.filter((l) => l.type === "sale");
    const totalRevenue = saleLines.reduce((s, l) => s + (l.total || 0), 0);
    const matchedCount = item.lines.filter((l) => l.productName).length;
    const date = new Date(item.createdAt);
    const dateStr = date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const isDownloading = downloadingId === item._id;
    const hasImages = item.images && item.images.length > 0;

    return (
      <View style={styles.scanCard}>
        <TouchableOpacity
          style={styles.scanCardBody}
          onPress={() => navigation.navigate("OcrValidation", {
            scan: { _id: item._id, lines: item.lines, globalConfidence: item.globalConfidence, status: item.status, storeId: "" }
          })}
        >
          <View style={styles.scanHeader}>
            <View style={styles.scanDate}>
              <Ionicons name="calendar-outline" size={14} color="#666" />
              <Text style={styles.dateText}>{dateStr} {timeStr}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "22" }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>

          <View style={styles.scanStats}>
            <View style={styles.scanStat}>
              <Ionicons name="document-text-outline" size={16} color="#8A4DFF" />
              <Text style={styles.scanStatValue}>{item.lines.length}</Text>
              <Text style={styles.scanStatLabel}>lignes</Text>
            </View>
            <View style={styles.scanStat}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
              <Text style={styles.scanStatValue}>{matchedCount}</Text>
              <Text style={styles.scanStatLabel}>liés</Text>
            </View>
            <View style={styles.scanStat}>
              <Ionicons name="camera-outline" size={16} color="#666" />
              <Text style={styles.scanStatValue}>{item.pageCount}</Text>
              <Text style={styles.scanStatLabel}>page{item.pageCount > 1 ? "s" : ""}</Text>
            </View>
            {totalRevenue > 0 && (
              <View style={styles.scanStat}>
                <Ionicons name="cash-outline" size={16} color="#4CAF50" />
                <Text style={[styles.scanStatValue, { color: "#4CAF50" }]}>{totalRevenue.toLocaleString("fr-FR")} F</Text>
              </View>
            )}
          </View>

          {item.needsReview && (
            <View style={styles.reviewBadge}>
              <Ionicons name="warning-outline" size={12} color="#FF9F43" />
              <Text style={styles.reviewText}>À vérifier</Text>
            </View>
          )}

          <View style={styles.scanPreview}>
            {item.lines.slice(0, 3).map((line, i) => (
              <Text key={i} style={styles.previewLine}>
                <Text style={{ color: "#666" }}>{getTypeLabel(line.type)} </Text>
                {line.text}
                {line.total ? <Text style={styles.previewTotal}> {line.total.toLocaleString("fr-FR")}F</Text> : null}
              </Text>
            ))}
            {item.lines.length > 3 && (
              <Text style={styles.previewMore}>+{item.lines.length - 3} autres lignes</Text>
            )}
          </View>
        </TouchableOpacity>

        {hasImages && (
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => downloadImages(item)}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator color="#8A4DFF" size="small" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#8A4DFF" />
            )}
            <Text style={styles.downloadText}>
              {isDownloading ? "Sauvegarde..." : `${item.images.length} photo${item.images.length > 1 ? "s" : ""}`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator color="#8A4DFF" size="large" style={{ marginTop: 40 }} />;
  }

  return (
    <FlatList
      data={scans}
      renderItem={renderScan}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.historyList}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A4DFF" />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Ionicons name="scan-outline" size={48} color="#333" />
          <Text style={styles.emptyText}>Aucun scan</Text>
          <Text style={styles.emptyHint}>Scanne un cahier pour commencer</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617" },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A1F0A",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  pendingBannerText: { color: "#FF9F43", fontSize: 13, fontWeight: "600" },
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
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#18122B",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: "#2A1F50" },
  tabLabel: { color: "#666", fontSize: 12, fontWeight: "600" },
  tabLabelActive: { color: "#8A4DFF" },
  cameraContainer: {
    flex: 1,
    position: "relative",
  },
  camera: { flex: 1 },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 0.08,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 10,
  },
  overlayHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  overlayMid: {
    flexDirection: "row",
    flex: 1,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  frameBox: {
    width: "78%",
    height: "100%",
    position: "relative",
  },
  overlayBottom: {
    flex: 0.05,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: 2.5, borderLeftWidth: 2.5,
    borderColor: "#8A4DFF",
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: 2.5, borderRightWidth: 2.5,
    borderColor: "#8A4DFF",
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: 2.5, borderLeftWidth: 2.5,
    borderColor: "#8A4DFF",
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: 2.5, borderRightWidth: 2.5,
    borderColor: "#8A4DFF",
    borderBottomRightRadius: 4,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 30,
    backgroundColor: "rgba(10,6,23,0.95)",
  },
  galleryBtn: { alignItems: "center" },
  galleryText: { color: "#A8A3C2", fontSize: 11, marginTop: 4 },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3.5, borderColor: "#8A4DFF",
    justifyContent: "center", alignItems: "center",
  },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#8A4DFF" },
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
  doneBtn: { alignItems: "center" },
  doneBtnText: { color: "#A8A3C2", fontSize: 11, marginTop: 4 },
  thumbStrip: {
    backgroundColor: "#0A0617",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E1735",
  },
  thumbScroll: { paddingHorizontal: 16, gap: 8 },
  thumbWrap: { position: "relative" },
  thumb: { width: 52, height: 60, borderRadius: 8, backgroundColor: "#241C39" },
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
    position: "absolute", bottom: -2, right: -2,
    backgroundColor: "#8A4DFF", color: "#fff", fontSize: 9, fontWeight: "700",
    width: 16, height: 16, borderRadius: 8, textAlign: "center", lineHeight: 16,
    overflow: "hidden",
  },
  reviewContainer: { flex: 1 },
  reviewScroll: { flex: 1 },
  reviewScrollContent: { padding: 16, gap: 16 },
  reviewCard: {
    backgroundColor: "#18122B", borderRadius: 16, overflow: "hidden",
  },
  reviewImg: { width: "100%", height: 200, resizeMode: "cover" },
  reviewRetake: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 10, gap: 6,
  },
  reviewRetakeText: { color: "#FF6B6B", fontSize: 13, fontWeight: "600" },
  reviewActions: {
    padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: "#1E1735",
  },
  reviewAddBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#241C39", padding: 16, borderRadius: 14, gap: 8,
  },
  reviewAddText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  reviewSendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#8A4DFF", padding: 16, borderRadius: 14, gap: 8,
  },
  reviewSendText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  permBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  permTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 16 },
  permDesc: { color: "#A8A3C2", textAlign: "center", marginTop: 8, marginBottom: 24 },
  permBtn: { backgroundColor: "#8A4DFF", paddingVertical: 14, paddingHorizontal: 30, borderRadius: 14 },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  historyList: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  scanCard: {
    backgroundColor: "#18122B", borderRadius: 16, marginBottom: 12, overflow: "hidden",
  },
  scanCardBody: { padding: 14 },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#2A2040",
  },
  downloadText: { color: "#8A4DFF", fontSize: 12, fontWeight: "600" },
  scanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  scanDate: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { color: "#666", fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },
  scanStats: { flexDirection: "row", gap: 16, marginBottom: 10 },
  scanStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  scanStatValue: { color: "#fff", fontSize: 13, fontWeight: "700" },
  scanStatLabel: { color: "#666", fontSize: 11 },
  reviewBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#2A1F0A", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, alignSelf: "flex-start", marginBottom: 8,
  },
  reviewText: { color: "#FF9F43", fontSize: 10, fontWeight: "600" },
  scanPreview: { borderTopWidth: 1, borderTopColor: "#2A2040", paddingTop: 8 },
  previewLine: { color: "#A8A3C2", fontSize: 12, lineHeight: 18 },
  previewTotal: { color: "#4CAF50", fontWeight: "700" },
  previewMore: { color: "#666", fontSize: 11, marginTop: 4, fontStyle: "italic" },
  emptyBox: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#666", fontSize: 16, marginTop: 12 },
  emptyHint: { color: "#444", fontSize: 13, marginTop: 4 },
});
