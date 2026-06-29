import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../src/api/context/LanguageContext";

interface Props {
  canInventory: boolean;
  canReports: boolean;
  canStock: boolean;
  canSales: boolean;
  productsCount: number;
  todaySales: number;
  todayRevenue: number;
  stockValueSell: number;
  stockValueBuy: number;
  isSubscriptionBlocked: boolean;
  navigation: any;
  deny: () => void;
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

export default function HomeGrid({
  canInventory, canReports, canStock, canSales,
  productsCount, todaySales, todayRevenue, stockValueSell, stockValueBuy,
  isSubscriptionBlocked, navigation, deny,
}: Props) {
  const { t } = useLanguage();

  const profit = stockValueSell - stockValueBuy;

  const cards = [
    {
      icon: "clipboard-outline",
      color: "#7DA6FF",
      title: t("home.card.inventory"),
      desc: canInventory
        ? t("home.card.inventory_desc", { n: fmt(productsCount) })
        : t("home.card.limited"),
      onPress: () => {
        if (isSubscriptionBlocked) { navigation.navigate("SubscriptionBlocked"); return; }
        if (!canInventory) return deny();
        navigation.navigate("Inventory");
      },
    },
    {
      icon: "bar-chart-outline",
      color: "#7ED0FF",
      title: t("home.card.report"),
      desc: canReports
        ? t("home.card.report_desc", { n: fmt(todaySales), revenue: fmt(todayRevenue) })
        : t("home.card.limited"),
      onPress: () => {
        if (isSubscriptionBlocked) { navigation.navigate("SubscriptionBlocked"); return; }
        if (!canReports) return deny();
        navigation.navigate("Report");
      },
    },
    {
      icon: "cube-outline",
      color: "#7DA6FF",
      title: t("home.card.sales"),
      desc: canSales
        ? t("home.card.sales_desc", { revenue: fmt(todayRevenue) })
        : t("home.card.limited"),
      onPress: () => {
        if (isSubscriptionBlocked) { navigation.navigate("SubscriptionBlocked"); return; }
        if (!canSales) return deny();
        navigation.navigate("Sales");
      },
    },
  ];

  return (
    <View style={styles.grid}>
      {canStock ? (
        <TouchableOpacity style={styles.stockCard} onPress={() => {
          if (isSubscriptionBlocked) { navigation.navigate("SubscriptionBlocked"); return; }
          if (!canStock) return deny();
          navigation.navigate("Stock");
        }} activeOpacity={0.85}>
          <View style={styles.stockHeader}>
            <Ionicons name="cube-outline" size={28} color="#7DA6FF" />
            <Text style={styles.stockTitle}>Valeur estimée de votre boutique</Text>
          </View>
          <Text style={styles.stockValue}>{fmt(stockValueSell)} FCFA</Text>
          {stockValueBuy > 0 && (
            <Text style={styles.stockProfit}>
              Bénéfice estimé : {fmt(profit)} FCFA
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.card} onPress={deny} activeOpacity={0.85}>
          <Ionicons name="cube-outline" size={32} color="#7DA6FF" />
          <Text style={styles.title}>{t("home.card.stock")}</Text>
          <Text style={styles.desc}>{t("home.card.limited")}</Text>
        </TouchableOpacity>
      )}

      {cards.map((c) => (
        <TouchableOpacity key={c.title} style={styles.card} onPress={c.onPress} activeOpacity={0.85}>
          <Ionicons name={c.icon as any} size={32} color={c.color} />
          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.desc}>{c.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 },
  stockCard: {
    width: "100%",
    backgroundColor: "#18122B",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
  },
  stockHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  stockTitle: { color: "#C6C0DD", fontSize: 13, fontWeight: "600", flex: 1 },
  stockValue: { color: "#fff", fontSize: 28, fontWeight: "900" },
  stockProfit: { color: "#7A7393", fontSize: 11, marginTop: 6 },
  card: { width: "48%", backgroundColor: "#18122B", borderRadius: 16, padding: 16, marginBottom: 12 },
  title: { color: "#fff", fontWeight: "700", marginTop: 8, fontSize: 14 },
  desc: { color: "#8B86A3", fontSize: 11, marginTop: 3 },
});
