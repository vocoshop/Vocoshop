import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSubscription } from "../src/api/context/SubscriptionContext";

const SUCCESS_PREFIX = "https://www.vocoshop.app/paiement/success";
const CANCEL_PREFIX = "https://www.vocoshop.app/paiement/cancel";

type Status = "loading" | "paying" | "success" | "cancelled" | "error";

export default function YabetooWebViewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { refreshSubscription } = useSubscription();
  const checkoutUrl: string = route.params?.checkoutUrl || "";
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSuccess() {
    setStatus("success");
    await refreshSubscription();
    setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }, 2000);
  }

  function handleCancel() {
    setStatus("cancelled");
  }

  function handleError(msg: string) {
    setErrorMsg(msg);
    setStatus("error");
  }

  function onNavigationStateChange(nav: WebViewNavigation) {
    const url = nav.url || "";
    if (url.startsWith(SUCCESS_PREFIX)) {
      handleSuccess();
    } else if (url.startsWith(CANCEL_PREFIX)) {
      handleCancel();
    }
  }

  function close() {
    navigation.goBack();
  }

  if (!checkoutUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>URL de paiement manquante</Text>
          <TouchableOpacity style={styles.btn} onPress={close}>
            <Text style={styles.btnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "success") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={72} color="#22c55e" />
          <Text style={styles.successTitle}>Paiement réussi !</Text>
          <Text style={styles.successSub}>Abonnement PRO activé</Text>
          <ActivityIndicator color="#22c55e" style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  if (status === "cancelled") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="close-circle" size={72} color="#ea580c" />
          <Text style={styles.cancelTitle}>Paiement annulé</Text>
          <Text style={styles.cancelSub}>Aucun montant n'a été débité</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#7B4DFF", marginTop: 24 }]} onPress={close}>
            <Text style={styles.btnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (status === "error") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Ionicons name="warning" size={72} color="#ef4444" />
          <Text style={styles.errorTitle}>Erreur de paiement</Text>
          <Text style={styles.errorSub}>{errorMsg}</Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#7B4DFF", marginTop: 24 }]} onPress={close}>
            <Text style={styles.btnText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={close} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paiement Yabetoo</Text>
        <View style={{ width: 32 }} />
      </View>
      {status === "loading" && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#7B4DFF" />
          <Text style={styles.loadingText}>Chargement de la page de paiement...</Text>
        </View>
      )}
      <WebView
        source={{ uri: checkoutUrl }}
        style={styles.webview}
        onLoad={() => setStatus("paying")}
        onNavigationStateChange={onNavigationStateChange}
        onError={({ nativeEvent }) => handleError(nativeEvent.description)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#7B4DFF" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070014" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#151028",
  },
  closeBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  webview: { flex: 1, backgroundColor: "#070014" },
  loadingOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "#070014", justifyContent: "center", alignItems: "center", zIndex: 10,
  },
  loadingText: { color: "#aaa", marginTop: 12, fontSize: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  successTitle: { color: "#22c55e", fontSize: 22, fontWeight: "800", marginTop: 16 },
  successSub: { color: "#aaa", fontSize: 14, marginTop: 4 },
  cancelTitle: { color: "#ea580c", fontSize: 22, fontWeight: "800", marginTop: 16 },
  cancelSub: { color: "#aaa", fontSize: 14, marginTop: 4 },
  errorTitle: { color: "#ef4444", fontSize: 22, fontWeight: "800", marginTop: 16 },
  errorSub: { color: "#aaa", fontSize: 14, marginTop: 4, textAlign: "center" },
  errorText: { color: "#ef4444", fontSize: 16, marginBottom: 16 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
