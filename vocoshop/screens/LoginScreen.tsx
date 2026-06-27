import React, { useState, useContext, useEffect, useRef } from "react";
import {
View,
Text,
TextInput,
TouchableOpacity,
StyleSheet,
ActivityIndicator,
Alert,
ScrollView,
KeyboardAvoidingView,
Platform,
} from "react-native";

import PhoneInput from "react-native-phone-number-input";
import { AuthContext } from "../src/api/context/AuthContext";
import { useLanguage } from "../src/api/context/LanguageContext";
import LanguagePicker from "../src/api/components/LanguagePicker";
import { FLAGS } from "../src/api/constants/flags";

function safeTrim(v: any) {
return typeof v === "string" ? v.trim() : "";
}

function formatAgentCode(text: string): string {
const clean = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
if (clean.length <= 2) return clean;
if (clean.length <= 6) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
return `${clean.slice(0, 2)}-${clean.slice(2, 6)}-${clean.slice(6, 7)}`;
}

export default function LoginScreen({ navigation }: any) {

const { checkPhone, loginWithPassword, registerWithPassword } = useContext(AuthContext);
const { t } = useLanguage();

const [phone, setPhone] = useState("");
const [password, setPassword] = useState("");
const [step, setStep] = useState<"phone" | "password">("phone");
const [loading, setLoading] = useState(false);
const [countryCode, setCountryCode] = useState<any>("FR");
const [callingCode, setCallingCode] = useState("33");

const [isNewAccount, setIsNewAccount] = useState(false);
const [confirmPassword, setConfirmPassword] = useState("");
const [storeName, setStoreName] = useState("");
const [ownerName, setOwnerName] = useState("");
const [ownerPhone, setOwnerPhone] = useState("");
const [agentCode, setAgentCode] = useState("");
const [errorMsg, setErrorMsg] = useState("");

const phoneRef = useRef<any>(null);
const passwordRef = useRef<TextInput>(null);

useEffect(() => {
if (step === "password") {
setTimeout(() => passwordRef.current?.focus(), 300);
}
}, [step]);

const buildFullPhone = () => {
const prefix = callingCode;
const raw = safeTrim(phone);
const cleaned = raw.replace(/^0+/, "");
return `+${prefix}${cleaned}`;
};

const resetForm = () => {
setStep("phone");
setPassword("");
setConfirmPassword("");
setStoreName("");
setOwnerName("");
setOwnerPhone("");
setAgentCode("");
setErrorMsg("");
setIsNewAccount(false);
};

const continueWithPhone = async () => {
if (loading) return;
const cleanPhone = buildFullPhone();
if (!cleanPhone || cleanPhone.length < 8) {
Alert.alert("", t("login.error.invalid_phone"));
return;
}
try {
setLoading(true);
setErrorMsg("");
const result = await checkPhone(cleanPhone);
setIsNewAccount(!result.exists);
setStep("password");
} catch (e: any) {
setErrorMsg(e?.response?.data?.error || "Erreur de connexion");
} finally {
setLoading(false);
}
};

const handleSubmit = async () => {
if (loading) return;
const cleanPhone = buildFullPhone();
const pwd = safeTrim(password);
if (!pwd || pwd.length < 6) {
setErrorMsg("Mot de passe trop court (min 6)");
return;
}
if (isNewAccount && pwd !== safeTrim(confirmPassword)) {
setErrorMsg("Les mots de passe ne correspondent pas");
return;
}
setLoading(true);
setErrorMsg("");
try {
if (isNewAccount) {
await registerWithPassword(cleanPhone, pwd, safeTrim(storeName) || undefined, safeTrim(ownerName) || undefined, safeTrim(ownerPhone) || undefined, safeTrim(agentCode) || undefined);
} else {
await loginWithPassword(cleanPhone, pwd);
}
navigation.reset({ index: 0, routes: [{ name: "Entry" }] });
} catch (e: any) {
setErrorMsg(e?.response?.data?.error || "Erreur de connexion");
} finally {
setLoading(false);
}
};

return (
<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
<ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

{step === "phone" && (
<View style={styles.langRow}>
<View />
<LanguagePicker />
</View>
)}

<Text style={styles.title}>
{step === "phone" ? t("login.title.phone") : isNewAccount ? "Nouveau compte" : "Bienvenue"}
</Text>

<Text style={styles.subtitle}>
{step === "phone" ? t("login.subtitle.phone") : isNewAccount ? "Créez votre compte Vocoshop" : "Saisissez votre mot de passe"}
</Text>

{step === "phone" ? (

<>
<View style={styles.phoneWrapper}>
<Text style={styles.flag}>{FLAGS[countryCode] || ""}</Text>
<PhoneInput
ref={phoneRef}
defaultCode={countryCode}
layout="first"
disableArrowIcon
withDarkTheme={false}
onChangeCountry={(c) => { setCountryCode(c.cca2); setCallingCode(c.callingCode[0]); }}
containerStyle={styles.phoneAbsolute}
textContainerStyle={{ opacity: 0, height: 0 }}
codeTextStyle={{ display: "none" }}
/>
<View style={styles.separator} />
<Text style={styles.prefix}>+{callingCode}</Text>
<TextInput
value={phone}
onChangeText={(t) => setPhone(t)}
keyboardType="phone-pad"
placeholder="06XXXXXXXX"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.phoneCustomInput}
/>
</View>
<Text style={styles.infoText}>{t("login.phone.info")}</Text>
{!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
<TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]} onPress={continueWithPhone} disabled={loading}>
{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t("login.btn.continue")}</Text>}
</TouchableOpacity>
</>

) : (

<View style={styles.formCard}>

<View style={styles.fieldGroup}>
<Text style={styles.fieldIcon}>{"\uD83D\uDD10"}</Text>
<TextInput
ref={passwordRef}
style={styles.fieldInput}
value={password}
onChangeText={(t) => { setPassword(t); setErrorMsg(""); }}
secureTextEntry
placeholder="Mot de passe"
placeholderTextColor="rgba(255,255,255,0.35)"
autoCapitalize="none"
/>
</View>

{isNewAccount && (
<>
<View style={styles.fieldGroup}>
<Text style={styles.fieldIcon}>{"\uD83D\uDD10"}</Text>
<TextInput
style={styles.fieldInput}
value={confirmPassword}
onChangeText={setConfirmPassword}
secureTextEntry
placeholder="Confirmer le mot de passe"
placeholderTextColor="rgba(255,255,255,0.35)"
autoCapitalize="none"
/>
</View>

<View style={styles.sectionLabel}>
<Text style={styles.sectionLabelText}>INFORMATIONS BOUTIQUE</Text>
</View>

<View style={styles.fieldGroup}>
<Text style={styles.fieldIcon}>{"\uD83C\uDFEA"}</Text>
<TextInput
style={styles.fieldInput}
value={storeName}
onChangeText={setStoreName}
placeholder="Nom de la boutique"
placeholderTextColor="rgba(255,255,255,0.35)"
/>
</View>

<View style={styles.fieldGroup}>
<Text style={styles.fieldIcon}>{"\uD83D\uDC64"}</Text>
<TextInput
style={styles.fieldInput}
value={ownerName}
onChangeText={setOwnerName}
placeholder="Nom du propriétaire"
placeholderTextColor="rgba(255,255,255,0.35)"
/>
</View>

<View style={styles.fieldGroup}>
<Text style={styles.fieldIcon}>{"\uD83D\uDCF1"}</Text>
<TextInput
style={styles.fieldInput}
value={ownerPhone}
onChangeText={setOwnerPhone}
keyboardType="phone-pad"
placeholder="Téléphone du propriétaire"
placeholderTextColor="rgba(255,255,255,0.35)"
/>
</View>

<View style={styles.sectionLabel}>
<Text style={styles.sectionLabelText}>PARRAINAGE</Text>
</View>

<View style={styles.fieldGroup}>
<Text style={styles.fieldIcon}>{"\uD83C\uDFC6"}</Text>
<TextInput
style={styles.fieldInput}
value={agentCode}
onChangeText={(t) => setAgentCode(formatAgentCode(t))}
placeholder="Code agent (ex: AG-1234-A)"
placeholderTextColor="rgba(255,255,255,0.35)"
autoCapitalize="characters"
/>
</View>
</>
)}

{!!errorMsg && (
<View style={styles.lockBox}>
<Text style={styles.lockTitle}>Erreur</Text>
<Text style={styles.lockText}>{errorMsg}</Text>
</View>
)}

<TouchableOpacity style={[styles.btn, (loading || !password) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={loading || !password}>
{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{isNewAccount ? "Créer mon compte" : "Se connecter"}</Text>}
</TouchableOpacity>

<TouchableOpacity style={styles.backBtn} onPress={resetForm}>
<Text style={styles.backBtnText}>Changer de numéro</Text>
</TouchableOpacity>

</View>
)}

</ScrollView>
</KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({

container: { flex: 1, backgroundColor: "#0F0F14" },
scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 26 },

langRow: { flexDirection: "row", justifyContent: "flex-end", position: "absolute", top: 60, right: 26, zIndex: 10 },

title: { color: "#fff", fontSize: 32, fontWeight: "900", textAlign: "center", marginBottom: 10 },

subtitle: { color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 28, fontSize: 14, paddingHorizontal: 10 },

phoneWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A22", borderRadius: 14, height: 58, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },

flag: { fontSize: 22, marginRight: 10 },

phoneAbsolute: { position: "absolute", left: 0, top: 0, bottom: 0, width: 70, backgroundColor: "transparent" },

separator: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.12)", marginRight: 10 },

prefix: { color: "#fff", fontSize: 16, fontWeight: "700", marginRight: 6 },

phoneCustomInput: { flex: 1, color: "#fff", fontSize: 16 },

infoText: { color: "rgba(255,255,255,0.40)", marginTop: 8, marginBottom: 14, fontSize: 12, textAlign: "center" },

formCard: { width: "100%" },

fieldGroup: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A22", borderRadius: 14, height: 54, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },

fieldIcon: { fontSize: 18, marginRight: 12, opacity: 0.7 },

fieldInput: { flex: 1, color: "#fff", fontSize: 15, height: 54 },

sectionLabel: { marginTop: 6, marginBottom: 10, paddingLeft: 2 },

sectionLabelText: { color: "#6C63FF", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },

btn: { backgroundColor: "#6C63FF", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 6 },

btnText: { color: "#fff", fontSize: 17, fontWeight: "900" },

backBtn: { alignItems: "center", marginTop: 16, paddingVertical: 8 },

backBtnText: { color: "#6C63FF", fontSize: 14, fontWeight: "700" },

lockBox: { backgroundColor: "rgba(255,91,91,0.10)", borderColor: "rgba(255,91,91,0.25)", borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 6, marginBottom: 4 },

lockTitle: { color: "#fff", fontWeight: "900", fontSize: 14, marginBottom: 4 },

lockText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },

errorText: { color: "#FF5B5B", fontSize: 13, textAlign: "center", marginBottom: 10 },

});
