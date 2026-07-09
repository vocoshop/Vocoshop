// screens/ProfileScreen.tsx
import React, {
useEffect,
useState,
useMemo,
useCallback,
useContext,
} from "react";
import {
View,
Text,
StyleSheet,
TouchableOpacity,
ScrollView,
Share,
Alert,
Modal,
TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "../src/api/context/LanguageContext";

import { AuthContext } from "../src/api/context/AuthContext";
import { getMyStoreProfile, updateStoreOnboarding } from "../src/api/services/storeService";
import { useSubscription } from "../src/api/context/SubscriptionContext";
import API from "../src/api/api";
import { useNotifications } from "../src/api/context/NotificationContext";

const NOTIF_KEY = "vocos_notif_enabled";

export default function ProfileScreen() {
const navigation = useNavigation<any>();
const { token, logout, user } = useContext(AuthContext);
const { subscription } = useSubscription();
const { unreadCount } = useNotifications();

// ✅ Toggle notifications (UI + persist)
const [notifEnabled, setNotifEnabled] = useState<boolean>(true);

// ✅ Données boutique (branchées backend)
const [shopName, setShopName] = useState("—");
const [phone, setPhone] = useState("—");
const [shopId, setShopId] = useState("—");
const [plan, setPlan] = useState("Essai gratuit");
const [referralCode, setReferralCode] = useState("—");
const [referredCount, setReferredCount] = useState(0);
const [paidReferrals, setPaidReferrals] = useState(0);
const [city, setCity] = useState("—");
const [agentCode, setAgentCode] = useState("—");
const [storeOwnerPhone, setStoreOwnerPhone] = useState("");
const [isOnboarded, setIsOnboarded] = useState<boolean>(true);
const [ownerPhoneModal, setOwnerPhoneModal] = useState(false);
const [ownerPhoneInput, setOwnerPhoneInput] = useState("");

// ✅ Owner/admin only
const isOwner = useMemo(() => {
const role = String(user?.role || "");
return role === "owner" || role === "admin";
}, [user]);

// ✅ headers SAFE : uniquement token
const headers = useMemo(
() => ({
Authorization: token ? `Bearer ${token}` : "",
}),
[token]
);

// ✅ Load profile store
const loadStoreProfile = useCallback(async () => {
try {
if (!token) return;

// ✅ Employé: ne charge pas /store/me
if (!isOwner) {
setShopName("—");
setPhone("—");
setShopId("—");
setPlan("—");
setReferralCode("—");
setReferredCount(0);
setCity("—");
setAgentCode("—");
setIsOnboarded(true);
return;
}

const data = await getMyStoreProfile(headers);

setShopName(data?.shopName ?? "—");
setPhone(data?.phone ?? "—");
setShopId(data?.shopId ?? "—");
setPlan(data?.plan ?? "Essai gratuit");
setReferralCode(data?.referralCode ?? data?.shopId ?? "—");
setReferredCount(Number(data?.referredCount ?? 0));
setCity(data?.city?.trim() ? data.city : "—");
setAgentCode(data?.agentCode?.trim() ? data.agentCode : "—");
setStoreOwnerPhone(data?.ownerPhone || "");
setPaidReferrals(Number(data?.paidReferrals ?? 0));
setIsOnboarded(Boolean(data?.isOnboarded));
} catch (err: any) {
console.log(
"❌ /store/me error =",
err?.response?.status,
err?.response?.data || err
);
}
}, [headers, token, isOwner]);

// ✅ Charger l’état notif (persisté)
useEffect(() => {
(async () => {
try {
const saved = await AsyncStorage.getItem(NOTIF_KEY);
if (saved === "0") setNotifEnabled(false);
if (saved === "1") setNotifEnabled(true);
} catch (e) {}
})();
}, []);

// ✅ Charger profil boutique
useFocusEffect(
useCallback(() => {
loadStoreProfile();
}, [loadStoreProfile])
);

const toggleNotif = async () => {
try {
const next = !notifEnabled;
setNotifEnabled(next);
await AsyncStorage.setItem(NOTIF_KEY, next ? "1" : "0");
} catch (e) {}
};

const onShareCode = async () => {
try {
await Share.share({
message: `Rejoins Vocoshop avec mon code de parrainage : ${referralCode}`,
});
} catch (e) {}
};

const onLogout = useCallback(() => {
  (async () => {
    try {
      const { data } = await API.get<{ multipleStores: boolean }>("/auth/owner-stores");
      if (data.multipleStores) {
        Alert.alert(
          "Se déconnecter",
          "Tu possèdes plusieurs boutiques. Que veux-tu faire ?",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Changer de profil",
              onPress: async () => {
                await logout();
                navigation.reset({
                  index: 0,
                  routes: [
                    {
                      name: "Login",
                      params: {
                        preselectedPhone: user?.phone,
                        selectedStoreName: "Sélectionne une boutique",
                      },
                    },
                  ],
                });
              },
            },
            {
              text: "Se déconnecter",
              style: "destructive",
              onPress: async () => {
                await logout();
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Login" }],
                });
              },
            },
          ]
        );
        return;
      }
    } catch (_) {}
    // Fallback simple
    Alert.alert("Se déconnecter", "Es-tu sûr de vouloir te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } finally {
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          }
        },
      },
    ]);
  })();
}, [logout, navigation, user?.phone]);

