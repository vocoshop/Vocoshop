// src/api/components/OfflineBanner.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { onNetworkChange } from "../utils/network";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  /* =====================================================
  ✅ EVENT-DRIVEN (plus de polling)
  ===================================================== */
  useEffect(() => {
    const unsub = onNetworkChange((s) => {
      setOffline(!s.online);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>Mode hors-ligne actif — actions en file d'attente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: "#7C3AED",
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
});