import React, { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, Dimensions, Easing } from "react-native";

const { width } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const vScale = useRef(new Animated.Value(4)).current;
  const vOpacity = useRef(new Animated.Value(0)).current;
  const vGlow = useRef(new Animated.Value(0)).current;
  const titleO = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(12)).current;
  const tagO = useRef(new Animated.Value(0)).current;
  const wrapO = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fallback: si l'animation ne démarre pas, on passe après 4s
    const fallback = setTimeout(() => onFinish(), 4000);

    const anim = Animated.sequence([
      // Étape 1 : Grand V
      Animated.parallel([
        Animated.timing(vOpacity, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.timing(vGlow, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]),
      Animated.delay(300),
      // Étape 2 : V rétrécit
      Animated.parallel([
        Animated.timing(vScale, { toValue: 0.75, duration: 400, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
        Animated.timing(vGlow, { toValue: 0.2, duration: 400, useNativeDriver: false }),
      ]),
      // Étape 3 : Texte
      Animated.parallel([
        Animated.timing(titleO, { toValue: 1, duration: 350, useNativeDriver: false }),
        Animated.timing(titleY, { toValue: 0, duration: 350, easing: Easing.out(Easing.back(1.1)), useNativeDriver: false }),
        Animated.timing(tagO, { toValue: 1, duration: 400, delay: 120, useNativeDriver: false }),
      ]),
      Animated.delay(1200),
      // Étape 4 : Fade out
      Animated.timing(wrapO, { toValue: 0, duration: 500, useNativeDriver: false }),
    ]);

    anim.start(() => {
      clearTimeout(fallback);
      onFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: wrapO }]}>
      <View style={styles.bgBase} />
      <View style={styles.bgTint} />

      {/* Glow du V */}
      <Animated.View
        style={[
          styles.vGlowRing,
          {
            opacity: vGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
            transform: [{ scale: vGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }],
          },
        ]}
      />

      {/* Centre */}
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.vWrap,
            { opacity: vOpacity, transform: [{ scale: vScale }] },
          ]}
        >
          <Text style={styles.vLetter}>V</Text>
        </Animated.View>

        <Animated.Text
          style={[styles.title, { opacity: titleO, transform: [{ translateY: titleY }] }]}
        >
          Vocoshop
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: tagO }]}>
          Gérez. Vendez. Grandissez.
        </Animated.Text>
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInner} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05060F",
    justifyContent: "center",
    alignItems: "center",
  },
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0617",
  },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0A0D2E",
    opacity: 0.3,
  },
  vGlowRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#7C3AED",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
  vWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  vLetter: {
    fontSize: 120,
    fontWeight: "900",
    color: "#C4B5FD",
    letterSpacing: 0,
    lineHeight: 130,
    textShadowColor: "rgba(167,139,250,0.25)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 5,
    marginTop: 4,
  },
  tagline: {
    fontSize: 11,
    color: "#5B5580",
    marginTop: 10,
    letterSpacing: 2,
    fontWeight: "400",
    textTransform: "uppercase",
  },
  bottomBar: {
    position: "absolute",
    bottom: 60,
    width: 100,
    height: 2,
    backgroundColor: "rgba(167,139,250,0.06)",
    borderRadius: 1,
    overflow: "hidden",
  },
  bottomBarInner: {
    width: "60%",
    height: "100%",
    backgroundColor: "rgba(167,139,250,0.15)",
    borderRadius: 1,
  },
});
