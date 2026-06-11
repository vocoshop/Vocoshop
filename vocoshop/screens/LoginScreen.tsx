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

const { requestOTP, verifyOTP, deviceLogin } = useContext(AuthContext);
const { t } = useLanguage();

const [phone, setPhone] = useState("");
const [code, setCode] = useState("");
const [step, setStep] = useState<"phone" | "code">("phone");
const [loading, setLoading] = useState(false);
const [countryCode, setCountryCode] = useState<any>("FR");
const [callingCode, setCallingCode] = useState("33");
const [otpTimer, setOtpTimer] = useState(30); // ⏱ timer OTP
const [canResend, setCanResend] = useState(false); // bouton renvoyer OTP

const inputRef = useRef<TextInput>(null);
const phoneRef = useRef<any>(null);

const glowAnim = useRef(new Animated.Value(0)).current;

const [deviceLocked, setDeviceLocked] = useState(false);
const [lockMessage, setLockMessage] = useState<string>("");

useEffect(() => {
Animated.loop(
Animated.sequence([
Animated.timing(glowAnim,{toValue:1,duration:900,useNativeDriver:false,easing:Easing.ease}),
Animated.timing(glowAnim,{toValue:0,duration:900,useNativeDriver:false,easing:Easing.ease}),
])
).start();
},[]);

useEffect(() => {

if(step !== "code") return;

setOtpTimer(30);
setCanResend(false);

const interval = setInterval(() => {

setOtpTimer(prev => {

if(prev <= 1){
clearInterval(interval);
setCanResend(true);
return 0;
}

return prev - 1;

});

},1000);

return () => clearInterval(interval);

},[step]);

// AUTO-FOCUS SUR LE CHAMP CODE QUAND ON ARRIVE SUR L'ÉTAPE CODE
useEffect(() => {
if(step === "code"){
setTimeout(()=>{
inputRef.current?.focus();
},250);
}
},[step]);

const resetLock = () => {
setDeviceLocked(false);
setLockMessage("");
};

const goToStepPhone = () => {
setStep("phone");
setCode("");
resetLock();
};

const buildFullPhone = () => {
const prefix = callingCode;
return `+${prefix}${safeTrim(phone)}`;
};

const continueWithPhone = async () => {

if (loading) return;

const cleanPhone = buildFullPhone();

if (!cleanPhone) {
Alert.alert("",t("login.error.invalid_phone"));
return;
}

try {

setLoading(true);
resetLock();

const r = await deviceLogin(cleanPhone);

if (r.ok) {
navigation.reset({ index:0, routes:[{ name:"Entry" }] });
return;
}

const ok = await requestOTP(cleanPhone);
    if (ok) {
      setStep("code");
    } else {
      Alert.alert("", t("login.error.connection"));
    }
  } catch (e:any) {

const data = e?.response?.data;

if (data?.code === "DEVICE_LOCKED") {
setDeviceLocked(true);
setLockMessage(data?.error);
await requestOTP(cleanPhone);
setStep("code");
}

} finally {
setLoading(false);
}
};

const checkCode = async (manual?:string) => {

if (loading) return;

const cleanPhone = buildFullPhone();
const cleanCode = safeTrim(manual ?? code);

if (!cleanPhone || cleanCode.length !== 6) return;

try {

setLoading(true);
resetLock();

const ok = await verifyOTP(cleanPhone, cleanCode);

if (!ok) {
Alert.alert("", t("login.error.invalid_code"));
return;
}

navigation.reset({ index:0, routes:[{ name:"Entry" }] });

} catch(err:any){

const data = err?.response?.data;

if(data?.code==="DEVICE_LOCKED"){
setDeviceLocked(true);
setLockMessage(data?.error);
return;
}

Alert.alert("",data?.error || t("login.error.unknown"));

} finally{
setLoading(false);
}
};

const handleOtpChange = (t:string)=>{
const clean = t.replace(/[^0-9]/g,"").slice(0,6);
setCode(clean);

if(clean.length===6){
inputRef.current?.blur();
setTimeout(()=>checkCode(clean),180);
}
};

/* 🔁 RESEND OTP — ICI PRÉCISÉMENT */
const resendOTP = async () => {

if(!canResend || loading) return;

try{
setLoading(true);

const cleanPhone = buildFullPhone();
await requestOTP(cleanPhone);

// ✅ RELANCE LE TIMER CORRECTEMENT
startOtpTimer();

}catch(e){
Alert.alert("", t("login.otp.resend_error"));
}finally{
setLoading(false);
}
};

const startOtpTimer = () => {

setOtpTimer(30);
setCanResend(false);

const interval = setInterval(() => {
setOtpTimer(prev => {
if(prev <= 1){
clearInterval(interval);
setCanResend(true);
return 0;
}
return prev - 1;
});
},1000);

return () => clearInterval(interval);
};

