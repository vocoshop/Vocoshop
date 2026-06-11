// screens/SubscriptionScreen.tsx

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSubscription } from "../src/api/context/SubscriptionContext";
import API from "../src/api/api";

export default function SubscriptionScreen() {

  const navigation = useNavigation<any>();
  const { subscription, refreshSubscription } = useSubscription();

  const [invoices,setInvoices] = useState<any[]>([]);

/* =====================================================
 🔥 FETCH FACTURES
 ===================================================== */

async function fetchInvoices(){

try{

const res = await API.get("/invoices/my");

if(Array.isArray(res.data)){
setInvoices(res.data);
}

}catch(e){
console.log("invoice fetch error",e);
}

}

/* =====================================================
 🔥 AUTO REFRESH SCREEN FOCUS
 ===================================================== */

useFocusEffect(
useCallback(() => {
refreshSubscription();
fetchInvoices();
}, [refreshSubscription])
);

/* =====================================================
 🔥 SAFE DATA
 ===================================================== */

const status = React.useMemo(() => {
if (!subscription) return "loading";

return (
subscription.subscriptionStatus ||
subscription.status ||
null
);
}, [subscription]);

const plan = subscription?.plan || "Essai gratuit";
const installedAt = subscription?.installedAt;
const paidUntil = subscription?.paidUntil;

/* =====================================================
 🔥 DAYS LEFT - CORRIGÉ
 ===================================================== */

function getDaysLeft() {
if (!installedAt && !paidUntil) return null;

const now = new Date();

// Si abonnement payé avec paidUntil
if (paidUntil) {
  const paidDate = new Date(paidUntil);
  const diff = (paidDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const left = Math.ceil(diff);
  return left > 0 ? left : 0;
}

// Sinon si trial (installedAt + 30 jours)
if (installedAt) {
  const start = new Date(installedAt);
  const diff = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const left = 30 - Math.floor(diff);
  return left > 0 ? left : 0;
}

return null;
}

const daysLeft = getDaysLeft();

// Statut essai élargi (inclut trial et trial_extended)
const isTrial = status === "trial" || status === "trial_extended";

// Statut actif
const isActive = status === "active";

// Statut grâce
const isGrace = status === "grace";

/* =====================================================
 🔥 STATUS UI
 ===================================================== */

const getStatusLabel = () => {
if (status === "active" || status === "trial_extended") return "🟢 Abonnement actif";
if (status === "trial") return "🟡 Essai en cours";
if (status === "grace") return "🟠 Période de grâce";
if (status === "canceled") return "🔴 Abonnement annulé";
if (status === "expired") return "🔴 Expiré";
if (status === "loading") return "⏳ Chargement...";
return "❓ Statut inconnu";
};

const statusLabel = getStatusLabel();

/* =====================================================
 🔥 NEXT PAYMENT DATE - CORRIGÉ
 ===================================================== */

const formatDate = (date: Date | string) =>
new Date(date).toLocaleDateString("fr-FR");

function getNextPaymentDate() {
// Abonnement actif avec paidUntil
if (isActive && paidUntil) {
  return formatDate(paidUntil);
}

// Trial avec installedAt
if (isTrial && installedAt) {
  const d = new Date(installedAt);
  d.setDate(d.getDate() + 30);
  return formatDate(d);
}

// Période de grâce
if (isGrace && subscription?.graceUntil) {
  return formatDate(subscription.graceUntil);
}

return "—";
}

const nextPaymentDate = getNextPaymentDate();

/* =====================================================
 🔥 PLAN NAME - CORRIGÉ
 ===================================================== */

const getPlanName = () => {
if (!subscription) return "Essai gratuit";
if (isActive) return subscription.plan || "Plan Professionnel";
if (isGrace) return subscription.plan || "Plan Professionnel";
return "Essai gratuit";
};

const planName = getPlanName();

/* =====================================================
 🔥 LOADING STATE
 ===================================================== */

if (status === "loading") {
return (
<View style={styles.container}>
<Text style={{ color: "#fff", marginTop: 120 }}>
Chargement abonnement...
</Text>
</View>
);
}

/* =====================================================
 UI
 ===================================================== */

return (
<View style={styles.container}>

{/* 🔙 HEADER */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>
Mon abonnement
</Text>

<View style={{ width:26 }} />
</View>

<View style={{flex:1}}>
<ScrollView showsVerticalScrollIndicator={false}>

{/* =====================================================
 🔥 CARTE ABONNEMENT
 ===================================================== */}

<View style={styles.card}>

<Text style={styles.planTitle}>
{planName}
</Text>

<Text style={styles.status}>
{statusLabel}
</Text>

<View style={{ marginTop:14 }}>
<Text style={styles.feature}>✔ Accès complet à Vocoshop</Text>
<Text style={styles.feature}>✔ Inventaire intelligent</Text>
<Text style={styles.feature}>✔ Suivi des ventes</Text>
<Text style={styles.feature}>✔ Analyse des performances</Text>
<Text style={styles.feature}>✔ Assistance prioritaire</Text>
</View>

<View style={{ marginTop:18 }}>

{daysLeft !== null && daysLeft <= 10 && (
<Text style={styles.warning}>
⚠️ Plus que {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}
</Text>
)}

{daysLeft !== null && daysLeft !== 0 && isTrial && (
<Text style={styles.info}>
J-{daysLeft} restants
</Text>
)}

{isGrace && (
<Text style={styles.warning}>
⚠️ Abonnement expiré - renouvellement requis
</Text>
)}

<Text style={styles.info}>
Prochaine échéance : {nextPaymentDate}
</Text>

</View>

</View>

{/* =====================================================
 🔥 FACTURES
 ===================================================== */}

<View style={{ marginTop:30 }}>

<TouchableOpacity
style={styles.invoiceBtn}
onPress={()=> navigation.navigate("InvoiceList",{ invoices })}
>
<Ionicons name="document-text-outline" size={20} color="#BFA6FF"/>
<Text style={styles.invoiceText}>
Voir mes factures
</Text>
</TouchableOpacity>

{invoices.length === 0 && (
<Text style={styles.noInvoice}>
Aucune facture disponible
</Text>
)}

</View>

</ScrollView>
</View>

{/* =====================================================
 🔥 ACTIONS BAS
 ===================================================== */}

<View style={styles.bottomActions}>

{!isActive && (
<TouchableOpacity
style={styles.payBtn}
onPress={()=> navigation.navigate("SubscriptionPay")}
>
<Text style={styles.payText}>
{isGrace ? "Renouveler mon abonnement" : "Payer mon abonnement"}
</Text>
</TouchableOpacity>
)}

<TouchableOpacity
onPress={async ()=>{

try{

await API.post("/subscription/cancel");

Alert.alert(
"Abonnement annulé",
"Votre accès reste actif jusqu'à la fin de la période payée."
);

refreshSubscription();

}catch(e){
console.log("cancel error",e);
}

}}
>
<Text style={styles.cancel}>
Annuler mon abonnement
</Text>
</TouchableOpacity>

</View>

</View>
);
}

/* =====================================================
🎨 STYLES
===================================================== */

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#070014",
paddingHorizontal:20,
paddingTop:140
},

header:{
position:"absolute",
top:60,
left:20,
right:20,
flexDirection:"row",
alignItems:"center",
justifyContent:"space-between",
zIndex:20
},

headerTitle:{
color:"#fff",
fontSize:18,
fontWeight:"800"
},

card:{
backgroundColor:"#151028",
padding:20,
borderRadius:18
},

planTitle:{
color:"#fff",
fontSize:22,
fontWeight:"800"
},

status:{
color:"#BFA6FF",
marginTop:6,
fontWeight:"700"
},

feature:{
color:"#ddd",
marginBottom:6
},

info:{
  color:"#aaa",
  marginTop:4
},

warning:{
  color:"#FFA500",
  marginTop:4,
  fontWeight:"700"
},

invoiceBtn:{
flexDirection:"row",
alignItems:"center",
backgroundColor:"#151028",
padding:16,
borderRadius:14
},

invoiceText:{
color:"#fff",
marginLeft:10,
fontWeight:"700"
},

noInvoice:{
color:"#888",
marginTop:10
},

bottomActions:{
paddingBottom:40
},

payBtn:{
marginTop:20,
backgroundColor:"#7B4DFF",
paddingVertical:18,
borderRadius:20,
alignItems:"center"
},

payText:{
color:"#fff",
fontWeight:"800",
fontSize:16
},

cancel:{
color:"#FF5A5A",
textAlign:"center",
marginTop:16,
fontWeight:"700"
}

});
