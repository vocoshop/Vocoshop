// screens/SubscriptionCheckoutScreen.tsx

import React, { useState, useEffect, useRef } from "react";
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
import * as Haptics from "expo-haptics";

// ✅ PAYMENT HANDLER GLOBAL
import { handleSubscriptionPayment } from "../src/api/payments/paymentHandler";

// ✅ CONTEXT ABONNEMENT
import { useSubscription } from "../src/api/context/SubscriptionContext";
import { Alert } from "react-native";

export default function SubscriptionCheckoutScreen() {

const navigation = useNavigation<any>();
const { refreshSubscription } = useSubscription();

const [method, setMethod] = useState<string | null>(null);

const [phone,setPhone] = useState("");
const [card,setCard] = useState("");
const [expiry,setExpiry] = useState("");
const [cvc,setCvc] = useState("");
const [email,setEmail] = useState("");

const [loading,setLoading] = useState(false);

/* 🔥 V7 FINTECH UX */
const [waitingValidation,setWaitingValidation] = useState(false);

/* =====================================================
🔥 VALIDATION SMART FRONT (AJOUT PRO)
===================================================== */

const isMobileValid =
method === "mobile_money" && phone && phone.length >= 6;

const isCardValid =
method === "card" && card && expiry && cvc;

const isYabetooValid =
method === "yabetoo" && email && email.includes("@");

const canPay = isMobileValid || isCardValid || isYabetooValid;

/* =====================================================
🔥 DETECTION OPERATEUR UX (FRONT ONLY)
===================================================== */

function detectOperator(phone:string){
const clean = phone.replace(/\s+/g,"");

if(clean.startsWith("+24206") || clean.startsWith("06")) return "MTN";
if(clean.startsWith("+24205") || clean.startsWith("05")) return "AIRTEL";
if(clean.startsWith("+24207") || clean.startsWith("07")) return "ORANGE";

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

{/* 🟢 YABETOO — Mobile Money Congo */}
<TouchableOpacity
style={styles.option}
onPress={()=>setMethod("yabetoo")}
>
<Ionicons name="globe-outline" size={22} color="#22c55e" />
<Text style={styles.optionText}>
Yabetoo (Mobile Money MTN / Airtel)
</Text>
          <Text style={styles.optionSubtext}>Paiement Mobile Money intégré</Text>
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
{method === "yabetoo"
? "Paiement via Yabetoo"
: method === "card"
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
📲 Confirmez la demande sur votre téléphone Mobile Money.
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

{/* 💳 CARD INPUTS */}
{method === "card" && !waitingValidation && (
<>
<TextInput
placeholder="Numéro de carte"
placeholderTextColor="#888"
style={styles.input}
value={card}
onChangeText={setCard}
keyboardType="numeric"
/>

<TextInput
placeholder="MM/AA"
placeholderTextColor="#888"
style={styles.input}
value={expiry}
onChangeText={setExpiry}
/>

<TextInput
placeholder="CVC"
placeholderTextColor="#888"
style={styles.input}
value={cvc}
onChangeText={setCvc}
keyboardType="numeric"
/>
</>
)}

{/* 🟢 YABETOO INPUT */}
{method === "yabetoo" && !waitingValidation && (
<>
          <Text style={{ color:"#22c55e", fontSize:12, marginBottom:8, textAlign:"center" }}>
            Paiement sécurisé intégré à Vocoshop
          </Text>
<TextInput
placeholder="Email (pour la confirmation)"
placeholderTextColor="#888"
style={styles.input}
value={email}
onChangeText={setEmail}
keyboardType="email-address"
autoCapitalize="none"
/>
</>
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

if(method === "mobile_money" && !phone){
Alert.alert("Numéro requis","Entrez votre numéro Mobile Money.");
return;
}

if(method === "card" && (!card || !expiry || !cvc)){
Alert.alert("Carte incomplète","Vérifiez vos informations.");
return;
}

if(method === "yabetoo" && !email){
Alert.alert("Email requis","Entrez votre email pour la confirmation.");
return;
}

setLoading(true);
setWaitingValidation(true);

const result = await handleSubscriptionPayment({
method: method === "yabetoo" ? "yabetoo" : method === "card" ? "card" : "mobile_money",
phone,
card,
expiry,
cvc,
email: email || `client_${Date.now()}@vocoshop.com`,
countryCode: "CG",
});

// 🟢 YABETOO → WebView intégrée
if (method === "yabetoo" && result && typeof result === "object" && "checkoutUrl" in result) {
setMethod(null);
navigation.navigate("YabetooWebView", {
checkoutUrl: result.checkoutUrl,
});
return;
}

// 📱 Mobile Money / Carte → validation sur téléphone
Alert.alert(
"Paiement en cours",
"📲 Validez la demande sur votre téléphone."
);

// 🔥 refresh abonnement global
await refreshSubscription();

// 🔥 vibration succès UX PRO
await Haptics.notificationAsync(
Haptics.NotificationFeedbackType.Success
);

// 🔥 reset champs
setPhone("");
setCard("");
setExpiry("");
setCvc("");

setMethod(null);

navigation.reset({
index:0,
routes:[{ name:"Home" }]
});

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
optionSubtext:{
color:"#aaa",
marginLeft:12,
fontSize:11,
marginTop:-4,
marginBottom:4
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
