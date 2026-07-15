import React, { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatCurrency, formatNumber, formatTimeDetailed } from "@/src/utils/format";
import { SafeAreaView } from "react-native-safe-area-context";
import { HoldButton } from "@/src/components/HoldButton";
import { Image as ExpoImage } from "expo-image";

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
  bg: "#071426",
  card: "#0D1E35",
  cardBorder: "rgba(255,255,255,0.07)",
  accent: "#F59E0B",
  accentBorder: "rgba(245,158,11,0.3)",
  success: "#00C896",
  text: "#F1F5F9",
  textMuted: "#64748B",
  textSecondary: "#94A3B8",
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
  const trophyScale = useRef(new Animated.Value(0.6)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(14)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(16)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(trophyScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      Animated.timing(trophyOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]).start();

    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 300);

    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(statsOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(statsSlide, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]).start();
    }, 650);

    const t3 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(buttonSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
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

  return (
    <SafeAreaView style={S.root} edges={["top", "bottom"]}>
      <LinearGradient colors={[C.bg, "#0A1826", C.bg]} style={S.gradient} />
      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        <View style={S.content}>

          {/* Trophy */}
          <View style={S.trophySection}>
            <Animated.View style={[S.glowRing, { opacity: glowOpacity }]} />
            <Animated.View
              style={[S.trophyCard, { opacity: trophyOpacity, transform: [{ scale: trophyScale }] }]}
            >
              <ExpoImage
                source={require("@/assets/images/trophy.png")}
                style={S.trophyImage}
                contentFit="contain"
              />
            </Animated.View>
          </View>

          {/* Eyebrow + Title */}
          <Animated.View style={[S.titleSection, { opacity: titleOpacity, transform: [{ translateY: titleSlide }] }]}>
            <Text style={S.eyebrow}>GAME COMPLETE</Text>
            <Text style={S.title}>Portfolio Mastered</Text>
            <Text style={S.subtitle}>
              You've completed the investment journey.{"\n"}Your final portfolio stands as a testament to your strategy.
            </Text>

            {/* P2P Branding strip */}
            <View style={S.brandStrip}>
              <ExpoImage
                source={require("@/assets/images/22.png")}
                style={S.brandLogo}
                contentFit="contain"
              />
              <View style={S.brandMeta}>
                <Text style={S.brandName}>Official P2P Experience</Text>
                <Text style={S.brandUrl}>p2p.com.mk</Text>
              </View>
            </View>
          </Animated.View>

          {/* Stats */}
          <Animated.View style={[S.statsCard, { opacity: statsOpacity, transform: [{ translateY: statsSlide }] }]}>
            <Text style={S.statsHeader}>FINAL STATISTICS</Text>
            {statRows.map(([label, value], i) => (
              <View key={label} style={[S.statRow, i === statRows.length - 1 && S.statRowLast]}>
                <Text style={S.statLabel}>{label}</Text>
                <Text style={S.statValue}>{value}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Buttons */}
          <Animated.View style={[S.buttons, { opacity: buttonOpacity, transform: [{ translateY: buttonSlide }] }]}>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [S.continueBtn, pressed && S.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue current run"
            >
              <LinearGradient colors={["#00C896", "#009F7A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.continueBtnInner}>
                <Text style={S.continueBtnText}>CONTINUE CURRENT RUN</Text>
              </LinearGradient>
            </Pressable>

            <View style={S.orRow}>
              <View style={S.orLine} />
              <Text style={S.orText}>OR</Text>
              <View style={S.orLine} />
            </View>

            <HoldButton
              onHoldComplete={onReplay}
              colors={["#DC2626", "#EF4444"]}
              textColor="#FFFFFF"
              progressColor="#FFFFFF"
              style={S.restartBtn}
            >
              RESTART RUN
            </HoldButton>

            <Text style={S.restartHint}>
              Restart will reset all progress. Your completion record is saved.
            </Text>

            <View style={S.footerBrand}>
              <Text style={S.footerPowered}>Powered by P2P</Text>
              <Text style={S.footerUrl}>p2p.com.mk</Text>
            </View>
          </Animated.View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  gradient: { ...StyleSheet.absoluteFillObject },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  content: { alignItems: "center", maxWidth: 440, width: "100%" },

  // Trophy
  trophySection: { alignItems: "center", justifyContent: "center", marginBottom: 24, height: 120 },
  glowRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(245,158,11,0.04)",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.35,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  trophyCard: {
    width: 88,
    height: 88,
    borderRadius: 20,
    backgroundColor: "#0A1830",
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  trophyImage: { width: 54, height: 54 },

  // Title
  titleSection: { alignItems: "center", marginBottom: 24, width: "100%" },
  eyebrow: {
    fontSize: 11, fontWeight: "700", color: C.accent, letterSpacing: 3,
    textTransform: "uppercase", marginBottom: 8,
  },
  title: {
    fontSize: 28, fontWeight: "700", color: C.text, textAlign: "center",
    lineHeight: 36, letterSpacing: -0.3, marginBottom: 10,
  },
  subtitle: {
    fontSize: 14, color: C.textSecondary, textAlign: "center",
    lineHeight: 22, maxWidth: 300, marginBottom: 20,
  },
  brandStrip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.card, borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.accentBorder,
    gap: 12, width: "100%",
  },
  brandLogo: { width: 56, height: 28 },
  brandMeta: { flex: 1 },
  brandName: { fontSize: 12, fontWeight: "600", color: C.text, marginBottom: 2 },
  brandUrl: { fontSize: 11, fontWeight: "600", color: C.accent },

  // Stats
  statsCard: {
    width: "100%", backgroundColor: C.card, borderRadius: 14,
    padding: 18, borderWidth: 1, borderColor: C.cardBorder,
    marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  statsHeader: {
    fontSize: 10, fontWeight: "700", color: C.textMuted,
    letterSpacing: 2, textTransform: "uppercase", marginBottom: 14,
  },
  statRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  statRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  statLabel: { fontSize: 13, color: C.textSecondary, fontWeight: "500" },
  statValue: { fontSize: 13, color: C.accent, fontWeight: "700" },

  // Buttons
  buttons: { width: "100%", alignItems: "center", paddingBottom: 8 },
  continueBtn: {
    width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 14,
    shadowColor: "#00C896", shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  continueBtnInner: { paddingVertical: 17, alignItems: "center", borderRadius: 14 },
  continueBtnText: { fontSize: 15, fontWeight: "700", color: "#fff", letterSpacing: 1 },
  orRow: { flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 14, gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: C.cardBorder },
  orText: { fontSize: 10, fontWeight: "700", color: C.textMuted, letterSpacing: 2 },
  restartBtn: { width: "100%", marginBottom: 0 },
  restartHint: {
    fontSize: 11, color: C.textMuted, marginTop: 12, textAlign: "center",
    lineHeight: 17, paddingHorizontal: 16,
  },
  footerBrand: {
    alignItems: "center", marginTop: 20, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: C.cardBorder, width: "100%",
  },
  footerPowered: { fontSize: 11, color: C.textMuted, letterSpacing: 0.4, marginBottom: 3 },
  footerUrl: { fontSize: 13, fontWeight: "700", color: C.accent, letterSpacing: 0.5 },
});
