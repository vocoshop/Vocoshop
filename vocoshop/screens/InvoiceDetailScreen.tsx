import React, { useState } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
ActivityIndicator,
Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import API from "../src/api/api";
import { Buffer } from "buffer";

export default function InvoiceDetailScreen(){

const navigation = useNavigation<any>();
const route:any = useRoute();

const invoice = route?.params?.invoice;

/* =====================================================
SAFE DATA
===================================================== */

if(!invoice){
return(
<View style={styles.container}>
<Text style={{color:"#fff",marginTop:140}}>
Facture introuvable
</Text>
</View>
);
}

const date = invoice?.createdAt
? new Date(invoice.createdAt).toLocaleDateString()
: "—";

const [downloadLoading, setDownloadLoading] = useState(false);

/* =====================================================
🔥 DOWNLOAD PDF SECURISÉ (VERSION ULTRA STABLE)
===================================================== */
async function openPDF(){
if (downloadLoading) return;
setDownloadLoading(true);

try{

const res = await API.get(
`/invoices/pdf/${invoice._id}`,
);

const fileUri =
FileSystem.documentDirectory! +
`${invoice.invoiceNumber}.pdf`;

await FileSystem.writeAsStringAsync(
fileUri,
(res.data as any).file,
{ encoding:"base64" }
);

await Sharing.shareAsync(fileUri);

}catch(e){
console.log("open pdf error",e);
Alert.alert("Erreur", "Impossible de télécharger la facture.");
} finally {
setDownloadLoading(false);
}

}

/* =====================================================
UI
===================================================== */

return(
<View style={styles.container}>

{/* HEADER */}
<View style={styles.header}>

<TouchableOpacity onPress={()=>navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff"/>
</TouchableOpacity>

<Text style={styles.headerTitle}>
Facture
</Text>

<View style={{width:26}}/>

</View>

<ScrollView
contentContainerStyle={{paddingTop:140,paddingBottom:80}}
showsVerticalScrollIndicator={false}
>

<View style={styles.card}>

{/* 🔥 WATERMARK VOCOSHOP */}
<Text style={styles.watermark}>
VOCOSHOP
</Text>

<Text style={styles.invoiceNumber}>
Facture #{invoice.invoiceNumber}
</Text>

<View style={styles.row}>
<Text style={styles.label}>Plan</Text>
<Text style={styles.value}>{invoice.plan}</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Montant</Text>
<Text style={styles.value}>
{invoice.amount} {invoice.currency}
</Text>
</View>

<View style={styles.row}>
<Text style={styles.label}>Date</Text>
<Text style={styles.value}>{date}</Text>
</View>

<View style={styles.separator}/>

<Text style={styles.footer}>
Merci d’utiliser Vocoshop 🚀
</Text>

{/* =====================================================
🔥 DOWNLOAD BUTTON
===================================================== */}

<TouchableOpacity
style={[styles.pdfBtn, downloadLoading && { opacity: 0.7 }]}
activeOpacity={0.85}
onPress={openPDF}
disabled={downloadLoading}
>
{downloadLoading ? (
<ActivityIndicator color="#fff" size="small" />
) : (
<Ionicons
name="download-outline"
size={18}
color="#fff"
/>
)}

<Text style={styles.pdfText}>
{downloadLoading ? "Téléchargement..." : "Télécharger la facture PDF"}
</Text>

</TouchableOpacity>

</View>

</ScrollView>

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
paddingHorizontal:20
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
padding:22,
borderRadius:18,
overflow:"hidden"
},

watermark:{
position:"absolute",
top:40,
left:20,
fontSize:60,
fontWeight:"900",
color:"rgba(255,255,255,0.03)"
},

invoiceNumber:{
color:"#fff",
fontSize:20,
fontWeight:"800",
marginBottom:20
},

row:{
flexDirection:"row",
justifyContent:"space-between",
marginBottom:14
},

label:{
color:"#aaa"
},

value:{
color:"#fff",
fontWeight:"700"
},

separator:{
height:1,
backgroundColor:"rgba(255,255,255,0.06)",
marginVertical:20
},

footer:{
color:"#BFA6FF",
fontWeight:"700",
textAlign:"center",
marginBottom:20
},

pdfBtn:{
flexDirection:"row",
alignItems:"center",
justifyContent:"center",
backgroundColor:"#7B4DFF",
paddingVertical:14,
borderRadius:14,
gap:10
},

pdfText:{
color:"#fff",
fontWeight:"800"
}

});
