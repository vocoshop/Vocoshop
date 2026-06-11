// screens/PersonalInfoScreen.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { AuthContext } from "../src/api/context/AuthContext";
import { getMyStoreProfile, updateStoreOnboarding } from "../src/api/services/storeService";

export default function PersonalInfoScreen() {
const navigation = useNavigation<any>();
const { token } = useContext(AuthContext);

// ✅ champs éditables
const [storeName, setStoreName] = useState("");
const [city, setCity] = useState("");
const [agentCode, setAgentCode] = useState("");

const [loading, setLoading] = useState(false);

// ✅ mode édition (si infos déjà remplies => lecture seule + crayon)
const [isEditing, setIsEditing] = useState(false);

// ✅ NEW: lock affichage (info seulement)
const [agentLocked, setAgentLocked] = useState(false);

// ✅ headers SAFE
const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
}),
[token]
);

// ✅ pré-remplir depuis /store/me
const load = useCallback(async () => {
try {
if (!token) return;
const data = await getMyStoreProfile(headers);

const nextStoreName = (data?.shopName ?? "").toString();
const nextCity = (data?.city ?? "").toString();

// ✅ agentCode + lock (info)
const loadedAgent = (data?.agentCode ?? "").toString().trim();

setStoreName(nextStoreName);
setCity(nextCity);
setAgentCode(loadedAgent);

// ✅ lock si déjà présent (info)
setAgentLocked(loadedAgent.length > 0);

// ✅ si déjà rempli => on grise (pas d’édition)
const alreadyFilled =
nextStoreName.trim().length > 0 ||
nextCity.trim().length > 0 ||
loadedAgent.trim().length > 0;

setIsEditing(!alreadyFilled);
} catch (err: any) {
console.log("❌ PersonalInfo load error:", err?.response?.data || err);
}
}, [headers, token]);

useEffect(() => {
load();
}, [load]);

const onSave = useCallback(async () => {
try {
if (!token) return;

const cleanStoreName = storeName.trim();
const cleanCity = city.trim();

if (!cleanStoreName) {
Alert.alert("Champ obligatoire", "Entre le nom commercial de la boutique.");
return;
}

setLoading(true);

// ✅ IMPORTANT: on n’envoie plus agentCode depuis l’app (verrou total)
const payload: any = {
storeName: cleanStoreName,
city: cleanCity,
};

await updateStoreOnboarding(payload, headers);

Alert.alert("✅ Enregistré", "Vos informations ont été mises à jour.");

// ✅ repasse en lecture seule + retour profil
setIsEditing(false);
navigation.goBack();
} catch (err: any) {
console.log("❌ PersonalInfo save error:", err?.response?.data || err);
Alert.alert("Erreur", "Impossible d'enregistrer. Réessaie.");
} finally {
setLoading(false);
}
}, [city, headers, navigation, storeName, token]);

