import React, { useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";

export default function VoiceToast({ visible, message, type }: any) {
const opacity = new Animated.Value(0);

useEffect(() => {
if (!visible) return;

Animated.sequence([
Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
Animated.delay(1800),
Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
]).start();
}, [visible]);

if (!visible) return null;

const bg =
type === "success"
? "#22C55E"
: type === "warning"
? "#F59E0B"
: "#6B7280";

return (
<Animated.View style={[styles.container, { opacity, backgroundColor: bg }]}>
<Text style={styles.text}>{message}</Text>
</Animated.View>
);
}

const styles = StyleSheet.create({
container: {
position: "absolute",
bottom: 100,
alignSelf: "center",
paddingHorizontal: 20,
paddingVertical: 12,
borderRadius: 12,
},
text: {
color: "#fff",
fontWeight: "700",
},
});
