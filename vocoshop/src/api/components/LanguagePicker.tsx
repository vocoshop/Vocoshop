import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../context/LanguageContext";

const languages = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export default function LanguagePicker() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);

  const current = languages.find((l) => l.code === lang) || languages[0];

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={styles.flag}>{current.flag}</Text>
        <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {languages.map((l) => {
              const active = l.code === lang;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.item, active && styles.itemActive]}
                  onPress={() => { setLang(l.code as any); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.itemFlag}>{l.flag}</Text>
                  <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>
                    {l.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color="#A78BFA" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  flag: { fontSize: 18 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  menu: {
    backgroundColor: "#1E1838",
    borderRadius: 16,
    padding: 8,
    minWidth: 180,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  itemActive: { backgroundColor: "rgba(167,139,250,0.12)" },
  itemFlag: { fontSize: 20 },
  itemLabel: { color: "#C6C0DD", fontWeight: "600", fontSize: 14, flex: 1 },
  itemLabelActive: { color: "#fff", fontWeight: "800" },
});
