import { View, Text, StyleSheet } from "react-native";

export default function SettingsScreen() {
return (
<View style={styles.container}>
<Text style={styles.text}>Paramètres</Text>
</View>
);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: "#0D0B26",
alignItems: "center",
justifyContent: "center",
},
text: {
color: "#FFFFFF",
fontSize: 22,
fontWeight: "700",
},
});
