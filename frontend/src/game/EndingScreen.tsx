import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatCurrency, formatNumber, formatTimeDetailed } from "@/src/utils/format";
import { SafeAreaView } from "react-native-safe-area-context";
import { HoldButton } from "@/src/components/HoldButton";
import { Image as ExpoImage } from "expo-image";

const { width, height } = Dimensions.get("window");

export type CompletionStats = {
  balance: number;
  totalPrestiges: number;
  totalPPEarned: number;
  investmentsCompleted: number;
  upgradesPurchased: number;
  accelerateUses: number;
  activePlayTimeMs: number;
  highestBalance: number;
  totalMoneyEarned: number;
  legacyUpgradesOwned: number;
  completedAt: number;
};

const C = {
  bg: "#0F172A",
  card: "#1E293B",
  accent: "#F59E0B",
  accentDeep: "#F59E0B",
  success: "#00C896",
  white: "#FFFFFF",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  border: "#334155",
};

export function EndingScreen({
  stats,
  onReplay,
  onContinue,
}: {
  stats: CompletionStats;
  onReplay: () => void;
  onContinue: () => void;
}) {
  const iconScale = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(12)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(16)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.95)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
      Animated.timing(iconOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 300);

    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(statsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(statsSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 600);

    const t3 = setTimeout(() => {
      Animated.parallel([
        Animated.spring(buttonScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
        Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 1100);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const statRows: [string, string][] = [
    ["Final Balance", formatCurrency(stats.balance)],
    ["Highest Balance", formatCurrency(stats.highestBalance)],
    ["Total Money Earned", formatCurrency(stats.totalMoneyEarned)],
    ["Total Prestige Points", formatNumber(stats.totalPPEarned)],
    ["Times Prestiged", formatNumber(stats.totalPrestiges)],
    ["Investments Completed", formatNumber(stats.investmentsCompleted)],
    ["Upgrades Purchased", formatNumber(stats.upgradesPurchased)],
    ["Accelerate Uses", formatNumber(stats.accelerateUses)],
    ["Legacy Upgrades", `${stats.legacyUpgradesOwned} / 7`],
    ["Total Play Time", formatTimeDetailed(stats.activePlayTimeMs)],
  ];

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.97, friction: 8, tension: 100, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <SafeAreaView style={EndingStyles.root} edges={["top", "bottom"]}>
      <View style={EndingStyles.root}>
        <LinearGradient colors={[C.bg, "#1E293B", C.bg]} style={EndingStyles.gradient} />
        <ScrollView
          style={EndingStyles.scrollView}
          contentContainerStyle={EndingStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={EndingStyles.content}>
            <Animated.View style={[EndingStyles.titleWrap, { opacity: iconOpacity }]}>
              <Animated.View
                style={[
                  EndingStyles.iconContainer,
                  {
                    opacity: iconOpacity,
                    transform: [{ scale: iconScale }],
                  },
                ]}
              >
                <Text style={EndingStyles.icon}>✓</Text>
              </Animated.View>
            </Animated.View>

            <Animated.View
              style={[
                EndingStyles.titleSection,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleSlide }],
                },
              ]}
            >
              <ExpoImage
                source={require("@/assets/images/p2p-logo.png")}
                style={EndingStyles.endingLogo}
                contentFit="contain"
              />
              <Text style={EndingStyles.eyebrow}>GAME COMPLETE</Text>
              <Text style={EndingStyles.title}>Portfolio Mastered</Text>
              <Text style={EndingStyles.subtitle}>
                You've completed the investment journey.{"\n"}
                Your final portfolio stands as a testament to your strategy.
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                EndingStyles.statsCard,
                {
                  opacity: statsOpacity,
                  transform: [{ translateY: statsSlide }],
                },
              ]}
            >
              <Text style={EndingStyles.statsHeader}>FINAL STATISTICS</Text>
              {statRows.map(([label, value]) => (
                <View key={label} style={EndingStyles.statRow}>
                  <Text style={EndingStyles.statLabel}>{label}</Text>
                  <Text style={EndingStyles.statValue}>{value}</Text>
                </View>
              ))}
            </Animated.View>

            <Animated.View
              style={[
                EndingStyles.buttonContainer,
                {
                  opacity: buttonOpacity,
                  transform: [{ scale: Animated.multiply(buttonScale, pressScale) }],
                },
              ]}
            >
              {/* Continue Current Run - Safe Option */}
              <Pressable
                onPress={onContinue}
                style={({ pressed }) => [
                  EndingStyles.continueBtn,
                  pressed && EndingStyles.continueBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue current run"
              >
                <LinearGradient
                  colors={["#00C896", "#22C55E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={EndingStyles.continueBtnGradient}
                >
                  <Text style={EndingStyles.continueBtnText}>CONTINUE CURRENT RUN</Text>
                </LinearGradient>
              </Pressable>
              
              <Text style={EndingStyles.buttonDivider}>OR</Text>
              
              {/* Restart Run - Destructive Hold Button */}
              <HoldButton
                onHoldComplete={onReplay}
                colors={["#DC2626", "#EF4444"]}
                textColor="#FFFFFF"
                progressColor="#FFFFFF"
                style={EndingStyles.restartBtn}
              >
                RESTART RUN
              </HoldButton>
              
              <Text style={EndingStyles.replayHint}>
                Restart will reset all progress. Your completion record is saved.
              </Text>
              
              {/* Official P2P Branding */}
              <View style={EndingStyles.brandingContainer}>
                <Text style={EndingStyles.poweredBy}>Powered by P2P</Text>
                <Text style={EndingStyles.website}>p2p.com.mk</Text>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const EndingStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  gradient: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
    minHeight: "100%",
  },
  content: {
    alignItems: "center",
    maxWidth: 440,
    width: "100%",
  },
  titleWrap: { alignItems: "center", marginBottom: 24 },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.success,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.success,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  icon: { fontSize: 36, fontWeight: "700", color: "#FFFFFF" },
  titleSection: { alignItems: "center", marginBottom: 32 },
  endingLogo: {
    width: 80,
    height: 80,
    marginBottom: 16,
    opacity: 0.9,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 2.5,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: C.textMuted,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  statsCard: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 28,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statsHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 18,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statLabel: { fontSize: 14, color: C.textMuted, fontWeight: "500" },
  statValue: { fontSize: 15, color: C.accent, fontWeight: "600" },
  buttonContainer: {
    alignItems: "center",
    width: "100%",
    paddingBottom: 40,
    paddingTop: 16,
  },
  continueBtn: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 14,
    minWidth: 200,
    marginBottom: 16,
  },
  continueBtnPressed: {
    transform: [{ scale: 0.97 }],
  },
  continueBtnGradient: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: "center",
    borderRadius: 14,
    minWidth: 200,
  },
  continueBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: 1 },
  buttonDivider: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    marginVertical: 12,
    letterSpacing: 2,
  },
  restartBtn: {
    marginBottom: 16,
  },
  replayBtnGradient: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: "center",
    borderRadius: 14,
    minWidth: 200,
  },
  replayBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: 1 },
  replayHint: { fontSize: 12, color: C.textMuted, marginTop: 16, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
  brandingContainer: {
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  poweredBy: {
    fontSize: 12,
    fontWeight: "600",
    color: C.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  website: {
    fontSize: 14,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.5,
  },
});
