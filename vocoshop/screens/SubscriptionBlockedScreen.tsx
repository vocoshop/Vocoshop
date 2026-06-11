import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

interface Props {
  isGrace?: boolean;
  graceDaysLeft?: number;
}

export default function SubscriptionBlockedScreen({ isGrace = false, graceDaysLeft = 0 }: Props) {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      {/* 🔴 ICON */}
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={60} color="#FF5A5A" />
      </View>

      {/* TITLE */}
      <Text style={styles.title}>
        {isGrace ? "Période de grâce" : "Abonnement expiré"}
      </Text>

      {/* MESSAGE */}
      <Text style={styles.message}>
        {isGrace
          ? `Votre abonnement a expiré. Il vous reste ${graceDaysLeft} jour${graceDaysLeft > 1 ? "s" : ""} pour renouveler votre abonnement et continuer à utiliser Vocoshop.`
          : "Votre abonnement a expiré. Vous ne pouvez plus utiliser l'application tant que vous n'avez pas renouvelé votre abonnement."}
      </Text>

      {/* DETAILS */}
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
          <Text style={styles.detailText}>Accès complet à tous les modules</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
          <Text style={styles.detailText}>Vos données sont sauvegardées</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
          <Text style={styles.detailText}>Reprise immédiate après paiement</Text>
        </View>
      </View>

      {/* BOUTON */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("SubscriptionPay")}
      >
        <Text style={styles.buttonText}>Renouveler mon abonnement</Text>
      </TouchableOpacity>

      {/* CONTACT */}
      <TouchableOpacity
        style={styles.contactButton}
        onPress={() => {
          // Ouvrir le support
        }}
      >
        <Ionicons name="chatbubble-outline" size={18} color="#BFA6FF" />
        <Text style={styles.contactText}>Contacter le support</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070014",
    paddingHorizontal: 30,
    paddingTop: 100,
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 90, 90, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#A8A3C2",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
  },
  details: {
    width: "100%",
    backgroundColor: "#151028",
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailText: {
    color: "#ddd",
    marginLeft: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#7B4DFF",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  contactText: {
    color: "#BFA6FF",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
  },
});