const initials = useMemo(() => {

const v = (shopName || "MB").trim();
const parts = v.split(" ").filter(Boolean).slice(0, 2);
const ini = parts.map((w) => w[0]?.toUpperCase()).join("");
return ini || "MB";
}, [shopName]);

const saveOwnerPhone = useCallback(async () => {
const v = ownerPhoneInput.trim();
if (!v) return;
try {
const h = { Authorization: token ? `Bearer ${token}` : "" };
await updateStoreOnboarding({ storeName: shopName, ownerPhone: v }, h);
setStoreOwnerPhone(v);
setOwnerPhoneModal(false);
Alert.alert("Enregistré", "Numéro du propriétaire mis à jour.");
} catch (e: any) {
Alert.alert("Erreur", e?.response?.data?.error || "Impossible d'enregistrer.");
}
}, [ownerPhoneInput, token, shopName]);

return (
<View style={styles.container}>
{/* ===== HEADER FIXE ===== */}
<View style={styles.header}>
<TouchableOpacity onPress={() => navigation.goBack()}>
<Ionicons name="chevron-back" size={26} color="#fff" />
</TouchableOpacity>

<Text style={styles.headerTitle}>Profil</Text>

<TouchableOpacity
onPress={() => navigation.navigate("Notifications")}
activeOpacity={0.75}
style={{ padding:6 }}
>

<View style={{ position:"relative" }}>

<Ionicons
name={
notifEnabled
? "notifications-outline"
: "notifications-off-outline"
}
size={22}
color="#fff"
/>

{/* 🔴 BADGE PRO */}
{unreadCount > 0 && (
<View
style={{
position:"absolute",
right:-6,
top:-6,
backgroundColor:"#FF3B30",
borderRadius:10,
minWidth:18,
height:18,
paddingHorizontal:4,
alignItems:"center",
justifyContent:"center"
}}
>
<Text
style={{
color:"#fff",
fontSize:10,
fontWeight:"900"
}}
>
{unreadCount > 99 ? "99+" : unreadCount}
</Text>
</View>
)}

</View>

</TouchableOpacity>
</View>

{/* ===== BLOC PROFIL FIXE (NE SCROLL PAS) ===== */}
{isOwner && (
<View style={styles.fixedTop}>
<View style={styles.shopCard}>
<View style={styles.shopLeft}>
<View style={styles.avatar}>
<Text style={styles.avatarText}>{initials}</Text>
</View>

<View style={{ flex: 1 }}>
<Text style={styles.shopName}>
{shopName || "NOM COMMERCIAL"}
</Text>

{!isOnboarded && (
<Text style={styles.shopBadge}>Profil incomplet</Text>
)}

<Text style={styles.shopMeta}>Téléphone : {phone}</Text>
<Text style={styles.shopMeta}>ID Boutique : {shopId}</Text>
<Text style={styles.shopMeta}>Plan : {plan}</Text>
<Text style={styles.shopMeta}>Ville : {city}</Text>
<Text style={styles.shopMeta}>Code agent : {agentCode}</Text>
</View>
</View>

<TouchableOpacity
style={styles.addStoreBtn}
onPress={() =>
Alert.alert(
"Créer une boutique",
"Souhaites-tu créer un nouveau compte ?",
[
{ text: "Non", style: "cancel" },
{
text: "Oui",
onPress: () =>
navigation.navigate("Onboarding", {
phone,
ownerPhone: storeOwnerPhone,
}),
},
]
)
}
activeOpacity={0.7}
>
<Ionicons name="add" size={20} color="#fff" />
</TouchableOpacity>
</View>

{/* petite séparation propre */}
<View style={styles.divider} />
</View>
)}

{/* ===== CONTENU DÉFILANT (LE RESTE) ===== */}
<ScrollView
contentContainerStyle={styles.scrollContent}
showsVerticalScrollIndicator={false}
>
{/* ===== PARRAINAGE (OWNER ONLY) ===== */}
{isOwner && (
<View style={styles.referralCard}>
<View style={styles.referralHeader}>
<Ionicons name="gift-outline" size={20} color="#FACC15" />
<Text style={styles.referralTitle}>Parrainage</Text>
</View>

<Text style={styles.referralText}>
Parrainez 3 boutiques et gagnez 1 mois gratuit (après leur 1er abonnement).
</Text>

{/* =====================================================
🔥 REFERRAL SAFE BLOCK — V8 STABLE
===================================================== */}
{(() => {

const referredCountSafe = Number(referredCount || 0);

/**
🔥 LOGIQUE CYCLE BONUS ULTRA PRO
- referredCount = total à vie
- cycleProgress = progression actuelle
- bonusEarned = nombre de bonus gagnés
*/
const cycleProgress = referredCountSafe % 3;
const bonusEarned = Math.floor(referredCountSafe / 3);
const isReferralBonus = bonusEarned > 0;

const progressWidth =
`${Math.min(100, (cycleProgress / 3) * 100)}%`;

const remaining = Math.max(0, 3 - cycleProgress);

return (
<>

{isReferralBonus && (
<View
style={{
backgroundColor:"#221A3A",
padding:12,
borderRadius:12,
marginTop:12
}}
>
<Text style={{ color:"#BFA6FF", fontWeight:"700" }}>
🎁 {bonusEarned} mois gratuit{bonusEarned > 1 ? "s" : ""} débloqué{bonusEarned > 1 ? "s" : ""} grâce à vos parrainages !
</Text>
</View>
)}

<Text style={styles.referralMini}>
{cycleProgress === 0 && referredCountSafe > 0
? "Objectif atteint 🎉"
: `Plus que ${remaining} boutique(s) pour débloquer 1 mois gratuit.`}
</Text>

<View style={styles.progressContainer}>
<View style={styles.progressBackground}>
<View
style={[
styles.progressFill,
{ width: progressWidth as any }
]}
/>
</View>

<Text style={styles.progressText}>
{cycleProgress}/3 boutiques parrainées
</Text>
</View>

<View style={styles.referralInfoRow}>
<TouchableOpacity
style={styles.referralInfoCol}
activeOpacity={0.85}
onPress={async () => {
try {
await Share.share({ message: referralCode });
} catch {}
}}
>
<Text style={styles.referralInfoLabel}>Mon code</Text>
<Text style={styles.referralInfoValue}>{referralCode}</Text>
<Text style={styles.referralHint}>Appuie pour copier</Text>
</TouchableOpacity>

<View style={styles.referralInfoColRight}>
<Text style={styles.referralInfoLabel}>
Boutiques parrainées
</Text>
<Text style={styles.referralInfoValue}>
{cycleProgress}/3
</Text>
</View>
</View>

<TouchableOpacity
style={styles.referralButton}
onPress={onShareCode}
>
<Ionicons name="share-social-outline" size={18} color="#C6C0DD" />
<Text style={styles.referralButtonText}>
Partager mon code
</Text>
</TouchableOpacity>

</>
);

})()}

</View>
)}

{/* ===== MON COMPTE ===== */}
<Text style={styles.sectionTitle}>Mon compte</Text>

<ProfileItem
icon="person-outline"
title="Informations personnelles"
subtitle="Modifier vos infos"
onPress={() => navigation.navigate("PersonalInfo")}
/>

{isOwner && (
<ProfileItem
icon="phone-portrait-outline"
title="Téléphone du propriétaire"
subtitle={storeOwnerPhone || "Non défini — appuie pour définir"}
onPress={() => {
setOwnerPhoneInput(storeOwnerPhone || "");
setOwnerPhoneModal(true);
}}
/>
)}

{isOwner && (
<>
<ProfileItem
icon="bar-chart-outline"
title="Ma boutique"
subtitle="Performances & stats simples"
onPress={() => navigation.navigate("MyShop")}
/>

<ProfileItem
icon="settings-outline"
title="Gérer ma boutique"
subtitle="Employés, inventaire, actions"
onPress={() => navigation.navigate("ManageShop")}
/>

<ProfileItem
icon="call-outline"
title="Mon agent"
subtitle="Contacter votre agent Vocoshop"
onPress={() => navigation.navigate("MyAgent")}
/>

<ProfileItem
icon="card-outline"
title="Mon abonnement"
subtitle="Essai, statut, paiement"
onPress={() => navigation.navigate("Subscription")}
/>

<ProfileItem
icon="rocket-outline"
title="Financement & Opportunités"
subtitle="Développez votre activité grâce à vos données"
onPress={() => navigation.navigate("Funding")}
/>
</>
)}

{/* ===== DÉCONNEXION ===== */}
<TouchableOpacity
style={styles.logoutButton}
onPress={onLogout}
activeOpacity={0.85}
>
<Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
<Text style={styles.logoutText}>Se déconnecter</Text>
</TouchableOpacity>
</ScrollView>

<Modal visible={ownerPhoneModal} transparent animationType="fade">
<View style={styles.modalOverlay}>
<View style={styles.modalContent}>
<Text style={styles.modalTitle}>Propriétaire</Text>
<Text style={styles.modalSubtitle}>
Numéro du boss (celui qui lie les boutiques)
</Text>
<TextInput
style={styles.modalInput}
value={ownerPhoneInput}
onChangeText={setOwnerPhoneInput}
placeholder="+242 06 123 45 67"
placeholderTextColor="rgba(255,255,255,0.35)"
keyboardType="phone-pad"
autoFocus
/>
<View style={styles.modalButtons}>
<TouchableOpacity
style={styles.modalBtnCancel}
onPress={() => setOwnerPhoneModal(false)}
>
<Text style={styles.modalBtnCancelText}>Annuler</Text>
</TouchableOpacity>
<TouchableOpacity
style={styles.modalBtnSave}
onPress={saveOwnerPhone}
>
<Text style={styles.modalBtnSaveText}>Enregistrer</Text>
</TouchableOpacity>
</View>
</View>
</View>
</Modal>
</View>
);
}

