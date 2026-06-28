// screens/NotificationScreen.tsx

import React, { useCallback } from "react";
import {
View,
Text,
StyleSheet,
FlatList,
TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useNotifications } from "../src/api/context/NotificationContext";

export default function NotificationScreen() {

const navigation = useNavigation<any>();

const {
notifications,
refreshNotifications,
markAsRead,
} = useNotifications();

/* =====================================================
🔥 AUTO REFRESH A L'OUVERTURE
===================================================== */

useFocusEffect(
useCallback(() => {
refreshNotifications();
}, [refreshNotifications])
);

/* =====================================================
ITEM
===================================================== */

const renderItem = ({ item }: any) => {

const handlePress = () => {
markAsRead(item._id);
if (item.type === "subscription") {
navigation.navigate("SubscriptionPay");
}
};

return (
<TouchableOpacity
style={[
styles.item,
  !item.isRead && styles.unreadItem
]}
activeOpacity={0.8}
onPress={handlePress}
>

<View style={styles.iconBox}>
<Ionicons
name={getIcon(item.type)}
size={18}
color="#fff"
/>
</View>

<View style={{ flex:1 }}>
<Text style={styles.title}>
{item.title}
</Text>

<Text style={styles.message}>
{item.message}
</Text>
</View>

{!item.read && (
<View style={styles.dot}/>
)}

</TouchableOpacity>
);
};

/* =====================================================
ICON SELON TYPE
===================================================== */

function getIcon(type:string){

switch(type){

case "stock":
return "alert-circle-outline";

case "expiry":
return "time-outline";

case "subscription":
return "card-outline";

case "referral":
return "gift-outline";

default:
return "notifications-outline";
}
}

/* =====================================================
UI
===================================================== */

return (
<View style={styles.container}>

{/* HEADER */}
<View style={styles.header}>

<TouchableOpacity onPress={()=>navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff"/>
</TouchableOpacity>

<Text style={styles.headerTitle}>
Notifications
</Text>

<View style={{width:26}}/>

</View>

<FlatList
data={notifications}
keyExtractor={(item)=>item._id}
renderItem={renderItem}
contentContainerStyle={{ paddingBottom:60 }}
ListEmptyComponent={() => (
<Text style={styles.empty}>
Aucune notification
</Text>
)}
/>

</View>
);
}

/* =====================================================
🎨 STYLES — WHATSAPP DARK
===================================================== */

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#070014",
paddingTop:120,
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

item:{
flexDirection:"row",
alignItems:"center",
backgroundColor:"#151028",
padding:14,
borderRadius:14,
marginBottom:10
},

unreadItem:{
borderLeftWidth:3,
borderLeftColor:"#7B4DFF"
},

iconBox:{
width:34,
height:34,
borderRadius:10,
backgroundColor:"#7B4DFF",
alignItems:"center",
justifyContent:"center",
marginRight:12
},

title:{
color:"#fff",
fontWeight:"700",
marginBottom:2
},

message:{
color:"#aaa",
fontSize:13
},

dot:{
width:8,
height:8,
borderRadius:4,
backgroundColor:"#7B4DFF"
},

empty:{
color:"#888",
textAlign:"center",
marginTop:140
}

});