return (
<View style={styles.container}>
{/* HEADER */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Informations personnelles</Text>

<View style={{ width: 26 }} />
</View>

<KeyboardAvoidingView
style={{ flex: 1 }}
behavior={Platform.OS === "ios" ? "padding" : undefined}
>
<ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
{/* CARD */}
<View style={styles.card}>
{/* header row + crayon */}
<View style={styles.cardHeaderRow}>
<View style={{ flex: 1, paddingRight: 10 }}>
<Text style={styles.cardTitle}>Votre boutique</Text>
<Text style={styles.cardSub}>Ces informations s’affichent dans votre profil.</Text>
</View>

{!isEditing && (
<TouchableOpacity
style={styles.editIconBtn}
onPress={() => setIsEditing(true)}
activeOpacity={0.85}
>
<Ionicons name="pencil" size={18} color="#C6C0DD" />
</TouchableOpacity>
)}
</View>

{/* Nom commercial */}
<Text style={styles.label}>Nom commercial *</Text>
<TextInput
value={storeName}
onChangeText={setStoreName}
placeholder="Ex: Marché Bon Prix"
placeholderTextColor="rgba(255,255,255,0.35)"
style={[styles.input, !isEditing && styles.inputDisabled]}
autoCapitalize="words"
editable={isEditing}
/>

{/* Ville */}
<Text style={styles.label}>Ville</Text>
<TextInput
value={city}
onChangeText={setCity}
placeholder="Ex: Brazzaville"
placeholderTextColor="rgba(255,255,255,0.35)"
style={[styles.input, !isEditing && styles.inputDisabled]}
autoCapitalize="words"
editable={isEditing}
/>

{/* Code agent (TOUJOURS verrouillé) */}
<Text style={styles.label}>Code agent</Text>

<View style={styles.lockRow}>
<TextInput
value={agentCode}
onChangeText={setAgentCode}
placeholder="—"
placeholderTextColor="rgba(255,255,255,0.35)"
style={[styles.input, styles.inputDisabled, styles.inputLocked]}
autoCapitalize="characters"
editable={false} // 🔒 verrou total
/>

<View style={styles.lockIcon}>
<Ionicons name="lock-closed-outline" size={16} color="#A8A3C2" />
</View>
</View>

<Text style={styles.lockHint}>
Code agent : modifiable uniquement par Vocoshop.
</Text>

<View style={styles.tipBox}>
<Ionicons name="information-circle-outline" size={18} color="#9AF5C7" />
<Text style={styles.tipText}>
Le code agent servira plus tard à rattacher automatiquement votre boutique à un agent.
</Text>
</View>
</View>
</ScrollView>

{/* SAVE BUTTON (fixed bottom) */}
<View style={styles.footer}>
{isEditing ? (
<TouchableOpacity
style={[styles.saveBtn, loading ? { opacity: 0.7 } : null]}
onPress={onSave}
activeOpacity={0.9}
disabled={loading}
>
<Text style={styles.saveText}>
{loading ? "Enregistrement..." : "Enregistrer"}
</Text>
</TouchableOpacity>
) : (
<TouchableOpacity
style={[styles.saveBtn, styles.editBtn]}
onPress={() => setIsEditing(true)}
activeOpacity={0.9}
>
<Text style={styles.saveText}>Modifier</Text>
</TouchableOpacity>
)}
</View>
</KeyboardAvoidingView>
</View>
);
}

/* =====================
STYLES (premium + cohérent avec ton thème)
===================== */
const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
},

header: {
paddingTop: 60,
paddingHorizontal: 20,
paddingBottom: 16,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},
headerTitle: {
color: "#fff",
fontSize: 18,
fontWeight: "800",
},

card: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginTop: 6,
padding: 16,
borderRadius: 18,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},

cardHeaderRow: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "flex-start",
},

editIconBtn: {
width: 36,
height: 36,
borderRadius: 12,
backgroundColor: "rgba(255,255,255,0.06)",
alignItems: "center",
justifyContent: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},

cardTitle: {
color: "#fff",
fontWeight: "900",
fontSize: 16,
},
cardSub: {
color: "#A8A3C2",
fontSize: 12,
marginTop: 6,
marginBottom: 14,
lineHeight: 18,
},

label: {
color: "#C6C0DD",
fontSize: 12,
fontWeight: "700",
marginTop: 10,
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

inputDisabled: {
opacity: 0.6,
},

lockRow: {
position: "relative",
},
inputLocked: {
opacity: 0.55,
paddingRight: 46, // laisse la place au cadenas
},
lockIcon: {
position: "absolute",
right: 12,
top: 14,
backgroundColor: "rgba(255,255,255,0.06)",
borderRadius: 10,
padding: 6,
},
lockHint: {
color: "#A8A3C2",
fontSize: 11,
marginTop: 8,
lineHeight: 16,
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
tipText: {
flex: 1,
color: "#C6C0DD",
fontSize: 12,
lineHeight: 18,
},

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
saveBtn: {
width: "100%",
backgroundColor: "#8A4DFF",
paddingVertical: 14,
borderRadius: 14,
alignItems: "center",
justifyContent: "center",
},

editBtn: {
backgroundColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},

saveText: {
color: "#fff",
fontWeight: "900",
fontSize: 16,
},
});