/* ===== ITEM ===== */
function ProfileItem({ icon, title, subtitle, onPress }: any) {
return (
<TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={onPress}>
<View style={styles.itemLeft}>
<Ionicons name={icon} size={22} color="#B794F4" />
<View>
<Text style={styles.itemTitle}>{title}</Text>
<Text style={styles.itemSubtitle}>{subtitle}</Text>
</View>
</View>
<Ionicons name="chevron-forward" size={18} color="#666" />
</TouchableOpacity>
);
}

/* ===== STYLES ===== */
const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0A0617" },

header: {
paddingTop: 60,
paddingHorizontal: 20,
paddingBottom: 16,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
backgroundColor: "#0A0617",
zIndex: 10,
},

headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },

// ✅ bloc fixe sous le header
fixedTop: {
paddingBottom: 8,
backgroundColor: "#0A0617",
zIndex: 9,
},

divider: {
height: 1,
backgroundColor: "rgba(255,255,255,0.06)",
marginHorizontal: 20,
marginBottom: 8,
},

scrollContent: {
paddingBottom: 140,
paddingTop: 8,
},

shopCard: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginBottom: 8,
padding: 16,
borderRadius: 18,
flexDirection: "row",
alignItems: "center",
position: "relative",
},

shopLeft: { flexDirection: "row", alignItems: "center", gap: 14 },

