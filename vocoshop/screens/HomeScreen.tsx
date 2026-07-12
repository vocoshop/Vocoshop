import React, { useState, useContext, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";
import { onSyncState, getLastSyncFinished } from "../src/api/offline/syncEngine";
import { useSubscription } from "../src/api/context/SubscriptionContext";
import { useLanguage } from "../src/api/context/LanguageContext";
import { EXPIRING_DAYS } from "../src/api/constants/stock";

import HomeHeader from "./components/HomeHeader";
import SubBanner from "./components/SubBanner";
import HomeGrid from "./components/HomeGrid";
import AlertSection from "./components/AlertSection";
import HomeOverlay from "./components/HomeOverlay";

const getTodayKey = () => new Date().toISOString().split("T")[0];

export default function HomeScreen() {
  const { token, storeId, user, refreshUser } = useContext(AuthContext);
  const { subscription } = useSubscription();
  const { t } = useLanguage();

  const navigation = useNavigation<any>();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const rawPerms = user?.permissions;
  const perms: string[] = Array.isArray(rawPerms) ? rawPerms : (rawPerms && typeof rawPerms === "object" ? Object.keys(rawPerms).filter(k => rawPerms[k]) : []);
  const canInventory = perms.includes("inventory");
  const canReports = perms.includes("reports");
  const canStock = perms.includes("stock");
  const canSales = perms.includes("sales");
  const canOrders = perms.includes("orders");

  const [showSubBanner, setShowSubBanner] = useState(false);
  const [productsCount, setProductsCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [todoCount, setTodoCount] = useState(0);
  const [showDailyOverlay, setShowDailyOverlay] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);

  const isSubscriptionBlocked = subscription?.status === "expired" || subscription?.status === "unused";
  const isNewStore = productsCount === 0;

  const deny = useCallback(() => {
    Alert.alert("Accès restreint", "Vous n'avez pas la permission nécessaire");
  }, []);

  const [todaySales, setTodaySales] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [stockValueSell, setStockValueSell] = useState(0);

  async function loadData() {
    const headersLocal = { Authorization: token ? `Bearer ${token}` : "", "x-store-id": storeId || "" };
    try {
      setOverlayReady(false);
      if (!token || !storeId || !canInventory) {
        setProductsCount(0); setLowStockCount(0); setExpiringCount(0);
        setTodaySales(0); setTodayRevenue(0); setStockValueSell(0);
        setShowDailyOverlay(false); return;
      }
      const res = await API.get("/store/kpis", { headers: headersLocal, params: { days: EXPIRING_DAYS } });
      const k: any = res.data ?? {};
      setProductsCount(k.totalProducts ?? 0);
      setLowStockCount(k.lowStockCount ?? 0);
      setExpiringCount(k.expiringCount ?? 0);
      setStockValueSell(k.stockValueSell ?? 0);
      setTodaySales(k.todaySales ?? 0);
      setTodayRevenue(k.todayRevenue ?? 0);
      if ((k.totalProducts ?? 0) > 0 && storeId) {
        const today = getTodayKey();
        const key = `voco:lastDailyOverlay:${storeId}`;
        const last = await AsyncStorage.getItem(key);
        setShowDailyOverlay(last !== today);
      } else { setShowDailyOverlay(false); }
    } catch { setShowDailyOverlay(false); }
    finally { setOverlayReady(true); }
  }

  useFocusEffect( useCallback(() => {
    refreshUser();
    loadData();
  }, [token, storeId, canInventory]) );

  useFocusEffect( React.useCallback(() => {
    if (subscription?.status === "trial") { setShowSubBanner(true); const t = setTimeout(() => { setShowSubBanner(false); }, 5000); return () => clearTimeout(t); }
  }, [subscription]) );

  const lastSyncRef = useRef(0);
  useEffect(() => {
    const unsub = onSyncState(() => {
      const finished = getLastSyncFinished();
      if (finished && finished !== lastSyncRef.current) { lastSyncRef.current = finished; loadData(); }
    });
    return () => unsub();
  }, [token, storeId, canInventory]);

  const closeDailyOverlay = useCallback(async () => {
    try { if (storeId) { const today = getTodayKey(); const key = `voco:lastDailyOverlay:${storeId}`; await AsyncStorage.setItem(key, today); } } catch {}
    setShowDailyOverlay(false);
  }, [storeId]);

  return (
    <View style={styles.container}>

      <SubBanner subscription={subscription} showSubBanner={showSubBanner} slideAnim={slideAnim} navigation={navigation} />

      <HomeHeader navigation={navigation} />

      <HomeGrid
        canInventory={canInventory} canReports={canReports} canStock={canStock} canSales={canSales}
        productsCount={productsCount} todaySales={todaySales} todayRevenue={todayRevenue}
        stockValueSell={stockValueSell}
        isSubscriptionBlocked={isSubscriptionBlocked}
        navigation={navigation} deny={deny}
      />

      <AlertSection
        canStock={canStock} isSubscriptionBlocked={isSubscriptionBlocked}
        lowStockCount={lowStockCount} expiringCount={expiringCount}
        navigation={navigation} deny={deny}
      />

      <Text style={styles.sectionTitle}>{t("home.section.suppliers")}</Text>

      <TouchableOpacity
        style={styles.listItem}
        onPress={() => {
          if (isSubscriptionBlocked) { navigation.navigate("SubscriptionBlocked"); return; }
          if (!canOrders) return deny();
          navigation.navigate("MesFournisseurs");
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="people-outline" size={24} color="#9CA3AF" />
        <Text style={styles.listText}>{t("home.suppliers")}</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      <HomeOverlay
        overlayReady={overlayReady} canInventory={canInventory} isNewStore={isNewStore}
        showDailyOverlay={showDailyOverlay} canSales={canSales}
        navigation={navigation} canStock={canStock}
        closeDailyOverlay={closeDailyOverlay} deny={deny}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 56, paddingHorizontal: 20 },
  sectionTitle: { marginTop: 20, color: "#C6C0DD", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  listItem: {
    marginTop: 10,
    backgroundColor: "#18122B",
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  listText: { flex: 1, marginLeft: 12, color: "#fff", fontSize: 14, fontWeight: "600" },
});
