import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  TextInput,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const NUM_WAVES = 5;

interface Props {
  visible: boolean;
  listening: boolean;
  analysing: boolean;
  awaitingConfirmation?: boolean;
  transcript?: string | null;
  result?: any;
  resolveAmbiguity?: (product: any) => void;
  voiceConfigured?: boolean;
  onClose: () => void;
  onSubmitText?: (text: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function VoiceOverlay({
  visible,
  listening,
  analysing,
  awaitingConfirmation,
  transcript,
  result,
  resolveAmbiguity,
  voiceConfigured = true,
  onClose,
  onSubmitText,
  onConfirm,
  onCancel,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const waveAnims = useRef(
    Array.from({ length: NUM_WAVES }, () => new Animated.Value(0))
  ).current;
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [manualText, setManualText] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) {
      setShowTextFallback(false);
      setManualText("");
      return;
    }
    if (!voiceConfigured) {
      setShowTextFallback(true);
      setTimeout(() => inputRef.current?.focus(), 400);
      return;
    }
    if (!listening && !analysing) {
      scaleAnim.setValue(1);
      pulseAnim.setValue(0);
      waveAnims.forEach((a) => a.setValue(0));
      return;
    }

    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: listening ? 1.12 : 1.06,
          duration: listening ? 1000 : 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: listening ? 1000 : 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    breathing.start();

    const pulsing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulsing.start();

    if (listening) {
      waveAnims.forEach((anim, i) => {
        const wave = Animated.loop(
          Animated.sequence([
            Animated.delay(i * 180),
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
        wave.start();
        return () => wave.stop();
      });
    } else {
      waveAnims.forEach((a) => a.setValue(0));
    }

    return () => {
      breathing.stop();
      pulsing.stop();
      waveAnims.forEach((a) => a.stopAnimation());
    };
  }, [visible, listening, analysing]);

  const handleManualSubmit = () => {
    if (!manualText.trim()) return;
    const text = manualText.trim();
    setManualText("");
    setShowTextFallback(false);
    onSubmitText?.(text);
    onClose();
  };

  if (!visible) return null;

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  return (
    <View style={styles.overlay}>
      {/* TOP: Close / Stop button */}
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <View style={styles.closeInner}>
          {voiceConfigured && listening ? (
            <>
              <View style={styles.stopSquare} />
              <Text style={styles.stopLabel}>Arrêter</Text>
            </>
          ) : (
            <Ionicons name="close" size={26} color="#fff" />
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.center}>
        {/* GLOWING HALO — only for voice mode */}
        {voiceConfigured && (
          <>
            <Animated.View
              style={[
                styles.glowRing,
                {
                  opacity: pulseOpacity,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.glowRing2,
                {
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.15, 0.4],
                  }),
                  transform: [
                    {
                      scale: scaleAnim.interpolate({
                        inputRange: [1, 1.12],
                        outputRange: [0.85, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          </>
        )}

        {/* WAVE BARS */}
        {listening && voiceConfigured && (
          <View style={styles.waveRow}>
            {waveAnims.map((anim, i) => {
              const scaleY = anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      transform: [{ scaleY }],
                      opacity: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        {/* MIC CIRCLE — only for voice mode */}
        {voiceConfigured && (
          <TouchableOpacity
            onPress={listening || analysing ? onClose : undefined}
            activeOpacity={0.8}
            style={styles.micTouchable}
          >
            <Animated.View
              style={[
                styles.micCircle,
                listening && { backgroundColor: "#E74C6F" },
                analysing && { backgroundColor: "#8A4DFF" },
              ]}
            >
              <Ionicons
                name={analysing ? "sync" : "mic"}
                size={48}
                color="#fff"
              />
            </Animated.View>
          </TouchableOpacity>
        )}

        {/* STATUS TEXT */}
        <Text style={styles.statusText}>
          {!voiceConfigured
            ? "Tapez votre commande"
            : awaitingConfirmation
            ? "Confirme l'action"
            : listening
            ? "Parlez maintenant..."
            : analysing
            ? "Analyse en cours..."
            : "Prêt"}
        </Text>

        {listening && voiceConfigured && !awaitingConfirmation && (
          <Text style={styles.hintText}>
            Dites par exemple : {"\n"}« Vends 3 savons » ou « Ajoute 10 bouteilles »
          </Text>
        )}

        {!voiceConfigured && (
          <Text style={styles.hintText}>
            Exemple : vends 3 savons
          </Text>
        )}

        {/* CONFIRMATION CARD */}
        {awaitingConfirmation && result?.status === "CONFIRM" && (
          <View style={styles.confirmCard}>
            <View style={styles.confirmRow}>
              <Ionicons name="help-circle" size={20} color="#FFD700" />
              <Text style={styles.confirmTitle}>Confirmer</Text>
            </View>
            <Text style={styles.confirmAction}>
              {result.mode === "SALE" ? "Vendre" : result.mode === "STOCK_ADD" ? "Ajouter au stock" : "Retirer du stock"}
            </Text>
            <Text style={styles.confirmProduct}>
              {result.qty} × {result.name}
            </Text>
            <Text style={styles.confirmHint}>
              Dis « Oui » au micro ou confirme ci-dessous
            </Text>
            {/* Confirm / Cancel buttons */}
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.cancelBtn]}
                onPress={() => { onCancel?.(); }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.confirmOkBtn]}
                onPress={() => { onConfirm?.(); }}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Valider</Text>
              </TouchableOpacity>
            </View>
            {/* Text fallback */}
            <View style={styles.confirmTextRow}>
              <TextInput
                ref={inputRef}
                style={styles.confirmTextInput}
                placeholder='ou tape "oui"'
                placeholderTextColor="#666"
                value={manualText}
                onChangeText={setManualText}
                onSubmitEditing={handleManualSubmit}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.confirmTextSubmit, !manualText.trim() && { opacity: 0.5 }]}
                onPress={handleManualSubmit}
                disabled={!manualText.trim()}
              >
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TRANSCRIPT */}
        {transcript && !listening && !awaitingConfirmation && (
          <Text style={styles.transcript}>{transcript}</Text>
        )}

        {/* TEXT FALLBACK — only when not in confirmation */}
        {!awaitingConfirmation && listening && !showTextFallback && (
          <TouchableOpacity
            style={styles.fallbackLink}
            onPress={() => {
              setShowTextFallback(true);
              setTimeout(() => inputRef.current?.focus(), 300);
            }}
          >
            <Ionicons name="keypad-outline" size={16} color="#999" />
            <Text style={styles.fallbackLinkText}>
              Taper la commande
            </Text>
          </TouchableOpacity>
        )}

        {showTextFallback && (
          <View style={styles.fallbackContainer}>
            <TextInput
              ref={inputRef}
              style={styles.fallbackInput}
              placeholder='Ex: vends 3 savons'
              placeholderTextColor="#666"
              value={manualText}
              onChangeText={setManualText}
              onSubmitEditing={handleManualSubmit}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.fallbackSubmit,
                !manualText.trim() && { opacity: 0.5 },
              ]}
              onPress={handleManualSubmit}
              disabled={!manualText.trim()}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* AMBIGUOUS PRODUCTS */}
        {result?.status === "AMBIGUOUS" && (
          <ScrollView
            style={styles.optionsContainer}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <Text style={styles.ambiguousTitle}>
              Plusieurs produits trouvés :
            </Text>
            {result.options.map((product: any) => (
              <TouchableOpacity
                key={product._id}
                style={styles.optionButton}
                onPress={() => resolveAmbiguity?.(product)}
              >
                <Text style={styles.optionText}>{product.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0A0617",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 10,
  },
  closeInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  stopSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: "#E74C6F",
    marginRight: 8,
  },
  stopLabel: {
    color: "#E74C6F",
    fontSize: 15,
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  glowRing: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#8A4DFF",
    opacity: 0.3,
  },
  glowRing2: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#6C3BCC",
    opacity: 0.15,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
    height: 60,
  },
  waveBar: {
    width: 4,
    height: 60,
    backgroundColor: "#B794FF",
    borderRadius: 2,
  },
  micTouchable: {
    marginBottom: 24,
  },
  micCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#8A4DFF",
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  hintText: {
    color: "#888",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  transcript: {
    color: "#BFA6FF",
    marginTop: 14,
    textAlign: "center",
    paddingHorizontal: 40,
    fontSize: 15,
    fontStyle: "italic",
  },
  fallbackLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 6,
  },
  fallbackLinkText: {
    color: "#999",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  fallbackContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    width: "85%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  fallbackInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fallbackSubmit: {
    backgroundColor: "#8A4DFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  optionsContainer: {
    marginTop: 20,
    width: "80%",
    maxHeight: 200,
  },
  ambiguousTitle: {
    color: "#fff",
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
  },
  optionButton: {
    backgroundColor: "#2A204A",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  optionText: {
    color: "#fff",
    fontWeight: "500",
  },
  confirmCard: {
    marginTop: 20,
    width: "85%",
    backgroundColor: "rgba(138,77,255,0.12)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    padding: 20,
    alignItems: "center",
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  confirmTitle: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "700",
  },
  confirmAction: {
    color: "#aaa",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  confirmProduct: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6,
  },
  confirmHint: {
    color: "#999",
    fontSize: 13,
    marginTop: 14,
    marginBottom: 4,
  },
  confirmButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    width: "100%",
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  cancelBtn: {
    backgroundColor: "rgba(231,76,111,0.2)",
    borderWidth: 1,
    borderColor: "rgba(231,76,111,0.4)",
  },
  confirmOkBtn: {
    backgroundColor: "rgba(46,204,113,0.2)",
    borderWidth: 1,
    borderColor: "rgba(46,204,113,0.4)",
  },
  confirmBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  confirmTextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  confirmTextInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmTextSubmit: {
    backgroundColor: "#8A4DFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