avatar: {
width: 52,
height: 52,
borderRadius: 26,
backgroundColor: "#5B3DF5",
alignItems: "center",
justifyContent: "center",
},

avatarText: { color: "#fff", fontWeight: "900", fontSize: 18 },

shopName: { color: "#fff", fontWeight: "700", fontSize: 16 },

shopMeta: { color: "#A8A3C2", fontSize: 12, marginTop: 2 },

shopBadge: {
marginTop: 4,
alignSelf: "flex-start",
backgroundColor: "rgba(255,107,107,0.15)",
color: "#FF6B6B",
fontSize: 11,
fontWeight: "700",
paddingHorizontal: 8,
paddingVertical: 3,
borderRadius: 6,
},

referralCard: {
backgroundColor: "#1E1838",
marginHorizontal: 20,
marginBottom: 20,
padding: 16,
borderRadius: 18,
},

referralHeader: {
flexDirection: "row",
alignItems: "center",
gap: 8,
marginBottom: 8,
},

referralTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },

referralText: { color: "#C6C0DD", fontSize: 13, marginBottom: 12 },

referralInfoRow: {
flexDirection: "row",
justifyContent: "space-between",
marginBottom: 14,
},

referralInfoCol: { flex: 1 },

referralInfoColRight: { flex: 1, alignItems: "flex-end" },

