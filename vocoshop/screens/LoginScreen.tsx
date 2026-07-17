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
Animated,
  Easing,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import PhoneInput from "react-native-phone-number-input";
import API from "../src/api/api";
import { AuthContext } from "../src/api/context/AuthContext";
import { FLAGS } from "../src/api/constants/flags";

function safeTrim(v: any) {
return typeof v === "string" ? v.trim() : "";
}

export default function LoginScreen({ navigation, route }: any) {

  const { checkPhone, loginWithPassword } = useContext(AuthContext);

  const [phone, setPhone] = useState(route?.params?.preselectedPhone
  ? route.params.preselectedPhone.replace(/^\+\d{1,3}/, "")
  : ""
);
const [password, setPassword] = useState("");
const [step, setStep] = useState<"phone" | "password">("phone");
const [loading, setLoading] = useState(false);
const [countryCode, setCountryCode] = useState<any>("FR");
const [callingCode, setCallingCode] = useState(route?.params?.preselectedPhone
  ? route.params.preselectedPhone.replace(/^\+(\d{1,3}).*$/, "$1")
  : "33"
);
  const [selectedStoreName, setSelectedStoreName] = useState(route?.params?.selectedStoreName || "");
  const [reauth, setReauth] = useState(!!route?.params?.reauth);
  const [forgotStep, setForgotStep] = useState<"" | "otp" | "newPassword">("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

const [errorMsg, setErrorMsg] = useState("");

const fadeAnim = useRef(new Animated.Value(1)).current;
const slideAnim = useRef(new Animated.Value(0)).current;
const transitioning = useRef(false);

const animateToStep = (target: "phone" | "password") => {
  if (transitioning.current) return;
  transitioning.current = true;
  Animated.parallel([
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    Animated.timing(slideAnim, { toValue: target === "phone" ? 30 : -20, duration: 120, useNativeDriver: true }),
  ]).start(() => {
    setStep(target);
    slideAnim.setValue(target === "phone" ? -20 : 30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      transitioning.current = false;
      if (target === "password") hiddenRef.current?.focus();
    });
  });
};

  useEffect(() => {
    if (route?.params?.preselectedPhone) {
      checkPhone(buildFullPhone()).then((result) => {
        if (result.exists) animateToStep("password");
      });
    }
  }, [route?.params?.preselectedPhone]);

  // Reauth : session expirée, on va direct au mot de passe
  useEffect(() => {
    if (reauth) {
      (async () => {
        try {
          const savedPhone = await AsyncStorage.getItem("voco_last_phone");
          if (savedPhone) {
            setPhone(savedPhone);
            setStep("password");
          }
        } catch (_) {}
      })();
    }
  }, [reauth]);

const glowAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
Animated.loop(
Animated.sequence([
Animated.timing(glowAnim,{toValue:1,duration:900,useNativeDriver:false,easing:Easing.ease}),
Animated.timing(glowAnim,{toValue:0,duration:900,useNativeDriver:false,easing:Easing.ease}),
])
).start();
},[]);

const phoneRef = useRef<any>(null);
const hiddenRef = useRef<TextInput>(null);

useEffect(() => {
if (step === "password") {
setTimeout(() => hiddenRef.current?.focus(), 300);
}
}, [step]);

const buildFullPhone = () => {
const prefix = callingCode;
const raw = safeTrim(phone);
const cleaned = raw.replace(/^0+/, "");
return `+${prefix}${cleaned}`;
};

const resetForm = () => {
  setPassword("");
  setErrorMsg("");
  animateToStep("phone");
};

const continueWithPhone = async () => {
  if (loading) return;
  const cleanPhone = buildFullPhone();
  if (!cleanPhone || cleanPhone.length < 8) {
    Alert.alert("", "Entre un numéro.");
    return;
  }
  try {
    setLoading(true);
    setErrorMsg("");
    const result = await checkPhone(cleanPhone);
    if (!result.exists) {
      navigation.navigate("Onboarding", { phone: cleanPhone, callingCode, countryCode });
      return;
    }
    if (result.multipleStores && result.stores && result.stores.length > 1) {
      navigation.navigate("StorePicker", { stores: result.stores, ownerPhone: cleanPhone });
      return;
    }
    animateToStep("password");
  } catch (e: any) {
    setErrorMsg(e?.response?.data?.error || "Erreur de connexion");
  } finally {
    setLoading(false);
  }
};

const handlePasswordChange = (t: string) => {
const clean = t.replace(/[^0-9]/g, "").slice(0, 6);
setPassword(clean);
setErrorMsg("");
};

