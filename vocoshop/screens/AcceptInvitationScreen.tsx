import { useState, useEffect, useContext, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { AuthContext } from "../src/api/context/AuthContext";
import API from "../src/api/api";

export default function AcceptInvitationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { token: authToken } = useContext(AuthContext);

  const token = route.params?.token;
  const phone = route.params?.phone;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Lien d'invitation invalide");
      setLoading(false);
      return;
    }
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const res = await API.get("/invitations/pending", { params: { phone } });
      if ((res.data as any)?.hasInvitation) {
        setInvitation((res.data as any).invitation);
      } else {
        setError("Aucune invitation en attente pour ce numéro");
      }
    } catch {
      setError("Impossible de vérifier l'invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = useCallback(async () => {
    setLoading(true);
    try {
      await API.post("/invitations/accept", { token });
      Alert.alert(
        "Félicitations !",
        "Tu es maintenant propriétaire de la boutique. Tu peux accéder à toutes les fonctionnalités.",
        [{ text: "Continuer", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Entry" }] }) }]
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.error || "Impossible d'accepter l'invitation");
    } finally {
      setLoading(false);
    }
  }, [token, navigation]);

  const handleDecline = useCallback(async () => {
    setLoading(true);
    try {
      await API.post("/invitations/decline", { token });
      Alert.alert("Invitation refusée", "Tu peux continuer à utiliser l'application normalement.");
      navigation.reset({ index: 0, routes: [{ name: "Entry" }] });
    } catch {
      setLoading(false);
    }
  }, [token, navigation]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#8A4DFF" size="large" />
        <Text style={styles.loadingText}>Vérification de l'invitation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="close-circle-outline" size={64} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Lien invalide</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Entry" }] })}>
          <Text style={styles.btnText}>Continuer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconRow}>
          <Ionicons name="storefront-outline" size={48} color="#8A4DFF" />
        </View>

        <Text style={styles.title}>Une boutique t'attend !</Text>

        <Text style={styles.subtitle}>
          {invitation?.ownerName || "Quelqu'un"} a créé une boutique pour toi sur Vocoshop.
        </Text>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Boutique</Text>
            <Text style={styles.infoValue}>{invitation?.storeName}</Text>
          </View>
          {invitation?.shopId && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Code</Text>
              <Text style={styles.infoValue}>{invitation.shopId}</Text>
            </View>
          )}
          {invitation?.city && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ville</Text>
              <Text style={styles.infoValue}>{invitation.city}</Text>
            </View>
          )}
        </View>

        <Text style={styles.question}>Souhaites-tu devenir propriétaire de cette boutique ?</Text>

        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.acceptBtnText}>Accepter la propriété</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} disabled={loading}>
          <Text style={styles.declineBtnText}>Refuser</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F14",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#A8A3C2",
    marginTop: 16,
    fontSize: 14,
  },
  errorTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 16,
  },
  errorText: {
    color: "#A8A3C2",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#161228",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  iconRow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#A8A3C2",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: "#1A152A",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginTop: 20,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoLabel: {
    color: "#A8A3C2",
    fontSize: 13,
  },
  infoValue: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  question: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 16,
  },
  acceptBtn: {
    backgroundColor: "#6C63FF",
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  acceptBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  declineBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  declineBtnText: {
    color: "#A8A3C2",
    fontSize: 14,
    fontWeight: "600",
  },
  btn: {
    backgroundColor: "#6C63FF",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  btnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },
});
