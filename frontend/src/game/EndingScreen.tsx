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
  bg: "#0F172A",
  card: "#1E293B",
  accent: "#FBBF24",
  accentDeep: "#F59E0B",
  success: "#00C896",
  white: "#FFFFFF",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  border: "#334155",
};

const COLORS = ["#FBBF24", "#00C896", "#3B82F6", "#EF4444", "#A855F7", "#94A3B8"];

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
    for (let i = 0; i < 50; i++) {
      particlesRef.current.push({
        x: new Animated.Value(Math.random() * width),
        y: new Animated.Value(-20 - Math.random() * 100),
        rot: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 8,
        delay: Math.random() * 1500,
      });
    }
  }

  useEffect(() => {
    const loops = particlesRef.current.map((p) => {
      const fallY = height + 50;
      const duration = 3500 + Math.random() * 2000;
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
    animRef.current = Animated.stagger(60, loops);
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
    <View style={EndingStyles.root}>
      <LinearGradient colors={[C.bg, "#1E293B", C.bg]} style={EndingStyles.gradient} />
      <Confetti />
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
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onReplay}
            accessibilityRole="button"
            accessibilityLabel="Start new game"
          >
            <LinearGradient colors={[C.accentDeep, C.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={EndingStyles.replayBtnGradient}>
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
  content: { alignItems: "center", paddingHorizontal: 24, maxWidth: 440, width: "100%" },
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
  buttonContainer: { alignItems: "center", width: "100%", paddingBottom: 32 },
  replayBtnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: "center",
    borderRadius: 14,
  },
  replayBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", letterSpacing: 1 },
  replayHint: { fontSize: 12, color: C.textMuted, marginTop: 14, textAlign: "center", lineHeight: 18 },
});
