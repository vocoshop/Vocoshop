import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import API from "../src/api/api";

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
  globalConfidence: number;
  pageCount: number;
  needsReview: boolean;
  createdAt: string;
}

export default function ScanHistoryScreen() {
  const navigation = useNavigation<any>();
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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

    return (
      <TouchableOpacity
        style={styles.scanCard}
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
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historique des scans</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#8A4DFF" size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={scans}
          renderItem={renderScan}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
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
      )}
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
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  scanCard: {
    backgroundColor: "#18122B", borderRadius: 16, padding: 14, marginBottom: 12,
  },
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
