import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLanguage } from "../../src/api/context/LanguageContext";

interface Props {
  overlayReady: boolean;
  canInventory: boolean;
  isNewStore: boolean;
  showDailyOverlay: boolean;
  canSales: boolean;
  navigation: any;
  canStock: boolean;
  closeDailyOverlay: () => Promise<void>;
  deny: () => void;
}

export default function HomeOverlay({ overlayReady, canInventory, isNewStore, showDailyOverlay, canSales, navigation, canStock, closeDailyOverlay, deny }: Props) {
  const { t } = useLanguage();
  return (
    <>
      {overlayReady && canInventory && isNewStore && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{t("home.overlay.welcome_title")}</Text>
            <Text style={styles.text}>
              {t("home.overlay.welcome_text")}
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!canStock) return deny();
                navigation.navigate("Stock");
              }}
            >
              <Text style={styles.primaryText}>{t("home.overlay.add_stock")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {overlayReady && canSales && !isNewStore && showDailyOverlay && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{t("home.overlay.ready_title")}</Text>
            <Text style={styles.text}>{t("home.overlay.ready_text")}</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={async () => {
                await closeDailyOverlay();
                navigation.navigate("Sales");
              }}
            >
              <Text style={styles.primaryText}>{t("home.overlay.start_sales")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeDailyOverlay}>
              <Text style={styles.secondaryText}>{t("home.overlay.later")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,6,23,0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1E1838",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  title: { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 12, textAlign: "center" },
  text: { color: "#B3AEC7", fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 14,
  },
  primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600" },
});