const handleSubmit = async () => {
if (loading) return;
const cleanPhone = buildFullPhone();
const pwd = password;
if (!pwd || pwd.length !== 6) {
setErrorMsg("Le mot de passe doit contenir 6 chiffres");
return;
}
setLoading(true);
setErrorMsg("");
    try {
      await loginWithPassword(cleanPhone, pwd);
      // Sauvegarder le téléphone pour le reauth
      await AsyncStorage.setItem("voco_last_phone", cleanPhone);
      // Vérifier si une invitation propriétaire est en attente
try {
const invRes = await API.get("/invitations/pending", { params: { phone: cleanPhone } });
if ((invRes.data as any)?.hasInvitation) {
// Récupérer le token depuis la notif ou stockage local
const tk = await AsyncStorage.getItem("token");
navigation.reset({
index: 0,
routes: [{ name: "AcceptInvitation", params: { phone: cleanPhone, token: tk ? "pending" : "" } }],
});
return;
}
} catch {}
    navigation.reset({ index: 0, routes: [{ name: "Entry" }] });
  } catch (e: any) {
    setErrorMsg(e?.response?.data?.error || "Erreur de connexion");
  } finally {
    setLoading(false);
  }
  };

  const startForgotPassword = async () => {
    const cleanPhone = buildFullPhone();
    if (!cleanPhone || cleanPhone.length < 8) {
      Alert.alert("", "Entre un numéro valide.");
      return;
    }
    setForgotLoading(true);
    try {
      await API.post("/otp/request", { phone: cleanPhone });
      setForgotStep("otp");
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.error || "Impossible d'envoyer le code.");
    } finally { setForgotLoading(false); }
  };

  const verifyOtpAndReset = async () => {
    if (!otpCode || otpCode.length < 4) return Alert.alert("", "Entre le code reçu.");
    if (!newPassword || newPassword.length !== 6) return Alert.alert("", "Le mot de passe doit contenir 6 chiffres.");
    const cleanPhone = buildFullPhone();
    setForgotLoading(true);
    try {
      await API.post("/auth/reset-password", { phone: cleanPhone, code: otpCode, newPassword });
      Alert.alert("Succès", "Mot de passe réinitialisé. Connectez-vous.");
      setForgotStep("");
      setOtpCode("");
      setNewPassword("");
      animateToStep("password");
    } catch (e: any) {
      Alert.alert("Erreur", e?.response?.data?.error || "Échec.");
    } finally { setForgotLoading(false); }
  };

return (
<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
<ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          <Text style={styles.title}>
            {reauth ? "Session expirée" : step === "phone" ? "Bienvenue sur Vocoshop" : "Bienvenue"}
          </Text>

          <Text style={styles.subtitle}>
            {reauth ? "Inactivité prolongée. Entrez votre mot de passe." :
             step === "phone" ? "La gestion simple et intelligente de votre activité." : "Entrez votre code secret 6 chiffres"}
          </Text>

          {forgotStep ? (
            <View>
              <Text style={{ color: "#A78BFA", fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 16 }}>
                {forgotStep === "otp" ? `Code envoyé au ${buildFullPhone()}` : "Nouveau mot de passe"}
              </Text>
              {forgotStep === "otp" ? (
                <TextInput
                  style={styles.input}
                  placeholder="Code reçu par SMS"
                  placeholderTextColor="#777"
                  keyboardType="numeric"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  autoFocus
                />
              ) : null}
              <TextInput
                style={styles.input}
                placeholder={forgotStep === "otp" ? "Nouveau mot de passe (6 chiffres)" : "Nouveau mot de passe (6 chiffres)"}
                placeholderTextColor="#777"
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity
                style={[styles.btn, forgotLoading && { opacity: 0.5 }]}
                onPress={verifyOtpAndReset}
                disabled={forgotLoading}
              >
                {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Réinitialiser</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12 }} onPress={() => setForgotStep("")}>
                <Text style={{ color: "#6B7280", textAlign: "center" }}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>

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
                <Text style={styles.infoText}>Entrez votre numéro de téléphone pour commencer.</Text>
{!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
<TouchableOpacity style={[styles.btn, loading && { opacity: 0.7 }]} onPress={continueWithPhone} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continuer</Text>}
</TouchableOpacity>
</>

) : (

<View style={styles.formCard}>

<TouchableOpacity activeOpacity={1} onPress={() => hiddenRef.current?.focus()}>
<TextInput
ref={hiddenRef}
style={styles.hiddenInput}
keyboardType="numeric"
value={password}
onChangeText={handlePasswordChange}
maxLength={6}
/>
<View style={styles.otpRow}>
{[0, 1, 2, 3, 4, 5].map((i) => (
<Animated.View
key={i}
style={[styles.otpBox, password.length === i && { borderColor: "#6C63FF", backgroundColor: glowAnim.interpolate({ inputRange: [0, 1], outputRange: ["#1F1F2A", "rgba(108,99,255,0.22)"] }) }]}
>
<Text style={styles.otpText}>{password[i] || ""}</Text>
</Animated.View>
))}
</View>
</TouchableOpacity>

{!!errorMsg && (
<View style={styles.lockBox}>
<Text style={styles.lockTitle}>Erreur</Text>
<Text style={styles.lockText}>{errorMsg}</Text>
</View>
)}

<TouchableOpacity style={[styles.btn, (loading || !password) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={loading || !password}>
{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Se connecter</Text>}
</TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => { setForgotStep(""); setOtpCode(""); setNewPassword(""); resetForm(); }}>
          <Text style={styles.backBtnText}>Changer de numéro</Text>
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 20 }} onPress={startForgotPassword}>
          <Text style={{ color: "#A78BFA", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            {forgotLoading ? "Envoi du code..." : "Mot de passe oublié ?"}
          </Text>
        </TouchableOpacity>

</View>
)}
          )}

        </Animated.View>
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

hiddenInput: { position: "absolute", opacity: 0 },

otpRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },

otpBox: { width: 48, height: 58, borderRadius: 12, backgroundColor: "#1C1C26", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },

otpText: { color: "#fff", fontSize: 24, fontWeight: "900" },

btn: { backgroundColor: "#6C63FF", paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 6 },

btnText: { color: "#fff", fontSize: 17, fontWeight: "900" },

backBtn: { alignItems: "center", marginTop: 16, paddingVertical: 8 },

backBtnText: { color: "#6C63FF", fontSize: 14, fontWeight: "700" },

lockBox: { backgroundColor: "rgba(255,91,91,0.10)", borderColor: "rgba(255,91,91,0.25)", borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 6, marginBottom: 4 },

lockTitle: { color: "#fff", fontWeight: "900", fontSize: 14, marginBottom: 4 },

lockText: { color: "rgba(255,255,255,0.75)", fontSize: 13 },

errorText: { color: "#FF5B5B", fontSize: 13, textAlign: "center", marginBottom: 10 },

});
