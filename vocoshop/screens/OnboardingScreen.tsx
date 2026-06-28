// screens/OnboardingScreen.tsx

import React, { useCallback, useContext, useMemo, useState, useEffect } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
TextInput,
KeyboardAvoidingView,
Platform,
ScrollView,
Alert,
Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { AuthContext } from "../src/api/context/AuthContext";
import { updateStoreOnboarding } from "../src/api/services/storeService";

function safeTrim(v: any) {
return typeof v === "string" ? v.trim() : "";
}

export default function OnboardingScreen({ route, navigation }: any) {

// If navigated from LoginScreen (new account), phone is passed as param
const incomingPhone: string | undefined = route?.params?.phone;

const { token, logout, loading: authLoading, registerWithPassword } = useContext(AuthContext);

const [storeName, setStoreName] = useState("");
const [city, setCity] = useState("");

const [ownerName, setOwnerName] = useState("");
const [ownerPhone, setOwnerPhone] = useState("");

const [agentCode, setAgentCode] = useState("");
const [referralCode, setReferralCode] = useState("");

const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);

const [loading, setLoading] = useState(false);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
}),
[token]
);

/* =====================================================
🔥 FORMATTER PRO V8 (CURSOR SAFE)
===================================================== */

const formatAgentCode = (value: string) => {
let raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

let part1 = raw.slice(0, 2);
let part2 = raw.slice(2, 6);
let part3 = raw.slice(6, 8);

let result = part1;

if (part2) result += "-" + part2;
if (part3) result += "-" + part3;

return result;
};

const formatReferralCode = (value: string) => {
let raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

let part1 = raw.slice(0, 3);
let part2 = raw.slice(3, 10);

let result = part1;

if (part2) result += "-" + part2;

return result;
};

const handleAgentCodeChange = (value: string) => {
setAgentCode(formatAgentCode(value));
};

const handleReferralCodeChange = (value: string) => {
setReferralCode(formatReferralCode(value));
};

/* =====================================================
ANTI LOOP LOGIN
===================================================== */
useEffect(() => {
if (authLoading) return;
if (!token && !incomingPhone) {
navigation.reset({ index: 0, routes: [{ name: "Login" }] });
}
}, [authLoading, token, navigation, incomingPhone]);

/* =====================================================
🔥 AUTO DETECTION REFERRAL LINK
vocoshop://join?ref=VOC-XXXX
===================================================== */
useEffect(() => {
const checkInitialLink = async () => {
try {
const url = await Linking.getInitialURL();
if (!url) return;

const match = url.match(/ref=([A-Z0-9\-]+)/i);
if (match && match[1]) {
setReferralCode(match[1].toUpperCase());
}
} catch (e) {
console.log("❌ referral deep link error", e);
}
};

checkInitialLink();
}, []);

/* =====================================================
SWITCH ACCOUNT
===================================================== */
const switchAccount = useCallback(() => {

if (loading) return;

Alert.alert(
"Changer de boutique",
"Tu vas te déconnecter et revenir à l’écran de connexion.",
[
{ text: "Annuler", style: "cancel" },
{
text: "Se déconnecter",
style: "destructive",
onPress: async () => {
try {
setLoading(true);
await logout();
navigation.reset({ index: 0, routes: [{ name: "Login" }] });
} catch {
navigation.reset({ index: 0, routes: [{ name: "Login" }] });
} finally {
setLoading(false);
}
},
},
]
);

}, [loading, logout, navigation]);