return (

<View style={styles.container}>

{/* LANGUAGE PICKER */}
<View style={styles.langRow}>
  <View />
  <LanguagePicker />
</View>

{/* 🔵 TITRE DYNAMIQUE */}
<Text style={styles.title}>
{step === "phone" ? t("login.title.phone") : t("login.title.code")}
</Text>

{/* 🔵 SUBTITLE DYNAMIQUE */}
{step === "phone" && (
<Text style={styles.subtitle}>
{t("login.subtitle.phone")}
</Text>
)}

{step === "code" && (
<Text style={styles.subtitle}>
{t("login.subtitle.code")}
</Text>
)}

{step==="phone" ? (

<>
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
textContainerStyle={{
opacity:0,
height:0
}}
codeTextStyle={{display:"none"}}
/>

<View style={styles.separator} />

<Text style={styles.prefix}>
+{callingCode}
</Text>

<TextInput
value={phone}
onChangeText={(t)=>setPhone(t)}
keyboardType="phone-pad"
placeholder="06XXXXXXXX"
placeholderTextColor="rgba(255,255,255,0.35)"
style={styles.phoneCustomInput}
/>

</View>

<Text style={styles.infoText}>
{t("login.phone.info")}
</Text>

<TouchableOpacity
style={[styles.btn,loading && {opacity:0.7}]}
onPress={continueWithPhone}
disabled={loading}
>
{loading
? <ActivityIndicator color="#fff"/>
: <Text style={styles.btnText}>{t("login.btn.continue")}</Text>}
</TouchableOpacity>

</>

):(

// 🟣 OTP — JUSTE AFFICHAGE AMÉLIORÉ
<>
<TouchableOpacity
activeOpacity={1}
onPress={()=>inputRef.current?.focus()}
style={styles.otpWrapper}
>

<TextInput
ref={inputRef}
style={styles.hiddenInput}
keyboardType="numeric"
value={code}
onChangeText={handleOtpChange}
maxLength={6}
/>

<View style={styles.otpRow}>
{[0,1,2,3,4,5].map((i)=>(
<Animated.View
key={i}
style={[
styles.otpBox,
code.length===i && {
borderColor:"#6C63FF",
backgroundColor:glowAnim.interpolate({
inputRange:[0,1],
outputRange:["#1F1F2A","rgba(108,99,255,0.22)"]
})
}
]}
>
<Text style={styles.otpText}>
{code[i] || ""}
</Text>
</Animated.View>
))}
</View>

</TouchableOpacity>

{!!deviceLocked && (
<View style={styles.lockBox}>
<Text style={styles.lockTitle}>{t("login.lock.title")}</Text>
<Text style={styles.lockText}>{lockMessage}</Text>
</View>
)}

<TouchableOpacity
style={[
styles.btn,
(loading || code.length !== 6) && {opacity:0.5}
]}
onPress={()=>checkCode()}
disabled={loading || code.length !== 6}
>
{loading
? <ActivityIndicator color="#fff"/>
: <Text style={styles.btnText}>{t("login.btn.connect")}</Text>}
</TouchableOpacity>

<View style={{alignItems:"center", marginTop:14}}>

{!canResend ? (

<Text style={{color:"rgba(255,255,255,0.45)", fontSize:13}}>
{t("login.otp.resend_in", { s: otpTimer })}
</Text>

) : (

<TouchableOpacity onPress={resendOTP}>
<Text style={{color:"#6C63FF", fontSize:14, fontWeight:"700"}}>
{t("login.otp.resend")}
</Text>
</TouchableOpacity>
)}
</View>

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

phoneAbsolute:{
position:"absolute",
left:0,
top:0,
bottom:0,
width:70,
backgroundColor:"transparent",
},

separator:{ width:1, height:24, backgroundColor:"rgba(255,255,255,0.15)", marginRight:10 },

prefix:{ color:"#fff", fontSize:16, fontWeight:"700", marginRight:6 },

phoneCustomInput:{ flex:1, color:"#fff", fontSize:16 },

infoText:{ color:"rgba(255,255,255,0.45)", marginTop:10, marginBottom:12, fontSize:12, textAlign:"center" },

btn:{ backgroundColor:"#6C63FF", paddingVertical:16, borderRadius:12, alignItems:"center", marginTop:10 },

btnText:{ color:"#fff", fontSize:18, fontWeight:"900" },

/* 🔥 OTP PREMIUM — SEULE MODIF STYLE */
otpWrapper:{
marginTop:-30,
marginBottom:14,
paddingVertical:6,
},

hiddenInput:{position:"absolute",opacity:0},

otpRow:{
flexDirection:"row",
justifyContent:"space-between",
marginTop:8,
},

otpBox:{
width:48,
height:58,
borderRadius:10,
backgroundColor:"#1C1C26",
justifyContent:"center",
alignItems:"center",
borderWidth:1,
borderColor:"rgba(255,255,255,0.12)",
},

otpText:{
color:"#fff",
fontSize:24,
fontWeight:"900",
},

lockBox:{ backgroundColor:"rgba(255,91,91,0.10)", borderColor:"rgba(255,91,91,0.25)", borderWidth:1, borderRadius:6, padding:12, marginTop:12 },

lockTitle:{ color:"#fff", fontWeight:"900", fontSize:14, marginBottom:6 },

lockText:{ color:"rgba(255,255,255,0.75)", fontSize:12 },

});
