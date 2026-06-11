// screens/FinishInventoryScreen.tsx
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";

export default function FinishInventoryScreen() {
const navigation = useNavigation<any>();
const route = useRoute<any>();

const sessionId = route.params?.sessionId;
const storeId = route.params?.storeId;
const lines = route.params?.lines || [];
const completedAt = route.params?.completedAt;

const saveHistory = async () => {
try {
const key = `inventory_history_${storeId}`;

// Charger l’historique actuel
const raw = await AsyncStorage.getItem(key);
const list = raw ? JSON.parse(raw) : [];

const entry = {
id: sessionId,
date: completedAt,
count: lines.length,
lines,
};

list.unshift(entry);

await AsyncStorage.setItem(key, JSON.stringify(list));

console.log("✅ Historique inventaire sauvegardé !");
} catch (err) {
console.log("❌ saveHistory error:", err);
}
};

useEffect(() => {
saveHistory();
}, []);

return (
<View style={styles.container}>
<Text style={styles.text}>Inventaire terminé ✔</Text>

<TouchableOpacity
style={styles.btn}
onPress={() => navigation.navigate("History", { storeId })}
>
<Text style={styles.btnText}>Voir mon historique</Text>
</TouchableOpacity>
</View>
);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0A0617",
justifyContent: "center",
alignItems: "center",
},
text: {
color: "#fff",
fontSize: 22,
marginBottom: 30,
},
btn: {
backgroundColor: "#7b5cff",
paddingHorizontal: 40,
paddingVertical: 15,
borderRadius: 10,
},
btnText: {
color: "#fff",
fontWeight: "700",
fontSize: 18,
},
});
