// screens/MyAgentScreen.tsx
import React, { useCallback, useMemo, useState, useContext } from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
Image,
ActivityIndicator,
Alert,
ScrollView,
Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthContext } from "../src/api/context/AuthContext";
import {
getMyAgent,
initiateCallProxy,
type MyAgentResponse,
} from "../src/api/services/storeService";

export default function MyAgentScreen() {
const navigation = useNavigation<any>();
const { token } = useContext(AuthContext);

const [loading, setLoading] = useState(true);
const [data, setData] = useState<MyAgentResponse | null>(null);

const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
}),
[token]
);

const load = useCallback(async () => {
try {
if (!token) {
setData({ agent: null });
setLoading(false);
return;
}
setLoading(true);
const res = await getMyAgent(headers);
setData(res);
} catch (e: any) {
const errMsg = e?.response?.data?.error || e?.message || "Erreur inconnue";
console.log("MyAgentScreen load:", errMsg);
Alert.alert("Erreur", errMsg);
} finally {
setLoading(false);
}
}, [headers, token]);

useFocusEffect(
useCallback(() => {
load();
}, [load])
);

const agent = data?.agent || null;

const name = useMemo(() => String(agent?.name || "").trim(), [agent]);
const code = useMemo(() => String(agent?.code || "").trim(), [agent]);
const photoUrl = useMemo(() => String(agent?.photoUrl || "").trim(), [agent]);

// affichage masque + contact proxy
const displayPhone = useMemo(() => String(agent?.displayPhone || "—").trim(), [agent]);
const contactPhone = useMemo(() => String(agent?.contactPhone || "").trim(), [agent]);

const openCall = async () => {
if (!contactPhone || !agent) return;
try {
await initiateCallProxy(headers, agent.code);
const telUrl = `tel:${contactPhone}`;
const canCall = await Linking.canOpenURL(telUrl);
if (canCall) Linking.openURL(telUrl);
else Alert.alert("Erreur", "Appel indisponible sur cet appareil.");
} catch {
Alert.alert("Erreur", "Impossible de lancer l'appel.");
}
};

const canContact = !!agent && !!contactPhone;

return (
<SafeAreaView style={styles.safe}>
<View style={styles.container}>
{/* ===== HEADER FIXE ===== */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Mon agent</Text>

<TouchableOpacity onPress={load} activeOpacity={0.8}>
<Ionicons name="refresh" size={20} color="#fff" />
</TouchableOpacity>
</View>

<ScrollView
contentContainerStyle={{
paddingBottom: 120,
}}
>
{loading ? (
<View style={styles.center}>
<ActivityIndicator size="large" color="#B794F4" />
<Text style={styles.muted}>Chargement...</Text>
</View>
) : !agent ? (
<View style={styles.card}>
<Text style={styles.cardTitle}>Aucune information agent</Text>
<Text style={styles.muted}>
Astuce : lors de l'onboarding, renseigne un code agent valide pour lier la boutique.
</Text>

<TouchableOpacity onPress={load} style={[styles.btn, { marginTop: 16 }]} activeOpacity={0.85}>
<Text style={styles.btnText}>Rafraichir</Text>
</TouchableOpacity>
</View>
) : (
<View style={styles.card}>
<View style={styles.row}>
<View style={styles.avatar}>
{photoUrl ? (
<Image source={{ uri: photoUrl }} style={styles.avatarImg} />
) : (
<Text style={styles.avatarTxt}>{name ? name.slice(0, 1).toUpperCase() : "A"}</Text>
)}
</View>

<View style={{ flex: 1 }}>
<Text style={styles.name}>{name || "Agent Vocoshop"}</Text>
<Text style={styles.meta}>Code agent : {code || "—"}</Text>
<Text style={styles.meta}>Telephone : {displayPhone || "—"}</Text>

{!agent.isActive && <Text style={styles.badgeDanger}>Agent indisponible</Text>}
</View>
</View>

<Text style={styles.note}>
Pour proteger l'agent et permettre le controle qualite, les contacts passent par un numero Vocoshop.
</Text>
</View>
    )}
    </ScrollView>

    {/* ===== FOOTER STICKY ===== */}
    {agent && (
    <View style={styles.footer}>
          <TouchableOpacity
              onPress={openCall}
              disabled={!canContact}
              style={[
                styles.btn,
                styles.footerBtn,
                !canContact && { opacity: 0.6 },
              ]}
              activeOpacity={0.9}
            >
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.btnText}>Contacter mon agent</Text>
            </TouchableOpacity>
    </View>
    )}

    </View>
    </SafeAreaView>
);
}

const styles = StyleSheet.create({
safe: { flex: 1, backgroundColor: "#0A0617" },
container: { flex: 1, backgroundColor: "#0A0617" },

header: {
paddingTop: 14,
paddingHorizontal: 20,
paddingBottom: 16,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},
headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },

center: { paddingTop: 50, alignItems: "center", justifyContent: "center" },
muted: { color: "#A8A3C2", marginTop: 10, fontSize: 13 },

card: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginTop: 12,
padding: 16,
borderRadius: 18,
},
cardTitle: { color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 6 },

row: { flexDirection: "row", alignItems: "center", gap: 14 },
avatar: {
width: 58,
height: 58,
borderRadius: 29,
backgroundColor: "#5B3DF5",
alignItems: "center",
justifyContent: "center",
overflow: "hidden",
},
avatarImg: { width: 58, height: 58 },
avatarTxt: { color: "#fff", fontWeight: "900", fontSize: 20 },

name: { color: "#fff", fontWeight: "800", fontSize: 16, marginBottom: 4 },
meta: { color: "#A8A3C2", fontSize: 13, marginTop: 2 },

note: {
marginTop: 14,
color: "#8E88AA",
fontSize: 12,
lineHeight: 16,
},

badgeDanger: {
marginTop: 8,
alignSelf: "flex-start",
backgroundColor: "rgba(255,107,107,0.15)",
color: "#FF6B6B",
fontSize: 11,
fontWeight: "800",
paddingHorizontal: 10,
paddingVertical: 4,
borderRadius: 8,
},

btn: {
height: 48,
borderRadius: 12,
alignItems: "center",
justifyContent: "center",
backgroundColor: "#2A2448",
flexDirection: "row",
gap: 10,
},
btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

footer: {
position: "absolute",
left: 20,
right: 20,
bottom: 18,
},
footerBtn: {
backgroundColor: "#5B3DF5",
},
});
