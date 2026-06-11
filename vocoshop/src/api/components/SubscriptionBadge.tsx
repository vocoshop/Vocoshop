import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSubscription } from "../context/SubscriptionContext";

export default function SubscriptionBadge(){

const ctx = useSubscription();
const loadingSubscription = (ctx as any).loadingSubscription ?? false;
const subscription = ctx.subscription as any;

if(loadingSubscription) return null;
if(!subscription) return null;

const label =
subscription.status === "trial"
? `Essai — ${subscription.daysLeft ?? 0} jours`
: `${subscription.daysLeft ?? 0} jours restants`;

return(
<View style={styles.badge}>
<Text style={styles.text}>{label}</Text>
</View>
);
}

const styles = StyleSheet.create({
badge:{
backgroundColor:"#1A1A22",
paddingHorizontal:10,
paddingVertical:6,
borderRadius:10,
alignSelf:"flex-start", // 👈 ultra important pour HomeScreen
},
text:{
color:"#6C63FF",
fontWeight:"700",
fontSize:12,
}
});
