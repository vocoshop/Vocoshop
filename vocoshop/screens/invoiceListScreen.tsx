// screens/InvoiceListScreen.tsx

import React from "react";
import {
View,
Text,
StyleSheet,
FlatList,
TouchableOpacity
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

/* =====================================================
🔥 FORMAT LABEL FACTURE
Facture Février 2026
===================================================== */
const getInvoiceLabel = (date?:string) => {

if(!date) return "";

const label = new Date(date).toLocaleDateString("fr-FR",{
month:"long",
year:"numeric"
});

/**
🔥 Majuscule automatique
*/
return label.charAt(0).toUpperCase() + label.slice(1);
};

export default function InvoiceListScreen(){

const navigation = useNavigation<any>();
const route:any = useRoute();

/* =====================================================
🔥 DATA SAFE
===================================================== */

const invoices = Array.isArray(route?.params?.invoices)
? route.params.invoices
: [];

/* =====================================================
🔥 ITEM FACTURE
===================================================== */

const renderItem = ({item}:any) => {

const date = item?.createdAt
? new Date(item.createdAt).toLocaleDateString()
: "—";

return(
<TouchableOpacity
style={styles.card}
activeOpacity={0.85}
onPress={()=>{
navigation.navigate("InvoiceDetail",{ invoice:item });
}}
>

<View style={styles.left}>

<Ionicons
name="document-text-outline"
size={22}
color="#BFA6FF"
/>

<View style={{marginLeft:12}}>

<Text style={styles.title}>
Facture {getInvoiceLabel(item?.createdAt)}
</Text>

<Text style={styles.meta}>
{date}
</Text>

</View>

</View>

<View style={{alignItems:"flex-end"}}>

<Text style={styles.amount}>
{item.amount} {item.currency}
</Text>

<Text style={styles.plan}>
{item.plan}
</Text>

</View>

</TouchableOpacity>
);
};

/* =====================================================
🔥 UI
===================================================== */

return(
<View style={styles.container}>

<View style={styles.header}>

<TouchableOpacity onPress={()=>navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff"/>
</TouchableOpacity>

<Text style={styles.headerTitle}>
Mes factures
</Text>

<View style={{width:26}}/>

</View>

<FlatList
data={invoices}
keyExtractor={(item)=>String(item._id)}
renderItem={renderItem}
showsVerticalScrollIndicator={false}
contentContainerStyle={{
paddingTop:140,
paddingBottom:60
}}
ListEmptyComponent={() => (
<Text style={styles.empty}>
Aucune facture disponible
</Text>
)}
/>

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
flexDirection:"row",
alignItems:"center",
justifyContent:"space-between",
backgroundColor:"#151028",
padding:16,
borderRadius:16,
marginBottom:12
},

left:{
flexDirection:"row",
alignItems:"center"
},

title:{
color:"#fff",
fontWeight:"700"
},

meta:{
color:"#aaa",
fontSize:12,
marginTop:2
},

amount:{
color:"#fff",
fontWeight:"800"
},

plan:{
color:"#BFA6FF",
fontSize:12,
marginTop:2
},

empty:{
color:"#888",
textAlign:"center",
marginTop:200
}

});
