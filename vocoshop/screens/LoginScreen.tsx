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
} from "react-native";

import PhoneInput from "react-native-phone-number-input";
import { AuthContext } from "../src/api/context/AuthContext";
import { useLanguage } from "../src/api/context/LanguageContext";
import LanguagePicker from "../src/api/components/LanguagePicker";
import { FLAGS } from "../src/api/constants/flags";

function safeTrim(v: any) {
return typeof v === "string" ? v.trim() : "";
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

const inputRef = useRef<TextInput>(null);
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
if(step === "password"){
setTimeout(()=>{
inputRef.current?.focus();
},250);
}
},[step]);

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
const msg = e?.response?.data?.error || "Erreur de connexion";
setErrorMsg(msg);
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
navigation.reset({ index:0, routes:[{ name:"Entry" }] });
} catch (e: any) {
const data = e?.response?.data;
setErrorMsg(data?.error || "Erreur de connexion");
} finally {
setLoading(false);
}
};

return (

<View style={styles.container}>

<View style={styles.langRow}>
  <View />
  <LanguagePicker />
</View>

<Text style={styles.title}>
{step === "phone" ? t("login.title.phone") : isNewAccount ? "Nouveau compte" : "Bienvenue"}
</Text>

{step === "phone" && (
<Text style={styles.subtitle}>{t("login.subtitle.phone")}</Text>
)}

{step === "password" && (
<Text style={styles.subtitle}>{isNewAccount ? "Creez votre compte" : "Entrez votre mot de passe"}</Text>
)}

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
onChangeCountry={(c)=>{ setCountryCode(c.cca2); setCallingCode(c.callingCode[0]); }}
containerStyle={styles.phoneAbsolute}
textContainerStyle={{opacity:0,height:0}}
codeTextStyle={{display:"none"}}
/>
<View style={styles.separator} />
<Text style={styles.prefix}>+{callingCode}</Text>
<TextInput
value={phone}
onChangeText={(t)=>setPhone(t)}
keyboardType="phone-pad"
placeholder="06XXXXXXXX"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.phoneCustomInput}
/>
</View>
<Text style={styles.infoText}>{t("login.phone.info")}</Text>
{!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
<TouchableOpacity style={[styles.btn,loading && {opacity:0.7}]} onPress={continueWithPhone} disabled={loading}>
{loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>{t("login.btn.continue")}</Text>}
</TouchableOpacity>
</>

) : (

<>
<TouchableOpacity activeOpacity={1} onPress={()=>inputRef.current?.focus()} style={styles.otpWrapper}>
<TextInput ref={inputRef} style={styles.hiddenInput} secureTextEntry value={password} onChangeText={(t)=>{ setPassword(t); setErrorMsg(""); }} placeholder="Mot de passe" placeholderTextColor="rgba(255,255,255,0.35)" />
</TouchableOpacity>

<View style={styles.otpRow}>
{[0,1,2,3,4,5].map((i)=>(
<Animated.View key={i} style={[styles.otpBox, password.length===i && {borderColor:"#6C63FF",backgroundColor:glowAnim.interpolate({inputRange:[0,1],outputRange:["#1F1F2A","rgba(108,99,255,0.22)"]})}]}>
<Text style={styles.otpText}>{password[i] || ""}</Text>
</Animated.View>
))}
</View>

{isNewAccount && (
<>
<TextInput style={styles.input} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmer mot de passe" placeholderTextColor="rgba(255,255,255,0.35)" />
<TextInput style={styles.input} value={storeName} onChangeText={setStoreName} placeholder="Nom boutique (optionnel)" placeholderTextColor="rgba(255,255,255,0.35)" />
<TextInput style={styles.input} value={ownerName} onChangeText={setOwnerName} placeholder="Nom proprietaire (optionnel)" placeholderTextColor="rgba(255,255,255,0.35)" />
<TextInput style={styles.input} value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" placeholder="Tel proprietaire (optionnel)" placeholderTextColor="rgba(255,255,255,0.35)" />
<TextInput style={styles.input} value={agentCode} onChangeText={setAgentCode} placeholder="Code agent / parrain (optionnel)" placeholderTextColor="rgba(255,255,255,0.35)" />
</>
)}

{!!errorMsg && (
<View style={styles.lockBox}>
<Text style={styles.lockTitle}>Erreur</Text>
<Text style={styles.lockText}>{errorMsg}</Text>
</View>
)}

<TouchableOpacity style={[styles.btn,(loading || !password) && {opacity:0.5}]} onPress={handleSubmit} disabled={loading || !password}>
{loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>{isNewAccount ? "Creer mon compte" : "Se connecter"}</Text>}
</TouchableOpacity>

<TouchableOpacity style={{alignItems:"center",marginTop:14}} onPress={resetForm}>
<Text style={{color:"#6C63FF",fontSize:14,fontWeight:"700"}}>Changer de numero</Text>
</TouchableOpacity>
</>
)}

</View>
);
}

const styles = StyleSheet.create({

container:{ flex:1, backgroundColor:"#0F0F14", justifyContent:"center", paddingHorizontal:26 },

langRow:{ flexDirection:"row", justifyContent:"flex-end", position:"absolute", top:60, right:26, zIndex:10 },

title:{ color:"#fff", fontSize:32, fontWeight:"900", textAlign:"center", marginBottom:10 },

subtitle:{ color:"rgba(255,255,255,0.55)", textAlign:"center", marginBottom:22, fontSize:14 },

phoneWrapper:{ flexDirection:"row", alignItems:"center", backgroundColor:"#1A1A22", borderRadius:12, height:58, paddingHorizontal:14 },

flag:{ fontSize:22, marginRight:10 },

phoneAbsolute:{ position:"absolute", left:0, top:0, bottom:0, width:70, backgroundColor:"transparent" },

separator:{ width:1, height:24, backgroundColor:"rgba(255,255,255,0.15)", marginRight:10 },

prefix:{ color:"#fff", fontSize:16, fontWeight:"700", marginRight:6 },

phoneCustomInput:{ flex:1, color:"#fff", fontSize:16 },

infoText:{ color:"rgba(255,255,255,0.45)", marginTop:10, marginBottom:12, fontSize:12, textAlign:"center" },

btn:{ backgroundColor:"#6C63FF", paddingVertical:16, borderRadius:12, alignItems:"center", marginTop:10 },

btnText:{ color:"#fff", fontSize:18, fontWeight:"900" },

otpWrapper:{ marginTop:-30, marginBottom:14, paddingVertical:6 },

hiddenInput:{ position:"absolute", opacity:0 },

otpRow:{ flexDirection:"row", justifyContent:"space-between", marginTop:8 },

otpBox:{ width:48, height:58, borderRadius:10, backgroundColor:"#1C1C26", justifyContent:"center", alignItems:"center", borderWidth:1, borderColor:"rgba(255,255,255,0.12)" },

otpText:{ color:"#fff", fontSize:24, fontWeight:"900" },

lockBox:{ backgroundColor:"rgba(255,91,91,0.10)", borderColor:"rgba(255,91,91,0.25)", borderWidth:1, borderRadius:6, padding:12, marginTop:12 },

lockTitle:{ color:"#fff", fontWeight:"900", fontSize:14, marginBottom:6 },

lockText:{ color:"rgba(255,255,255,0.75)", fontSize:12 },

errorText:{ color:"#FF5B5B", fontSize:13, textAlign:"center", marginBottom:8 },

input:{ backgroundColor:"#1A1A22", borderRadius:12, height:50, paddingHorizontal:14, color:"#fff", fontSize:15, marginBottom:10 },

});
