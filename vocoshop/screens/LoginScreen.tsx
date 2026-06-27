import React, { useState, useContext, useEffect, useRef } from "react";
import {
View,
Text,
TextInput,
TouchableOpacity,
StyleSheet,
ActivityIndicator,
Alert,
Animated,
Easing,
KeyboardAvoidingView,
Platform,
ScrollView,
} from "react-native";

import PhoneInput from "react-native-phone-number-input";
import { AuthContext } from "../src/api/context/AuthContext";
import { useLanguage } from "../src/api/context/LanguageContext";
import LanguagePicker from "../src/api/components/LanguagePicker";
import { FLAGS } from "../src/api/constants/flags";

function safeTrim(v: any) {
return typeof v === "string" ? v.trim() : "";
}

type Step = "phone" | "password" | "register";

export default function LoginScreen({ navigation }: any) {

const { checkPhone, loginWithPassword, registerWithPassword } = useContext(AuthContext);
const { t } = useLanguage();

const [phone, setPhone] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [storeName, setStoreName] = useState("");
const [step, setStep] = useState<Step>("phone");
const [mode, setMode] = useState<"login" | "register">("login");
const [loading, setLoading] = useState(false);
const [countryCode, setCountryCode] = useState<any>("FR");
const [callingCode, setCallingCode] = useState("33");
const [errorMsg, setErrorMsg] = useState("");

const passwordRef = useRef<TextInput>(null);
const confirmRef = useRef<TextInput>(null);
const storeNameRef = useRef<TextInput>(null);
const phoneRef = useRef<any>(null);

const glowAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
Animated.loop(
Animated.sequence([
Animated.timing(glowAnim,{toValue:1,duration:900,useNativeDriver:false,easing:Easing.ease}),
Animated.timing(glowAnim,{toValue:0,duration:900,useNativeDriver:false,easing:Easing.ease}),
])
).start();
},[]);

useEffect(() => {
if (step === "password") {
setTimeout(() => passwordRef.current?.focus(), 300);
} else if (step === "register") {
setTimeout(() => passwordRef.current?.focus(), 300);
}
}, [step]);

const buildFullPhone = () => {
const prefix = callingCode;
const raw = safeTrim(phone);
const cleaned = raw.replace(/^0+/, "");
return `+${prefix}${cleaned}`;
};

const goToPhoneStep = () => {
setStep("phone");
setPassword("");
setConfirmPassword("");
setStoreName("");
setErrorMsg("");
};

const continueWithPhone = async () => {
if (loading) return;

const cleanPhone = buildFullPhone();
if (!cleanPhone || cleanPhone.length < 8) {
Alert.alert("", t("login.error.invalid_phone"));
return;
}

setLoading(true);
setErrorMsg("");

try {
const result = await checkPhone(cleanPhone);

if (result.exists && result.hasPassword) {
setMode("login");
setStep("password");
} else if (result.exists && !result.hasPassword) {
setMode("login");
setStep("password");
} else {
setMode("register");
setStep("register");
}
} catch (e: any) {
const msg = e?.response?.data?.error || "Erreur de connexion";
setErrorMsg(msg);
} finally {
setLoading(false);
}
};

const handleSubmitPassword = async () => {
if (loading) return;

const cleanPhone = buildFullPhone();
const pwd = safeTrim(password);

if (!pwd || pwd.length < 6) {
setErrorMsg("Mot de passe trop court (min 6 caracteres)");
return;
}

setLoading(true);
setErrorMsg("");

try {
await loginWithPassword(cleanPhone, pwd);
navigation.reset({ index: 0, routes: [{ name: "Entry" }] });
} catch (e: any) {
const data = e?.response?.data;
if (data?.error) {
setErrorMsg(data.error);
} else {
setErrorMsg("Erreur de connexion");
}
} finally {
setLoading(false);
}
};

const handleSubmitRegister = async () => {
if (loading) return;

const cleanPhone = buildFullPhone();
const pwd = safeTrim(password);
const confirm = safeTrim(confirmPassword);

if (!pwd || pwd.length < 6) {
setErrorMsg("Mot de passe trop court (min 6 caracteres)");
return;
}

if (pwd !== confirm) {
setErrorMsg("Les mots de passe ne correspondent pas");
return;
}

setLoading(true);
setErrorMsg("");

try {
const name = safeTrim(storeName) || undefined;
await registerWithPassword(cleanPhone, pwd, name);
navigation.reset({ index: 0, routes: [{ name: "Entry" }] });
} catch (e: any) {
const data = e?.response?.data;
if (data?.error) {
setErrorMsg(data.error);
} else {
setErrorMsg("Erreur d'inscription");
}
} finally {
setLoading(false);
}
};

