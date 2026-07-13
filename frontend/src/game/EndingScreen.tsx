import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { formatCurrency, formatNumber, formatTimeDetailed } from "@/src/utils/format";

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
  bg: "#FFFFFF",
  card: "#FFFFFF",
  accent: "#006B5E",
  accentDeep: "#005A4E",
  success: "#00A67E",
  white: "#FFFFFF",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
};

const COLORS = ["#006B5E", "#00A67E", "#005A4E", "#E5E7EB", "#6B7280", "#111827"];

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  rot: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  delay: number;
};

function Confetti() {
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  if (particlesRef.current.length === 0) {
    for (let i = 0; i < 60; i++) {
      particlesRef.current.push({
        x: new Animated.Value(Math.random() * width),
        y: new Animated.Value(-20 - Math.random() * 100),
        rot: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        delay: Math.random() * 2000,
      });
    }
  }

  useEffect(() => {
    const loops = particlesRef.current.map((p) => {
      const fallY = height + 50;
      const duration = 3000 + Math.random() * 2000;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(p.y, { toValue: fallY, duration, useNativeDriver: true }),
            Animated.timing(p.x, { toValue: Math.random() * width, duration, useNativeDriver: true }),
            Animated.timing(p.rot, { toValue: 360 * (Math.random() > 0.5 ? 1 : -1), duration, useNativeDriver: true }),
            Animated.sequence([
              Animated.delay(duration * 0.7),
              Animated.timing(p.opacity, { toValue: 0, duration: duration * 0.3, useNativeDriver: true }),
            ]),
          ]),
        ]),
      );
    });
    animRef.current = Animated.stagger(50, loops);
    animRef.current.start();
    return () => animRef.current?.stop();
  }, []);

  return (
    <View style={EndingStyles.confettiLayer} pointerEvents="none">
      {particlesRef.current.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
            opacity: p.opacity,
            transform: [{ rotate: p.rot.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] }) }],
          }}
        />
      ))}
    </View>
  );
}

export function EndingScreen({
  stats,
  onReplay,
}: {
  stats: CompletionStats;
  onReplay: () => void;
}) {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const t1 = setTimeout(() => {
      Animated.timing(statsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 400);
    const t2 = setTimeout(() => {
      Animated.timing(buttonOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
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
    <View style={EndingStyles.root}>
      <LinearGradient colors={[C.bg, "#0F1830", C.bg]} style={EndingStyles.gradient} />
      <Confetti />
      <View style={EndingStyles.content}>
        <Animated.View style={[EndingStyles.titleWrap, { opacity: titleOpacity }]}>
          <View style={EndingStyles.iconContainer}>
            <Text style={EndingStyles.icon}>✓</Text>
          </View>
          <Text style={EndingStyles.eyebrow}>GAME COMPLETE</Text>
          <Text style={EndingStyles.title}>Portfolio Mastered</Text>
          <Text style={EndingStyles.subtitle}>
            You've completed the investment journey. Your final stats show a successful career in the markets.
          </Text>
        </Animated.View>

        <Animated.View style={[EndingStyles.statsCard, { opacity: statsOpacity }]}>
          <Text style={EndingStyles.statsHeader}>Final Statistics</Text>
          {statRows.map(([label, value]) => (
            <View key={label} style={EndingStyles.statRow}>
              <Text style={EndingStyles.statLabel}>{label}</Text>
              <Text style={EndingStyles.statValue}>{value}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={[EndingStyles.buttonContainer, { opacity: buttonOpacity }]}>
          <Pressable
            style={EndingStyles.replayBtn}
            onPress={onReplay}
            accessibilityRole="button"
            accessibilityLabel="Start new game"
          >
            <LinearGradient colors={[C.accentDeep, C.accent]} style={EndingStyles.replayBtnGradient}>
              <Text style={EndingStyles.replayBtnText}>START NEW GAME</Text>
            </LinearGradient>
          </Pressable>
          <Text style={EndingStyles.replayHint}>
            Your completion record is saved. Progress will reset.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const EndingStyles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  gradient: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  confettiLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" },
  content: { alignItems: "center", paddingHorizontal: 20, maxWidth: 440, width: "100%" },
  titleWrap: { alignItems: "center", marginBottom: 32 },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000000", shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  icon: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: C.accent,
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 12,
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
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 24,
    shadowColor: "#000000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  statsHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  statLabel: { fontSize: 13, color: C.textMuted, fontWeight: "500" },
  statValue: { fontSize: 14, color: C.accent, fontWeight: "600" },
  buttonContainer: { alignItems: "center", width: "100%" },
  replayBtn: { borderRadius: 12, overflow: "hidden", width: "100%" },
  replayBtnGradient: { paddingVertical: 16, alignItems: "center" },
  replayBtnText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF", letterSpacing: 0.5 },
  replayHint: { fontSize: 12, color: C.textMuted, marginTop: 12, textAlign: "center", lineHeight: 18 },
});
