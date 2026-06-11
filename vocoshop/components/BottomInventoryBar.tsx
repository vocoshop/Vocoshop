// components/BottomInventoryBar.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
onHome: () => void;
onAdd: () => void;
onVoice: () => void;
onHistory: () => void;
};

export default function BottomInventoryBar({
onHome,
onAdd,
onVoice,
onHistory,
}: Props) {
return (
<View style={styles.container}>
{/* Accueil */}
<TouchableOpacity style={styles.item} onPress={onHome}>
<Ionicons name="home-outline" size={22} color="#C9A7FF" />
<Text style={styles.label}>Accueil</Text>
</TouchableOpacity>

{/* Ajouter */}
<TouchableOpacity style={styles.item} onPress={onAdd}>
<Ionicons name="add-circle-outline" size={22} color="#C9A7FF" />
<Text style={styles.label}>Ajouter</Text>
</TouchableOpacity>

{/* Vocal */}
<TouchableOpacity style={styles.item} onPress={onVoice}>
<Ionicons name="mic-outline" size={22} color="#C9A7FF" />
<Text style={styles.label}>Vocal</Text>
</TouchableOpacity>

{/* Historique */}
<TouchableOpacity style={styles.item} onPress={onHistory}>
<Ionicons name="time-outline" size={22} color="#C9A7FF" />
<Text style={styles.label}>Historique</Text>
</TouchableOpacity>
</View>
);
}

const styles = StyleSheet.create({
container: {
height: 85,
backgroundColor: "#0D091A",
flexDirection: "row",
justifyContent: "space-around",
alignItems: "center",
borderTopWidth: 1,
borderTopColor: "rgba(255,255,255,0.06)",

// Petite ombre subtile iOS / pro
shadowColor: "#000",
shadowOpacity: 0.15,
shadowRadius: 6,
shadowOffset: { width: 0, height: -2 },
elevation: 10,
},

item: {
justifyContent: "center",
alignItems: "center",
gap: 4,
},

label: {
color: "#CEC5E8",
fontSize: 12,
},
});
