import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import API from "../src/api/api";

export default function StoreCreatedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const shareLink = route.params?.shareLink || "";
  const storeName = route.params?.storeName || "ta boutique";
  const ownerPhone = route.params?.ownerPhone || "";
  const invitationId = route.params?.invitationId;

  const [resending, setResending] = useState(false);

  const message =
    `📢 La boutique "${storeName}" rejoint VocoShop !\n\n` +
    `Desormais, vous pouvez suivre toute l'activite de votre boutique en temps reel depuis votre telephone :\n` +
    `📊 Chiffre d'affaires\n` +
    `📦 Etat du stock\n` +
    `📈 Benefices et bilans quotidiens\n\n` +
    `📲 Telechargez VocoShop sur le Play Store et connectez-vous avec ce numero : ${ownerPhone}\n\n` +
    `👉 VocoShop — Vendez. Gerer. Grandissez.`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: shareLink
          ? `${message}\n\nLien d'invitation : ${shareLink}`
          : message,
      });
    } catch {}
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      await Clipboard.setStringAsync(shareLink);
      Alert.alert("Copié !", "Le lien d'invitation a été copié.");
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await API.post("/invitations/resend");
      const newLink = (res.data as any)?.shareLink || shareLink;
      await Share.share({
        message: `${message}\n\nLien d'invitation : ${newLink}`,
      });
    } catch {
      Alert.alert("Erreur", "Impossible de renvoyer l'invitation");
    } finally {
      setResending(false);
    }
  };

  const handleContinue = () => {
    navigation.reset({ index: 0, routes: [{ name: "Entry" }] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={72} color="#4ADE80" />
        </View>

        <Text style={styles.title}>Boutique créée avec succès !</Text>
        <Text style={styles.subtitle}>
          Le propriétaire a été invité. En attendant, tu peux déjà utiliser la boutique.
        </Text>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#FACC15" />
          <Text style={styles.infoText}>
            Tu es administrateur temporaire. Le propriétaire aura tous les droits quand il acceptera l'invitation.
          </Text>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Inviter le propriétaire</Text>

          {shareLink ? (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Partager le lien</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtnOutline} onPress={handleCopyLink}>
                <Ionicons name="copy-outline" size={20} color="#8A4DFF" />
                <Text style={styles.actionBtnOutlineText}>Copier le lien</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.noLinkText}>
                Aucun lien d'invitation disponible. Tu peux partager le numéro du propriétaire : {ownerPhone}
            </Text>
          )}

          <TouchableOpacity style={styles.actionBtnOutline} onPress={handleResend} disabled={resending}>
            {resending ? (
              <ActivityIndicator color="#8A4DFF" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color="#8A4DFF" />
                <Text style={styles.actionBtnOutlineText}>Renvoyer l'invitation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>Continuer comme administrateur</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F14",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  successIcon: {
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
    paddingHorizontal: 20,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "rgba(250, 204, 21, 0.1)",
    borderColor: "rgba(250, 204, 21, 0.2)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 20,
    width: "100%",
    maxWidth: 400,
  },
  infoText: {
    color: "#E5E7EB",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  actionsCard: {
    backgroundColor: "#161228",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    marginTop: 20,
    gap: 12,
  },
  actionsTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 4,
  },
  actionBtn: {
    backgroundColor: "#6C63FF",
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  actionBtnOutline: {
    borderColor: "#8A4DFF",
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnOutlineText: {
    color: "#8A4DFF",
    fontSize: 15,
    fontWeight: "700",
  },
  noLinkText: {
    color: "#A8A3C2",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  continueBtn: {
    backgroundColor: "#1E1838",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    marginTop: 20,
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
});
