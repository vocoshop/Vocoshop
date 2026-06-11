import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../src/api/context/LanguageContext";

interface Props {
  subscription: any;
  showSubBanner: boolean;
  slideAnim: Animated.Value;
  navigation: any;
}

export default function SubBanner({ subscription, showSubBanner, slideAnim, navigation }: Props) {
  const { t } = useLanguage();
  if (!showSubBanner) return null;

  const subStatus = subscription?.subscriptionStatus || subscription?.status || null;

  const getDaysLeft = () => {
    const installedAt = subscription?.installedAt;
    if (!installedAt) return null;
    const start = new Date(installedAt);
    const now = new Date();
    const diff = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const left = 30 - Math.floor(diff);
    return left > 0 ? left : 0;
  };

  const getGraceDaysLeft = () => {
    const graceUntil = subscription?.graceUntil;
    if (!graceUntil) return null;
    const now = new Date();
    const end = new Date(graceUntil);
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
  };

  const trialDaysLeft = getDaysLeft();
  const trialDaysLeftSafe = trialDaysLeft ?? 0;
  const graceDaysLeftSafe = getGraceDaysLeft() ?? 0;

  let bannerText = "";
  let bannerColor = "#2A204A";
  let showButton = false;
  let iconName = "time-outline";

  if (!subStatus || subStatus === "trial") {
    if (trialDaysLeftSafe > 0) {
      bannerText = t("sub.banner.trial_ending", { n: trialDaysLeftSafe });
      iconName = "sparkles-outline";
      showButton = trialDaysLeftSafe <= 5;
    } else {
      bannerText = t("sub.banner.trial_ended");
      bannerColor = "#3A1B1B";
      iconName = "time-outline";
      showButton = true;
    }
  } else if (subStatus === "grace") {
    if (graceDaysLeftSafe > 0) {
      bannerText = t("sub.banner.grace", { n: graceDaysLeftSafe });
      bannerColor = "#3A1B1B";
      iconName = "alert-circle-outline";
      showButton = true;
    } else {
      bannerText = t("sub.banner.suspended");
      bannerColor = "#3A1B1B";
      iconName = "close-circle-outline";
      showButton = true;
    }
  } else if (subStatus === "expired" || subStatus === "blocked") {
    bannerText = t("sub.banner.expired");
    bannerColor = "#3A1B1B";
    iconName = "close-circle-outline";
    showButton = true;
  } else if (subStatus === "active" || subStatus === "trial_extended") {
    return null;
  }

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], position: "absolute", top: 110, left: 20, right: 20, zIndex: 10 }}>
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: bannerColor }]}
        onPress={() => navigation.navigate("SubscriptionPay")}
        activeOpacity={0.85}
      >
        <Ionicons name={iconName as any} size={20} color="#BFA6FF" style={{ marginBottom: 6 }} />
        <Text style={styles.text}>{bannerText}</Text>
        {showButton && (
          <TouchableOpacity onPress={() => navigation.navigate("SubscriptionPay")} style={{ marginTop: 6 }}>
            <Text style={styles.link}>{t("sub.banner.button")}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 12, borderRadius: 14 },
  text: { color: "#fff", fontWeight: "600" },
  link: { color: "#BFA6FF", fontWeight: "700" },
});
