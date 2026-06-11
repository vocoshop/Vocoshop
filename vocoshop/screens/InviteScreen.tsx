// screens/InviteScreen.tsx
import React, { useMemo, useState, useContext, useCallback } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
Alert,
ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";

type RouteParams = { token?: string };

type AcceptResponse = {
message?: string;
token: string;
storeId: string;
user?: any;
storeType?: string;
};

export default function InviteScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();

const { applySession } = useContext(AuthContext);

const token = useMemo(() => {
  const p = (route?.params || {}) as RouteParams;
  return typeof p.token === "string" ? p.token : "";
}, [route?.params]);

const [loading, setLoading] = useState(false);

const onContinue = useCallback(async () => {
if (!token) {
Alert.alert("Lien invalide", "Token manquant.");
return;
}

try {
setLoading(true);

const res = await API.get<AcceptResponse>("/employees/accept", {
params: { token },
});

const tk = res.data?.token;
const st = res.data?.storeId;

if (!tk || !st) {
Alert.alert("Erreur", "Réponse invalide du serveur (token/storeId manquants).");
return;
}

const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

// 🔥 TRÈS IMPORTANT : on efface l'ancienne session (owner) avant d'appliquer celle de l'employé
await AsyncStorage.multiRemove(["token", "storeId", "storeType", "inventorySessionId", "user"]);

await applySession({
token: tk,
storeId: String(st),
user: res.data?.user,
storeType: res.data?.storeType ?? null,
});

Alert.alert("Accès activé ✅", "Compte employé activé. Connexion automatique…");

navigation.reset({
index: 0,
routes: [{ name: "Home" }],
});
} catch (e: any) {
console.log("❌ employees/accept", e?.response?.status, e?.response?.data || e);
Alert.alert("Erreur", e?.response?.data?.error || "Impossible d’accepter l’invitation.");
} finally {
setLoading(false);
}
}, [applySession, navigation, token]);

return (
<View style={styles.container}>
<Text style={styles.title}>Invitation employé</Text>
<Text style={styles.sub}>
{token
? "Token reçu. Active ton accès pour continuer."
: "Lien invalide (token manquant)."}
</Text>

<View style={styles.card}>
<Text style={styles.label}>Token</Text>
<Text style={styles.token} numberOfLines={2}>
{token || "—"}
</Text>

<TouchableOpacity
style={[styles.btn, (!token || loading) ? { opacity: 0.7 } : null]}
onPress={onContinue}
activeOpacity={0.9}
disabled={!token || loading}
>
{loading ? (
<ActivityIndicator color="#fff" />
) : (
<Text style={styles.btnText}>Activer mon accès</Text>
)}
</TouchableOpacity>

<TouchableOpacity
style={styles.link}
onPress={() => navigation.replace("Login")}
>
<Text style={styles.linkText}>Retour</Text>
</TouchableOpacity>
</View>
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617", paddingTop: 80, paddingHorizontal: 20 },
title: { color: "#fff", fontSize: 22, fontWeight: "900" },
sub: { color: "#A8A3C2", marginTop: 8, lineHeight: 18 },
card: {
marginTop: 16,
backgroundColor: "#18122B",
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
padding: 16,
},
label: { color: "#C6C0DD", fontWeight: "900", fontSize: 12 },
token: { color: "#fff", fontWeight: "800", marginTop: 8 },
btn: {
marginTop: 14,
width: "100%",
backgroundColor: "#8A4DFF",
paddingVertical: 14,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
link: { marginTop: 12, alignItems: "center" },
linkText: { color: "#C6C0DD", fontWeight: "900" },
});
