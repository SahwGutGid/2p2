import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatCurrency, formatNumber, formatTimeDetailed } from "@/src/utils/format";
import { SafeAreaView } from "react-native-safe-area-context";
import { HoldButton } from "@/src/components/HoldButton";
import { Image as ExpoImage } from "expo-image";

const { width } = Dimensions.get("window");

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
  card: "#0F2038",
  cardElevated: "#162840",
  accent: "#F59E0B",
  success: "#00C896",
  white: "#FFFFFF",
  text: "#F1F5F9",
  textMuted: "#64748B",
  textSecondary: "#94A3B8",
  border: "rgba(255,255,255,0.08)",
  borderAccent: "rgba(245,158,11,0.25)",
  gold: "#FFD700",
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
  const trophyScale = useRef(new Animated.Value(0)).current;
  const trophyOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(16)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const statsSlide = useRef(new Animated.Value(20)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.93)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(trophyScale, { toValue: 1, friction: 4, tension: 45, useNativeDriver: true }),
      Animated.timing(trophyOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ]).start();

    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(titleSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 350);

    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(statsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(statsSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }, 700);

    const t3 = setTimeout(() => {
      Animated.parallel([
        Animated.spring(buttonScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
        Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 1200);

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
    <SafeAreaView style={EndingStyles.root} edges={["top", "bottom"]}>
      <LinearGradient colors={[C.bg, "#0F1F38", C.bg]} style={EndingStyles.gradient} />
      <ScrollView
        style={EndingStyles.scrollView}
        contentContainerStyle={EndingStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={EndingStyles.content}>

          {/* Trophy */}
          <View style={EndingStyles.trophySection}>
            <Animated.View style={[EndingStyles.glowRing, { opacity: glowOpacity }]} />
            <Animated.View style={[EndingStyles.glowRingInner, { opacity: glowOpacity }]} />
            <Animated.View
              style={[
                EndingStyles.trophyContainer,
                { opacity: trophyOpacity, transform: [{ scale: trophyScale }] },
              ]}
            >
              <LinearGradient
                colors={["#2A1F00", "#1A1400"]}
                style={EndingStyles.trophyBg}
              >
                <ExpoImage
                  source={require("@/assets/images/trophy.png")}
                  style={EndingStyles.trophyImage}
                  contentFit="contain"
                />
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Title Section */}
          <Animated.View
            style={[
              EndingStyles.titleSection,
              { opacity: titleOpacity, transform: [{ translateY: titleSlide }] },
            ]}
          >
            <Text style={EndingStyles.eyebrow}>GAME COMPLETE</Text>
            <Text style={EndingStyles.title}>Portfolio Mastered</Text>
            <Text style={EndingStyles.subtitle}>
              You've completed the investment journey.{"\n"}
              Your final portfolio stands as a testament to your strategy.
            </Text>

            {/* P2P Branding */}
            <View style={EndingStyles.brandCard}>
              <ExpoImage
                source={require("@/assets/images/22.png")}
                style={EndingStyles.brandLogo}
                contentFit="contain"
              />
              <View style={EndingStyles.brandTextGroup}>
                <Text style={EndingStyles.brandTitle}>Official P2P Experience</Text>
                <Text style={EndingStyles.brandWebsite}>p2p.com.mk</Text>
              </View>
            </View>
          </Animated.View>

          {/* Stats Card */}
          <Animated.View
            style={[
              EndingStyles.statsCard,
              { opacity: statsOpacity, transform: [{ translateY: statsSlide }] },
            ]}
          >
            <Text style={EndingStyles.statsHeader}>FINAL STATISTICS</Text>
            {statRows.map(([label, value], i) => (
              <View
                key={label}
                style={[
                  EndingStyles.statRow,
                  i === statRows.length - 1 && EndingStyles.statRowLast,
                ]}
              >
                <Text style={EndingStyles.statLabel}>{label}</Text>
                <Text style={EndingStyles.statValue}>{value}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Buttons */}
          <Animated.View
            style={[
              EndingStyles.buttonContainer,
              {
                opacity: buttonOpacity,
                transform: [{ scale: buttonScale }],
              },
            ]}
          >
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
                colors={["#00C896", "#00A878"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={EndingStyles.continueBtnGradient}
              >
                <Text style={EndingStyles.continueBtnText}>CONTINUE CURRENT RUN</Text>
              </LinearGradient>
            </Pressable>

            <View style={EndingStyles.dividerRow}>
              <View style={EndingStyles.dividerLine} />
              <Text style={EndingStyles.dividerText}>OR</Text>
              <View style={EndingStyles.dividerLine} />
            </View>

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

            <View style={EndingStyles.footerBranding}>
              <Text style={EndingStyles.footerPoweredBy}>Powered by P2P</Text>
              <Text style={EndingStyles.footerWebsite}>p2p.com.mk</Text>
            </View>
          </Animated.View>

        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  content: {
    alignItems: "center",
    maxWidth: 440,
    width: "100%",
  },

  // Trophy
  trophySection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    height: 140,
  },
  glowRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 215, 0, 0.06)",
    shadowColor: "#FFD700",
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  glowRingInner: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  trophyContainer: {
    shadowColor: "#FFD700",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  trophyBg: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  trophyImage: {
    width: 60,
    height: 60,
  },

  // Title
  titleSection: { alignItems: "center", marginBottom: 28 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 3,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 320,
    marginBottom: 24,
  },
  brandCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.borderAccent,
    gap: 12,
  },
  brandLogo: {
    width: 56,
    height: 28,
  },
  brandTextGroup: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: C.text,
    marginBottom: 2,
  },
  brandWebsite: {
    fontSize: 12,
    fontWeight: "600",
    color: C.accent,
  },

  // Stats
  statsCard: {
    width: "100%",
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statsHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    marginBottom: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  statLabel: { fontSize: 13, color: C.textSecondary, fontWeight: "500" },
  statValue: { fontSize: 14, color: C.accent, fontWeight: "700" },

  // Buttons
  buttonContainer: {
    alignItems: "center",
    width: "100%",
    paddingBottom: 16,
  },
  continueBtn: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#00C896",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  continueBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  continueBtnGradient: {
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 14,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: "700",
    color: C.textMuted,
    letterSpacing: 2,
  },
  restartBtn: {
    width: "100%",
    marginBottom: 0,
  },
  replayHint: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 14,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  footerBranding: {
    alignItems: "center",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
    width: "100%",
  },
  footerPoweredBy: {
    fontSize: 11,
    fontWeight: "500",
    color: C.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footerWebsite: {
    fontSize: 13,
    fontWeight: "700",
    color: C.accent,
    letterSpacing: 0.5,
  },
});
