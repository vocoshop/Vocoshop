import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../src/api/context/LanguageContext";

interface Props {
  navigation: any;
}

export default function HomeHeader({ navigation }: Props) {
  const { t } = useLanguage();
  return (
    <View style={styles.row}>
      <View>
        <Text style={styles.title}>{t("home.title")}</Text>
        <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
      </View>
      <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate("Profile")}>
        <Ionicons name="person-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22, alignItems: "center" },
  title: { fontSize: 24, color: "#fff", fontWeight: "900" },
  subtitle: { color: "#9CA3AF", fontSize: 13, marginTop: 2 },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
});
