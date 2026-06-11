// screens/SubscriptionPayScreen.tsx

import React from "react";
import {
View,
Text,
TouchableOpacity,
StyleSheet,
ActivityIndicator
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSubscription } from "../src/api/context/SubscriptionContext";

export default function SubscriptionPayScreen() {

const navigation = useNavigation<any>();
const { subscription } = useSubscription();

const [loading, setLoading] = React.useState(false);

/* =====================================================
🔥 SAFE STATUS
===================================================== */

const status =
subscription?.subscriptionStatus ||
subscription?.status ||
"trial";

/* =====================================================
🔥 HANDLE PAY (SIMULATION CHECKOUT)
===================================================== */

const handleContinue = async () => {

if (loading) return;

setLoading(true);

try {

// 🔥 ici on navigue vers le checkout réel
navigation.navigate("SubscriptionCheckout");

} catch (e) {

console.log("PAY NAV ERROR", e);

} finally {

setLoading(false);

}

};

return (
<View style={styles.container}>

{/* TITLE */}
<Text style={styles.title}>
Activer mon abonnement
</Text>

{/* CARD */}
<View style={styles.card}>

<Text style={styles.planTitle}>
Plan Professionnel
</Text>

<Text style={styles.price}>
3 900 FCFA / mois
</Text>

<Text style={styles.desc}>
Accès complet à Vocoshop sans interruption :
</Text>

<Text style={styles.feature}>✔ Inventaire intelligent</Text>
<Text style={styles.feature}>✔ Suivi des ventes</Text>
<Text style={styles.feature}>✔ Analyse des performances</Text>
<Text style={styles.feature}>✔ Assistance prioritaire</Text>

</View>

{/* =====================================================
🔥 PAY BUTTON
===================================================== */}

<TouchableOpacity
activeOpacity={0.9}
style={[
styles.payButton,
loading && { opacity: 0.6 },
]}
onPress={handleContinue}
disabled={loading}
>

{loading ? (
<ActivityIndicator color="#fff"/>
) : (
<Text style={styles.payText}>
Continuer sans interruption
</Text>
)}

</TouchableOpacity>

{/* BACK */}
<TouchableOpacity
onPress={() => navigation.goBack()}
style={{ marginTop: 20 }}
>
<Text style={styles.back}>
Retour
</Text>
</TouchableOpacity>

</View>
);
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#070014",
paddingHorizontal:20,
paddingTop:100
},

title:{
color:"#fff",
fontSize:28,
fontWeight:"800",
marginBottom:25
},

card:{
backgroundColor:"#151028",
padding:20,
borderRadius:18
},

planTitle:{
color:"#fff",
fontSize:18,
fontWeight:"700",
marginBottom:5
},

price:{
color:"#BFA6FF",
fontSize:22,
fontWeight:"800",
marginBottom:15
},

desc:{
color:"#aaa",
marginBottom:10
},

feature:{
color:"#ddd",
marginBottom:6
},

payButton:{
marginTop:30,
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

back:{
color:"#aaa",
textAlign:"center"
}

});