/* =====================================================
CONTINUE
===================================================== */
const onContinue = useCallback(async () => {

if (loading) return;

try {

const cleanStoreName = safeTrim(storeName);
const cleanCity = safeTrim(city);
const cleanAgentCode = safeTrim(agentCode).toUpperCase();
const cleanReferralCode = safeTrim(referralCode).toUpperCase();
const cleanOwnerName = safeTrim(ownerName);
const cleanOwnerPhone = safeTrim(ownerPhone);
const cleanPassword = password;
const cleanConfirm = confirmPassword;

if (!cleanStoreName) {
Alert.alert("Champ obligatoire", "Entre le nom commercial de la boutique.");
return;
}

if (incomingPhone) {
// Nouveau compte : password obligatoire
if (!cleanPassword || cleanPassword.length !== 6) {
Alert.alert("Champ obligatoire", "Le code secret doit contenir 6 chiffres.");
return;
}
if (cleanPassword !== cleanConfirm) {
Alert.alert("Erreur", "Les codes secrets ne correspondent pas.");
return;
}
}

setLoading(true);

if (incomingPhone) {
// 1) Créer le compte
await registerWithPassword(
incomingPhone,
cleanPassword,
cleanStoreName,
cleanOwnerName || undefined,
cleanOwnerPhone || undefined,
cleanReferralCode || undefined,
);
// 2) Mettre à jour les infos restantes (city, agentCode)
let authHeader = headers.Authorization;
if (!authHeader) {
const tk = await AsyncStorage.getItem("token");
if (tk) authHeader = `Bearer ${tk}`;
}
if (authHeader) {
const payload: any = {};
if (cleanCity) payload.city = cleanCity;
if (cleanAgentCode) payload.agentCode = cleanAgentCode;
await updateStoreOnboarding(payload, { Authorization: authHeader });
}
} else {
let authHeader = headers.Authorization;
if (!authHeader) {
const tk = await AsyncStorage.getItem("token");
if (tk) authHeader = `Bearer ${tk}`;
}

if (!authHeader) {
Alert.alert("Erreur", "Session invalide. Reconnecte-toi.");
navigation.reset({ index: 0, routes: [{ name: "Login" }] });
return;
}

const payload: any = {
storeName: cleanStoreName,
city: cleanCity,
};

if (cleanAgentCode) payload.agentCode = cleanAgentCode;
if (cleanReferralCode) payload.referralCode = cleanReferralCode;
if (cleanOwnerName) payload.ownerName = cleanOwnerName;
if (cleanOwnerPhone) payload.ownerPhone = cleanOwnerPhone;

await updateStoreOnboarding(payload, { Authorization: authHeader });
}

await AsyncStorage.setItem("isOnboarded", "true");

navigation.reset({ index: 0, routes: [{ name: "Entry" }] });

} catch (err: any) {
console.log("❌ Onboarding save error:", err?.response?.data || err);
Alert.alert("Erreur", "Impossible d'enregistrer. Réessaie.");
} finally {
setLoading(false);
}

}, [agentCode, referralCode, city, ownerName, ownerPhone, headers.Authorization, loading, navigation, storeName]);

/* =====================================================
UI
===================================================== */

return (
<View style={styles.container}>

<View style={styles.header}>
<View style={{ width: 26 }} />
<Text style={styles.headerTitle}>Configurer la boutique</Text>
<View style={{ width: 26 }} />
</View>

<KeyboardAvoidingView
style={{ flex: 1 }}
behavior={Platform.OS === "ios" ? "padding" : undefined}
>

<ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
<View style={styles.card}>

<View style={styles.heroRow}>
<View style={styles.heroIcon}>
<Ionicons name="storefront-outline" size={22} color="#fff" />
</View>
<View style={{ flex: 1 }}>
<Text style={styles.title}>Bienvenue 👋</Text>
<Text style={styles.sub}>
Dernière étape : renseigne le nom et la ville pour activer Vocoshop.
</Text>
</View>
</View>

<Text style={styles.label}>Nom commercial *</Text>
<TextInput
value={storeName}
onChangeText={setStoreName}
placeholder="Ex: Marché Bon Prix"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
autoCapitalize="words"
/>

<Text style={styles.label}>Ville</Text>
<TextInput
value={city}
onChangeText={setCity}
placeholder="Ex: Brazzaville"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
autoCapitalize="words"
/>

<Text style={styles.label}>Nom du propriétaire (optionnel)</Text>
<TextInput
value={ownerName}
onChangeText={setOwnerName}
placeholder="Ex: Jean Dupont"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
autoCapitalize="words"
/>

<Text style={styles.label}>Téléphone du propriétaire (optionnel)</Text>
<TextInput
value={ownerPhone}
onChangeText={setOwnerPhone}
placeholder="Ex: +242 06 123 45 67"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
keyboardType="phone-pad"
/>

<Text style={styles.label}>Code agent (optionnel)</Text>
<TextInput
value={agentCode}
onChangeText={handleAgentCodeChange}
placeholder="Ex: AG-1003-XB"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
autoCapitalize="characters"
autoCorrect={false}
/>

<Text style={styles.label}>Code parrainage (optionnel)</Text>
<TextInput
value={referralCode}
onChangeText={handleReferralCodeChange}
placeholder="Ex: VOC-AB12CD"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
autoCapitalize="characters"
autoCorrect={false}
/>

{incomingPhone && (
<>

<Text style={styles.label}>Code secret 6 chiffres *</Text>
<View style={styles.pwdRow}>
<TextInput
value={password}
onChangeText={(t) => setPassword(t.replace(/[^0-9]/g, "").slice(0, 6))}
keyboardType="numeric"
maxLength={6}
placeholder="Entrez 6 chiffres"
placeholderTextColor="rgba(255,255,255,0.35)"
style={[styles.input, { flex: 1 }]}
secureTextEntry={!showPassword}
/>
<TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
<Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(255,255,255,0.5)" />
</TouchableOpacity>
</View>

<Text style={styles.label}>Confirmer le code secret *</Text>
<TextInput
value={confirmPassword}
onChangeText={(t) => setConfirmPassword(t.replace(/[^0-9]/g, "").slice(0, 6))}
keyboardType="numeric"
maxLength={6}
placeholder="Retaper les 6 chiffres"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
secureTextEntry={!showPassword}
/>

</>
)}

<View style={styles.tipBox}>
<Ionicons name="information-circle-outline" size={18} color="#9AF5C7" />
<Text style={styles.tipText}>
Code agent = installation terrain.{"\n"}
Code parrainage = invitation par une boutique.
</Text>
</View>

</View>
</ScrollView>

<View style={styles.footer}>
<TouchableOpacity
style={[styles.btn, loading ? { opacity: 0.7 } : null]}
onPress={onContinue}
activeOpacity={0.9}
disabled={loading}
>
<Text style={styles.btnText}>
{loading ? "Activation..." : "Continuer"}
</Text>
</TouchableOpacity>

<Text style={styles.footerHint}>
Tu pourras modifier le nom et la ville plus tard dans Profil.
</Text>

<TouchableOpacity
style={styles.switchBtn}
onPress={switchAccount}
activeOpacity={0.85}
disabled={loading}
>
<Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.75)" />
<Text style={styles.switchText}>Changer de boutique</Text>
</TouchableOpacity>

