// screens/ReportDetailScreen.tsx
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type RouteParams = { reportId: string };

type ReportSale = {
  productName: string;
  quantity: number;
  unitPrice: number;
  purchasePrice?: number;
  totalAmount: number;
  lineProfit?: number;
};

type DailyReport = {
  _id: string;
  date: string;
  totalSales: number;
  totalRevenue: number;
  grossProfit: number;
  cogs: number;
  netProfit: number;
  marginPercent: number;
  sales: ReportSale[];
};

export default function ReportDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { reportId } = (route.params || {}) as RouteParams;

  const { token, storeId } = useContext(AuthContext);

  const headers = useMemo(
    () => ({
      Authorization: token ? `Bearer ${token}` : "",
      "x-store-id": storeId || "",
    }),
    [token, storeId]
  );

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [storeName, setStoreName] = useState("");
  const [shopId, setShopId] = useState("");

  const canLoad = !!reportId && !!token && !!storeId;

  const money = (v?: number) =>
    `${Math.round(v ?? 0).toLocaleString("fr-FR")} FCFA`;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const formatDateShort = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const load = useCallback(async () => {
    if (!canLoad) { setLoading(false); return; }
    try {
      setLoading(true);
      const [reportRes, storeRes] = await Promise.all([
        API.get<DailyReport>(`/sales/reports/${reportId}`, { headers }),
        API.get("/store/me", { headers }).catch(() => ({ data: null })),
      ]);
      setReport(reportRes.data ?? null);
      setStoreName((storeRes.data as any)?.storeName || "");
      setShopId((storeRes.data as any)?.shopId || "");
    } catch (e: any) {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [canLoad, reportId, headers]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sharePdf = useCallback(async () => {
    if (!report) return;
    try {
      const ref = report._id?.slice(-8).toUpperCase() || "";
      const rows = report.sales.map((s) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${s.productName}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${s.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${Math.round(s.unitPrice).toLocaleString("fr-FR")}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${Math.round(s.totalAmount).toLocaleString("fr-FR")}</td>
        </tr>
      `).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1f2937; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .header-left h1 { font-size: 24px; color: #111827; }
    .header-left .ref { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    .header-left .store { font-size: 14px; color: #6b7280; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-right .date { font-size: 14px; color: #374151; font-weight: 600; }
    .kpis { display: flex; gap: 16px; margin-bottom: 32px; }
    .kpi { flex: 1; background: #f9fafb; border-radius: 12px; padding: 18px; text-align: center; border: 1px solid #e5e7eb; }
    .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; margin-bottom: 6px; }
    .kpi-value { font-size: 22px; font-weight: 700; color: #111827; }
    .kpi-value.green { color: #059669; }
    .kpi-value.gold { color: #d97706; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1f2937; color: #fff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 12px; text-align: left; }
    th.center { text-align: center; }
    th.right { text-align: right; }
    .total-row td { font-weight: 700; font-size: 15px; padding: 14px 12px; border-top: 2px solid #1f2937; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
    .footer .brand { color: #7C3AED; font-weight: 700; }
    .stamp { margin-top: 24px; text-align: center; color: #9ca3af; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Rapport Journalier</h1>
      <div class="store">${storeName || "Boutique"}</div>
      <div class="ref">Réf : ${ref}</div>
    </div>
    <div class="header-right">
      <div class="date">${formatDateShort(report.date)}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="kpi-label">Chiffre d'affaires</div>
      <div class="kpi-value gold">${Math.round(report.totalRevenue).toLocaleString("fr-FR")} FCFA</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Ventes</div>
      <div class="kpi-value">${report.totalSales}</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Bénéfice net</div>
      <div class="kpi-value green">${Math.round(report.grossProfit ?? 0).toLocaleString("fr-FR")} FCFA</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Marge</div>
      <div class="kpi-value">${Math.round(report.marginPercent ?? 0)}%</div>
    </div>
  </div>

  <table>
    <tr><th>Produit</th><th class="center">Qté</th><th class="right">Prix unit.</th><th class="right">Total</th></tr>
    ${rows}
    <tr class="total-row">
      <td colspan="3" style="text-align:right;">Total</td>
      <td style="text-align:right;">${Math.round(report.totalRevenue).toLocaleString("fr-FR")} FCFA</td>
    </tr>
  </table>

  <div class="footer">
    Document généré par <span class="brand">VocoShop</span><br>
    Ce rapport est inaltérable sur le serveur.
  </div>
  <div class="stamp">Ref: ${ref} · ${storeName || ""} · ${formatDateShort(report.date)}</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html });

      if (Platform.OS === "ios") {
        await Share.share({
          message: `${storeName} - Rapport du ${formatDateShort(report.date)}`,
          url: uri,
        });
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${storeName} - Bilan du ${formatDateShort(report.date)}`,
          UTI: "com.adobe.pdf",
        });
      }
    } catch (e) {
      Alert.alert("Erreur", "Impossible de générer le PDF.");
    }
  }, [report, storeName]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Bilan détaillé</Text>
        <TouchableOpacity onPress={sharePdf}>
          <View style={styles.shareBtn}>
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Partager</Text>
          </View>
        </TouchableOpacity>
      </View>

      {loading && (
        <ActivityIndicator size="large" color="#A78BFA" style={{ marginTop: 40 }} />
      )}

      {!loading && !report && (
        <Text style={styles.empty}>Bilan introuvable.</Text>
      )}

      {!loading && report && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* EN-TÊTE PRO */}
          <View style={styles.proHeader}>
            <View>
              <Text style={styles.proStoreName}>{storeName || "Boutique"}</Text>
              <Text style={styles.proRef}>Réf : {report._id?.slice(-8).toUpperCase()}</Text>
            </View>
            <View style={styles.proDateBadge}>
              <Text style={styles.proDateText}>{formatDate(report.date)}</Text>
            </View>
          </View>

          {/* KPIs */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, styles.kpiRevenue]}>
              <Text style={styles.kpiIcon}>💰</Text>
              <Text style={styles.kpiLabel}>Chiffre d'affaires</Text>
              <Text style={styles.kpiValue}>{money(report.totalRevenue)}</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiSales]}>
              <Text style={styles.kpiIcon}>🛒</Text>
              <Text style={styles.kpiLabel}>Ventes</Text>
              <Text style={styles.kpiValue}>{report.totalSales}</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiProfit]}>
              <Text style={styles.kpiIcon}>📈</Text>
              <Text style={styles.kpiLabel}>Bénéfice net</Text>
              <Text style={[styles.kpiValue, { color: "#4ADE80" }]}>{money(report.grossProfit ?? 0)}</Text>
            </View>

            <View style={[styles.kpiCard, styles.kpiMargin]}>
              <Text style={styles.kpiIcon}>📊</Text>
              <Text style={styles.kpiLabel}>Marge</Text>
              <Text style={[styles.kpiValue, { color: "#A78BFA" }]}>{Math.round(report.marginPercent ?? 0)}%</Text>
            </View>
          </View>

          {/* DÉTAIL FINANCIER */}
          <View style={styles.financeCard}>
            <Text style={styles.sectionTitle}>Détail financier</Text>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Coût des marchandises (COGS)</Text>
              <Text style={styles.financeValue}>{money(report.cogs ?? 0)}</Text>
            </View>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Bénéfice brut</Text>
              <Text style={[styles.financeValue, { color: "#4ADE80" }]}>{money(report.grossProfit ?? 0)}</Text>
            </View>
            <View style={styles.financeDivider} />
            <View style={styles.financeRow}>
              <Text style={[styles.financeLabel, { fontWeight: "800" }]}>Résultat net</Text>
              <Text style={[styles.financeValue, { color: "#4ADE80", fontWeight: "800" }]}>{money(report.netProfit ?? report.grossProfit ?? 0)}</Text>
            </View>
          </View>

          {/* PRODUITS */}
          <Text style={styles.sectionTitle}>Produits vendus</Text>
          {report.sales.map((s, idx) => (
            <View key={idx} style={styles.productCard}>
              <View style={styles.productHeader}>
                <Text style={styles.productName}>{s.productName}</Text>
                <Text style={styles.productTotal}>{money(s.totalAmount)}</Text>
              </View>
              <View style={styles.productMeta}>
                <Text style={styles.metaText}>{s.quantity} × {money(s.unitPrice)}</Text>
                {s.lineProfit != null && (
                  <Text style={[styles.metaText, { color: "#4ADE80" }]}>+{money(s.lineProfit)}</Text>
                )}
              </View>
            </View>
          ))}

          {/* FOOTER */}
          <View style={styles.proFooter}>
            <Text style={styles.proFooterText}>
              Rapport généré par VocoShop · Inaltérable sur le serveur
            </Text>
            {shopId ? <Text style={styles.proFooterRef}>Boutique {shopId}</Text> : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0617",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  empty: {
    color: "#9CA3AF",
    marginTop: 30,
    textAlign: "center",
    fontSize: 16,
  },

  // En-tête pro
  proHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#161228",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  proStoreName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
  },
  proRef: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  proDateBadge: {
    backgroundColor: "rgba(167,139,250,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  proDateText: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  // KPIs
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "#161228",
    padding: 16,
    borderRadius: 14,
    borderLeftWidth: 3,
  },
  kpiRevenue: { borderLeftColor: "#F59E0B" },
  kpiSales: { borderLeftColor: "#3B82F6" },
  kpiProfit: { borderLeftColor: "#4ADE80" },
  kpiMargin: { borderLeftColor: "#A78BFA" },
  kpiIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  kpiLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  kpiValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  // Détail financier
  financeCard: {
    backgroundColor: "#161228",
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
  },
  financeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  financeLabel: {
    color: "#C6C0DD",
    fontSize: 14,
  },
  financeValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  financeDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 8,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },

  // Produits
  productCard: {
    backgroundColor: "#161228",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  productTotal: {
    color: "#F59E0B",
    fontSize: 15,
    fontWeight: "900",
  },
  productMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  metaText: {
    color: "#6B7280",
    fontSize: 13,
  },

  // Footer
  proFooter: {
    marginTop: 30,
    alignItems: "center",
    paddingVertical: 20,
  },
  proFooterText: {
    color: "#4B5563",
    fontSize: 11,
    textAlign: "center",
  },
  proFooterRef: {
    color: "#374151",
    fontSize: 10,
    marginTop: 4,
  },
});
