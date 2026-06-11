import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../src/api/context/LanguageContext";

interface Props {
  canStock: boolean;
  isSubscriptionBlocked: boolean;
  lowStockCount: number;
  expiringCount: number;
  navigation: any;
  deny: () => void;
}

export default function AlertSection({ canStock, isSubscriptionBlocked, lowStockCount, expiringCount, navigation, deny }: Props) {
  const { t } = useLanguage();
  return (
    <>
      {/* ===== SCANNER CARD — accès rapide ===== */}
      <TouchableOpacity
        style={styles.scanCard}
        activeOpacity={0.85}
        onPress={() => {
          if (isSubscriptionBlocked) { navigation.navigate("SubscriptionBlocked"); return; }
          navigation.navigate("OcrScan");
        }}
      >
        <View style={styles.scanIconWrap}>
          <Ionicons name="scan-outline" size={28} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scanTitle}>Scanner un cahier</Text>
          <Text style={styles.scanDesc}>Importe tes ventes, stocks ou dépenses en une photo</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#A78BFA" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.alertBox}
        activeOpacity={0.85}
        onPress={() => {
          if (!canStock) return deny();
          navigation.navigate("StockHealth", { mode: "low" });
        }}
      >
        <Ionicons name="alert-circle" size={22} color="#FF6B6B" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {canStock ? t("home.alert.low_stock", { n: lowStockCount }) : t("home.alert.low_stock_limited")}
          </Text>
          <Text style={styles.desc}>{t("home.alert.low_stock_desc")}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.alertBox}
        activeOpacity={0.85}
        onPress={() => {
          if (!canStock) return deny();
          navigation.navigate("StockHealth", { mode: "expiring" });
        }}
      >
        <Ionicons name="flame-outline" size={22} color="#FF9F43" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {canStock ? t("home.alert.expiring", { n: expiringCount }) : t("home.alert.expiring_limited")}
          </Text>
          <Text style={styles.desc}>{t("home.alert.expiring_desc")}</Text>
        </View>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  scanCard: {
    backgroundColor: "#2D1B69",
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#8A4DFF40",
  },
  scanIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#8A4DFF",
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  scanDesc: { color: "#A78BFA", fontSize: 11, marginTop: 2 },
  alertBox: {
    backgroundColor: "#1E1838",
    padding: 13,
    borderRadius: 14,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  title: { color: "#fff", fontWeight: "700", fontSize: 13 },
  desc: { color: "#8B86A3", fontSize: 11, marginTop: 1 },
});
