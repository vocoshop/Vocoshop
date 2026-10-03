// screens/SubscriptionCheckoutScreen.tsx

import React, { useState, useEffect, useRef, useContext } from "react";
import {
View,
Text,
TouchableOpacity,
StyleSheet,
Modal,
TextInput,
Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "../src/api/types/navigation";
import * as Haptics from "expo-haptics";

// ✅ PAYMENT HANDLER GLOBAL
import { handleSubscriptionPayment } from "../src/api/payments/paymentHandler";

// ✅ STORE PROFILE
import { AuthContext } from "../src/api/context/AuthContext";
import { getMyStoreProfile } from "../src/api/services/storeService";
import { Alert } from "react-native";

export default function SubscriptionCheckoutScreen() {

const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
const { token } = useContext(AuthContext);

const [method, setMethod] = useState<string | null>(null);

const [phone,setPhone] = useState("");

const [loading,setLoading] = useState(false);

/* 🔥 V7 FINTECH UX */
const [waitingValidation,setWaitingValidation] = useState(false);

/* 🔥 STORE PROFILE CACHED */
const [customerName, setCustomerName] = useState("");
const [customerPhone, setCustomerPhone] = useState("");

useEffect(() => {
(async () => {
if (!token) return;
try {
const profile = await getMyStoreProfile({
Authorization: `Bearer ${token}`,
});
setCustomerName(profile.ownerName || profile.shopName || "");
setCustomerPhone(profile.ownerPhone || profile.phone || "");
} catch (e) { console.warn("load profile for checkout", e); }
})();
}, [token]);

/* =====================================================
🔥 VALIDATION SMART FRONT (AJOUT PRO)
===================================================== */

const isMobileValid =
method === "mobile_money" && phone && phone.length >= 6;

const isCardValid = method === "card";

const canPay = isMobileValid || isCardValid;

/* =====================================================
🔥 DETECTION OPERATEUR UX (FRONT ONLY)
===================================================== */

function detectOperator(phone:string){
const clean = phone.replace(/\s+/g,"");

// Normaliser le prefixe : enlever +242, 00242 ou 242 pour ne garder que le numero local
let local = clean;
if (local.startsWith("+242")) local = local.slice(4);
else if (local.startsWith("00242")) local = local.slice(5);
else if (local.startsWith("242") && local.length > 7) local = local.slice(3);

if(local.startsWith("06")) return "MTN";
if(local.startsWith("05")) return "AIRTEL";
if(local.startsWith("07")) return "ORANGE";

return null;
}

const operator =
method === "mobile_money" && phone
? detectOperator(phone)
: null;

/* =====================================================
🔥 ANIMATION OVERLAY PRO
===================================================== */

const scaleAnim = useRef(new Animated.Value(0.85)).current;
const pulseAnim = useRef(new Animated.Value(1)).current;

useEffect(()=>{
if(method){
Animated.spring(scaleAnim,{
toValue:1,
useNativeDriver:true,
}).start();
}else{
scaleAnim.setValue(0.85);
}
},[method]);

/* =====================================================
🔥 LOADER ANIMÉ QUAND PAIEMENT
===================================================== */

useEffect(()=>{
if(loading){
Animated.loop(
Animated.sequence([
Animated.timing(pulseAnim,{toValue:1.05,duration:500,useNativeDriver:true}),
Animated.timing(pulseAnim,{toValue:1,duration:500,useNativeDriver:true}),
])
).start();
}else{
pulseAnim.setValue(1);
}
},[loading]);

return (
<View style={styles.container}>

<Text style={styles.title}>Choisissez votre mode de paiement</Text>

{/* 📱 MOBILE MONEY GLOBAL */}
<TouchableOpacity
style={styles.option}
onPress={()=>setMethod("mobile_money")}
>
<Ionicons name="phone-portrait-outline" size={22} color="#BFA6FF" />
<Text style={styles.optionText}>
Mobile Money (MTN / Airtel / Orange...)
</Text>
</TouchableOpacity>

{/* 💳 CARTE */}
<TouchableOpacity
style={styles.option}
onPress={()=>setMethod("card")}
>
<Ionicons name="card-outline" size={22} color="#BFA6FF" />
<Text style={styles.optionText}>
Carte Visa / MasterCard
</Text>
</TouchableOpacity>

{/* =====================================================
🔥 OVERLAY CENTER PAYMENT
===================================================== */}

<Modal visible={!!method} transparent animationType="fade">
<View style={styles.overlayBg}>

<Animated.View
style={[
styles.overlayCard,
{ transform:[{ scale:scaleAnim }] }
]}
>

<Text style={styles.formTitle}>
{method === "card"
? "Paiement Carte Bancaire"
: "Paiement Mobile Money"}
</Text>

{/* =====================================================
🔥 MODE ATTENTE VALIDATION FINTECH (V7)
===================================================== */}
{waitingValidation && (
<View style={{ alignItems:"center", paddingVertical:30 }}>

<Ionicons
name="time-outline"
size={42}
color="#BFA6FF"
style={{ marginBottom:12 }}
/>

<Text style={{
color:"#fff",
fontWeight:"800",
fontSize:16,
textAlign:"center"
}}>
Validation en cours…
</Text>

<Text style={{
color:"#aaa",
marginTop:8,
textAlign:"center"
}}>
📲 {method === "card"
? "La page de paiement sécurisé va s’ouvrir."
: "📲 Confirmez la demande sur votre téléphone Mobile Money."}
</Text>

</View>
)}

{/* 📱 MOBILE MONEY INPUT */}
{method === "mobile_money" && !waitingValidation && (
<>
{operator && (
<View style={styles.operatorBadge}>
<Ionicons name="checkmark-circle-outline" size={18} color="#BFA6FF"/>
<Text style={styles.operatorText}>
{operator} détecté automatiquement
</Text>
</View>
)}

<TextInput
placeholder="Numéro de téléphone"
placeholderTextColor="#888"
style={styles.input}
value={phone}
onChangeText={setPhone}
keyboardType="phone-pad"
/>
</>
)}

{method === "card" && !waitingValidation && (
<View style={styles.secureCheckoutNotice}>
<Ionicons name="lock-closed-outline" size={22} color="#BFA6FF" />
<Text style={styles.secureCheckoutText}>
Les informations de votre carte seront saisies sur la page sécurisée du prestataire de paiement.
</Text>
</View>
)}

{/* 🔥 PAY BTN — VERSION ULTRA PRO */}
<Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
<TouchableOpacity
style={[
styles.payBtn,
(!canPay || loading || waitingValidation) && { opacity:0.4 }
]}
disabled={!canPay || loading || waitingValidation}
onPress={async ()=>{

try{

if(loading) return;

// 🔥 vibration immédiate UX
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

const selectedMethod = method as "mobile_money" | "card";

if(selectedMethod === "mobile_money" && !phone.trim()){
Alert.alert("Numéro requis","Entrez votre numéro Mobile Money.");
return;
}

setLoading(true);
setWaitingValidation(selectedMethod === "mobile_money");

const result = await handleSubscriptionPayment({
method: selectedMethod,
phone,
email: `client_${Date.now()}@vocoshop.com`,
});

setMethod(null);
navigation.navigate("YabetooWebView", {
checkoutUrl: result.checkoutUrl,
customerName,
customerPhone: selectedMethod === "mobile_money" ? phone : customerPhone,
});
return;

}catch(e){
console.log("❌ PAYMENT ERROR",e);
}finally{
setLoading(false);
setWaitingValidation(false);
}

}}
>
<Text style={{color:"#fff",fontWeight:"800"}}>
{loading ? "Paiement..." : "Payer maintenant"}
</Text>
</TouchableOpacity>
</Animated.View>

<TouchableOpacity onPress={()=>setMethod(null)}>
<Text style={{color:"#aaa",marginTop:12}}>Annuler</Text>
</TouchableOpacity>

</Animated.View>

</View>
</Modal>

</View>
);
}

const styles = StyleSheet.create({
container:{
flex:1,
backgroundColor:"#070014",
paddingTop:100,
paddingHorizontal:20
},
title:{
color:"#fff",
fontSize:24,
fontWeight:"800",
marginBottom:20
},
option:{
flexDirection:"row",
alignItems:"center",
padding:16,
backgroundColor:"#151028",
borderRadius:14,
marginBottom:12
},
optionText:{
color:"#fff",
marginLeft:12,
fontWeight:"700"
},

overlayBg:{
flex:1,
backgroundColor:"rgba(0,0,0,0.7)",
justifyContent:"center",
alignItems:"center"
},

overlayCard:{
backgroundColor:"#151028",
padding:20,
borderRadius:20,
width:"85%"
},

formTitle:{
color:"#fff",
fontWeight:"800",
marginBottom:15
},

input:{
backgroundColor:"#070014",
color:"#fff",
padding:12,
borderRadius:12,
marginBottom:10
},

payBtn:{
backgroundColor:"#7B4DFF",
padding:14,
borderRadius:14,
alignItems:"center",
marginTop:10
},

secureCheckoutNotice:{
flexDirection:"row",
alignItems:"flex-start",
backgroundColor:"#221A3A",
padding:12,
borderRadius:12,
marginBottom:10
},
secureCheckoutText:{
color:"#fff",
marginLeft:8,
flex:1,
lineHeight:20
},

operatorBadge:{
flexDirection:"row",
alignItems:"center",
backgroundColor:"#221A3A",
padding:10,
borderRadius:12,
marginBottom:12
},
operatorText:{
color:"#BFA6FF",
marginLeft:8,
fontWeight:"700"
}
});