referralInfoLabel: { color: "#A8A3C2", fontSize: 12, marginBottom: 4 },

referralInfoValue: { color: "#fff", fontWeight: "800", fontSize: 16 },

referralButton: {
backgroundColor: "#2A2448",
padding: 12,
borderRadius: 12,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 10,
},

referralButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },

referralMini: {
color: "#9AF5C7",
fontSize: 12,
marginBottom: 10,
fontWeight: "600",
},

referralHint: { color: "#A8A3C2", fontSize: 11, marginTop: 2 },

progressContainer: { width: "100%", marginBottom: 14 },

progressBackground: {
height: 8,
width: "100%",
backgroundColor: "rgba(255,255,255,0.12)",
borderRadius: 6,
overflow: "hidden",
},

progressFill: { height: "100%", backgroundColor: "#9AF5C7", borderRadius: 6 },

progressText: {
marginTop: 6,
fontSize: 11,
color: "#A8A3C2",
textAlign: "right",
},

sectionTitle: {
color: "#C6C0DD",
fontSize: 14,
fontWeight: "700",
marginHorizontal: 20,
marginBottom: 10,
},

item: {
backgroundColor: "#18122B",
marginHorizontal: 20,
marginBottom: 12,
padding: 14,
borderRadius: 14,
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
},

itemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },

itemTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },

itemSubtitle: { color: "#A8A3C2", fontSize: 12, marginTop: 2 },

logoutButton: {
marginTop: 20,
marginHorizontal: 20,
padding: 14,
borderRadius: 14,
backgroundColor: "#241C39",
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: 8,
},

logoutText: { color: "#FF6B6B", fontWeight: "700" },

addStoreBtn: {
width: 36,
height: 36,
borderRadius: 18,
backgroundColor: "#5B3DF5",
alignItems: "center",
justifyContent: "center",
position: "absolute",
top: 12,
right: 12,
},

modalOverlay: {
flex: 1,
backgroundColor: "rgba(0,0,0,0.7)",
justifyContent: "center",
alignItems: "center",
},
modalContent: {
backgroundColor: "#18122B",
marginHorizontal: 40,
padding: 24,
borderRadius: 18,
width: "85%",
},
modalTitle: { color: "#fff", fontWeight: "900", fontSize: 18, marginBottom: 4 },
modalSubtitle: { color: "#A8A3C2", fontSize: 13, marginBottom: 16 },
modalInput: {
backgroundColor: "#241C39",
color: "#fff",
fontSize: 16,
padding: 14,
borderRadius: 12,
marginBottom: 20,
},
modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16 },
modalBtnCancelText: { color: "#A8A3C2", fontWeight: "600" },
modalBtnSave: {
backgroundColor: "#5B3DF5",
paddingVertical: 10,
paddingHorizontal: 20,
borderRadius: 10,
},
modalBtnSaveText: { color: "#fff", fontWeight: "700" },
});