</View>

</KeyboardAvoidingView>
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617" },

header: {
paddingTop: 60,
paddingHorizontal: 20,
paddingBottom: 16,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},
headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },

card: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginTop: 8,
padding: 16,
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},

heroRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
heroIcon: {
width: 42,
height: 42,
borderRadius: 14,
backgroundColor: "rgba(138,77,255,0.35)",
borderWidth: 1,
borderColor: "rgba(138,77,255,0.35)",
alignItems: "center",
justifyContent: "center",
},
title: { color: "#fff", fontWeight: "900", fontSize: 18 },
sub: { color: "#A8A3C2", fontSize: 12, marginTop: 4, lineHeight: 18 },

label: {
color: "#C6C0DD",
fontSize: 12,
fontWeight: "800",
marginTop: 12,
marginBottom: 6,
},
input: {
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
borderRadius: 14,
paddingHorizontal: 14,
paddingVertical: 12,
color: "#fff",
fontSize: 14,
},

tipBox: {
marginTop: 14,
backgroundColor: "rgba(154,245,199,0.08)",
borderRadius: 14,
padding: 12,
flexDirection: "row",
alignItems: "flex-start",
gap: 10,
borderWidth: 1,
borderColor: "rgba(154,245,199,0.12)",
},
tipText: { flex: 1, color: "#C6C0DD", fontSize: 12, lineHeight: 18 },

pwdRow: { flexDirection: "row", alignItems: "center", gap: 8 },
eyeBtn: { padding: 10 },

footer: {
position: "absolute",
bottom: 0,
left: 0,
right: 0,
paddingHorizontal: 20,
paddingBottom: 26,
paddingTop: 14,
backgroundColor: "rgba(10,6,23,0.96)",
borderTopWidth: 1,
borderTopColor: "rgba(255,255,255,0.06)",
},
btn: {
width: "100%",
backgroundColor: "#8A4DFF",
paddingVertical: 14,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},
btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
footerHint: {
marginTop: 10,
color: "#A8A3C2",
fontSize: 11,
textAlign: "center",
},

switchBtn: {
marginTop: 14,
alignSelf: "center",
flexDirection: "row",
alignItems: "center",
gap: 8,
paddingVertical: 8,
paddingHorizontal: 10,
},
switchText: {
color: "rgba(255,255,255,0.75)",
fontSize: 13,
fontWeight: "700",
},
});
