import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../src/api/api";

type StoreInfo = {
  _id: string;
  storeName: string;
  phone: string;
  city: string;
  hasPassword: boolean;
};

export default function StorePickerScreen({ route, navigation }: any) {
  const { stores, ownerPhone }: { stores: StoreInfo[]; ownerPhone: string } = route.params;
  const { width } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

const handleSelect = async (store: StoreInfo) => {
setSelectedId(store._id);
try {
const { data } = await API.post<{
token: string;
storeId: string;
isOnboarded: boolean;
}>("/auth/owner-select-store", {
phone: ownerPhone,
storeId: store._id,
});
await AsyncStorage.setItem("token", data.token);
await AsyncStorage.setItem("storeId", data.storeId);
await AsyncStorage.setItem(
"isOnboarded",
data.isOnboarded ? "true" : "false"
);
navigation.reset({ index: 0, routes: [{ name: "Entry" }] });
} catch (e: any) {
navigation.navigate("Login", {
preselectedPhone: store.phone,
selectedStoreName: store.storeName,
});
}
};

  return (
    <View style={styles.container}>
      <View style={styles.backgroundGlow} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="storefront" size={28} color="#6C63FF" />
          </View>
          <Text style={styles.title}>Vos boutiques</Text>
          <Text style={styles.subtitle}>
            {ownerPhone}
          </Text>
          <Text style={styles.hint}>
            {stores.length} boutique{stores.length > 1 ? "s" : ""} trouvée{stores.length > 1 ? "s" : ""} — sélectionnez celle à ouvrir
          </Text>
        </Animated.View>

        <View style={styles.list}>
          {stores.map((store, index) => {
            const cardDelay = 100 + index * 80;
            const cardFade = useRef(new Animated.Value(0)).current;
            const cardSlide = useRef(new Animated.Value(30)).current;

            useEffect(() => {
              const timer = setTimeout(() => {
                Animated.parallel([
                  Animated.timing(cardFade, { toValue: 1, duration: 400, useNativeDriver: true }),
                  Animated.timing(cardSlide, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                ]).start();
              }, cardDelay);
              return () => clearTimeout(timer);
            }, []);

            const isSelected = selectedId === store._id;

            return (
              <Animated.View
                key={store._id}
                style={[
                  styles.cardWrapper,
                  { opacity: cardFade, transform: [{ translateY: cardSlide }] },
                ]}
              >
                <TouchableOpacity
                  style={[styles.card, isSelected && styles.cardSelected]}
                  onPress={() => handleSelect(store)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardLeft}>
                    <View style={styles.cardAvatar}>
                      <Text style={styles.cardAvatarText}>
                        {(store.storeName || "B")[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{store.storeName || "Boutique sans nom"}</Text>
                      <Text style={styles.cardPhone}>
                        <Ionicons name="call-outline" size={12} color="#888" /> {store.phone}
                      </Text>
                      <View style={styles.cardMetaRow}>
                        {store.city ? (
                          <View style={styles.metaChip}>
                            <Ionicons name="location-outline" size={11} color="#aaa" />
                            <Text style={styles.metaText}>{store.city}</Text>
                          </View>
                        ) : null}
                        {store.hasPassword ? (
                          <View style={[styles.metaChip, styles.metaChipGreen]}>
                            <Ionicons name="lock-closed-outline" size={11} color="#4ADE80" />
                            <Text style={[styles.metaText, { color: "#4ADE80" }]}>Protégée</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#444" />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back-outline" size={18} color="#6C63FF" />
            <Text style={styles.backBtnText}>Utiliser un autre numéro</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0F14",
  },
  backgroundGlow: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(108,99,255,0.08)",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(108,99,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  hint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  list: {
    gap: 12,
  },
  cardWrapper: {
    marginBottom: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A1A22",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardSelected: {
    borderColor: "#6C63FF",
    backgroundColor: "#1A1A28",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6C63FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardPhone: {
    color: "#888",
    fontSize: 12,
    marginBottom: 6,
  },
  cardMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaChipGreen: {
    backgroundColor: "rgba(74,222,128,0.1)",
  },
  metaText: {
    color: "#aaa",
    fontSize: 11,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    marginTop: 28,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backBtnText: {
    color: "#6C63FF",
    fontSize: 14,
    fontWeight: "600",
  },
});