return (
<KeyboardAvoidingView
style={styles.container}
behavior={Platform.OS === "ios" ? "padding" : undefined}
>
<ScrollView
contentContainerStyle={styles.scroll}
keyboardShouldPersistTaps="handled"
>

{/* LANGUAGE PICKER */}
<View style={styles.langRow}>
<View />
<LanguagePicker />
</View>

{step === "phone" && (
<>

<Text style={styles.title}>{t("login.title.phone")}</Text>
<Text style={styles.subtitle}>{t("login.subtitle.phone")}</Text>

<View style={styles.phoneWrapper}>

<Text style={styles.flag}>
{FLAGS[countryCode] || "🌍"}
</Text>

<PhoneInput
ref={phoneRef}
defaultCode={countryCode}
layout="first"
disableArrowIcon
withDarkTheme={false}
onChangeCountry={(c)=>{
setCountryCode(c.cca2);
setCallingCode(c.callingCode[0]);
}}
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

{!!errorMsg && (
<Text style={styles.errorText}>{errorMsg}</Text>
)}

<TouchableOpacity
style={[styles.btn, loading && { opacity: 0.7 }]}
onPress={continueWithPhone}
disabled={loading}
>
{loading
? <ActivityIndicator color="#fff" />
: <Text style={styles.btnText}>{t("login.btn.continue")}</Text>}
</TouchableOpacity>
</>
)}

{step === "password" && (
<>

<Text style={styles.title}>
{mode === "login" ? "Connexion" : "Creer un mot de passe"}
</Text>
<Text style={styles.subtitle}>
{mode === "login"
? `Saisissez votre mot de passe pour ${buildFullPhone()}`
: "Choisissez un mot de passe pour securiser votre compte"}
</Text>

<TextInput
ref={passwordRef}
value={password}
onChangeText={setPassword}
secureTextEntry
placeholder="Mot de passe"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
/>

{!!errorMsg && (
<Text style={styles.errorText}>{errorMsg}</Text>
)}

<TouchableOpacity
style={[styles.btn, loading && { opacity: 0.7 }]}
onPress={handleSubmitPassword}
disabled={loading}
>
{loading
? <ActivityIndicator color="#fff" />
: <Text style={styles.btnText}>Se connecter</Text>}
</TouchableOpacity>

<TouchableOpacity style={styles.backBtn} onPress={goToPhoneStep}>
<Text style={styles.backBtnText}>Changer de numero</Text>
</TouchableOpacity>
</>
)}

{step === "register" && (
<>

<Text style={styles.title}>Creer un compte</Text>
<Text style={styles.subtitle}>
Inscrivez-vous avec {buildFullPhone()}
</Text>

<TextInput
ref={passwordRef}
value={password}
onChangeText={setPassword}
secureTextEntry
placeholder="Mot de passe (min 6 car.)"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
/>

<TextInput
ref={confirmRef}
value={confirmPassword}
onChangeText={setConfirmPassword}
secureTextEntry
placeholder="Confirmer le mot de passe"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
/>

<TextInput
ref={storeNameRef}
value={storeName}
onChangeText={setStoreName}
placeholder="Nom de votre boutique (optionnel)"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.input}
/>

{!!errorMsg && (
<Text style={styles.errorText}>{errorMsg}</Text>
)}

<TouchableOpacity
style={[styles.btn, loading && { opacity: 0.7 }]}
onPress={handleSubmitRegister}
disabled={loading}
>
{loading
? <ActivityIndicator color="#fff" />
: <Text style={styles.btnText}>Creer mon compte</Text>}
</TouchableOpacity>

<TouchableOpacity style={styles.backBtn} onPress={goToPhoneStep}>
<Text style={styles.backBtnText}>Changer de numero</Text>
</TouchableOpacity>
</>
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
subtitle: { color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 22, fontSize: 14 },

phoneWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#1A1A22", borderRadius: 12, height: 58, paddingHorizontal: 14 },
flag: { fontSize: 22, marginRight: 10 },
phoneAbsolute: { position: "absolute", left: 0, top: 0, bottom: 0, width: 70, backgroundColor: "transparent" },
separator: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.15)", marginRight: 10 },
prefix: { color: "#fff", fontSize: 16, fontWeight: "700", marginRight: 6 },
phoneCustomInput: { flex: 1, color: "#fff", fontSize: 16 },
infoText: { color: "rgba(255,255,255,0.45)", marginTop: 10, marginBottom: 12, fontSize: 12, textAlign: "center" },

input: { backgroundColor: "#1A1A22", borderRadius: 12, height: 56, paddingHorizontal: 16, color: "#fff", fontSize: 16, marginBottom: 12 },

btn: { backgroundColor: "#6C63FF", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
btnText: { color: "#fff", fontSize: 18, fontWeight: "900" },

backBtn: { alignItems: "center", marginTop: 16 },
backBtnText: { color: "#6C63FF", fontSize: 14, fontWeight: "700" },

errorText: { color: "#FF5B5B", fontSize: 13, textAlign: "center", marginBottom: 8 },
});
