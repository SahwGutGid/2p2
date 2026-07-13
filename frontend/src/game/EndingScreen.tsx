import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
  gold: "#FFD700",
  goldLight: "#FFE87C",
  goldDim: "#B8860B",
  white: "#FFFFFF",
  text: "#F5F5F5",
  textDim: "#C0C0C0",
  bg: "#0A0A1A",
};

const fmtTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const fmtNum = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtPP = (n: number): string => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
};

type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  rot: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  delay: number;
};

const COLORS = ["#FFD700", "#FF6EC7", "#00E5FF", "#00FF88", "#FFA500", "#FFFFFF"];

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
  const titleScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const glowRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(titleScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: true }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();
    const t1 = setTimeout(() => {
      Animated.timing(statsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 600);
    const t2 = setTimeout(() => {
      Animated.spring(buttonScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }).start();
    }, 1200);
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowRef, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(glowRef, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ]),
    ).start();
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const statRows: [string, string][] = [
    ["Final Balance", fmtNum(stats.balance)],
    ["Highest Balance", fmtNum(stats.highestBalance)],
    ["Total Money Earned", fmtNum(stats.totalMoneyEarned)],
    ["Total Prestige Points", fmtPP(stats.totalPPEarned)],
    ["Times Prestiged", stats.totalPrestiges.toLocaleString()],
    ["Investments Completed", stats.investmentsCompleted.toLocaleString()],
    ["Upgrades Purchased", stats.upgradesPurchased.toLocaleString()],
    ["Accelerate Uses", stats.accelerateUses.toLocaleString()],
    ["Legacy Upgrades", `${stats.legacyUpgradesOwned} / 7`],
    ["Total Play Time", fmtTime(stats.activePlayTimeMs)],
  ];

  return (
    <View style={EndingStyles.root}>
      <LinearGradient colors={[C.bg, "#1a0a2e", C.bg]} style={EndingStyles.gradient} />
      <Confetti />
      <Animated.View
        style={[
          EndingStyles.glowRing,
          {
            opacity: glowRef.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] }),
            transform: [{ scale: glowRef.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
          },
        ]}
      />
      <View style={EndingStyles.content}>
        <Animated.View
          style={[
            EndingStyles.titleWrap,
            {
              opacity: titleOpacity,
              transform: [{ scale: titleScale }],
            },
          ]}
        >
          <Text style={EndingStyles.eyebrow}>YOU HAVE MASTERED THE MARKET</Text>
          <Text style={EndingStyles.title}>THE ULTIMATE{"\n"}INVESTOR</Text>
          <View style={EndingStyles.divider} />
          <Text style={EndingStyles.subtitle}>
            You've reached the pinnacle of financial mastery.{"\n"}
            Every investment, every prestige, every upgrade —{"\n"}
            all led to this moment.
          </Text>
        </Animated.View>

        <Animated.View style={[EndingStyles.statsCard, { opacity: statsOpacity }]}>
          {statRows.map(([label, value]) => (
            <View key={label} style={EndingStyles.statRow}>
              <Text style={EndingStyles.statLabel}>{label}</Text>
              <Text style={EndingStyles.statValue}>{value}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: buttonScale }], opacity: buttonScale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }}>
          <Pressable
            style={EndingStyles.replayBtn}
            onPress={onReplay}
            accessibilityRole="button"
            accessibilityLabel="Replay the game"
          >
            <LinearGradient colors={[C.goldDim, C.gold, C.goldLight]} style={EndingStyles.replayBtnGradient}>
              <Text style={EndingStyles.replayBtnText}>REPLAY</Text>
            </LinearGradient>
          </Pressable>
          <Text style={EndingStyles.replayHint}>
            Start a fresh save. Your completion record is preserved.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const EndingStyles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  gradient: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  confettiLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" },
  glowRing: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.gold,
    opacity: 0.2,
  },
  content: { alignItems: "center", paddingHorizontal: 24, maxWidth: 480, width: "100%" },
  titleWrap: { alignItems: "center", marginBottom: 28 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: C.gold,
    letterSpacing: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: 38,
    fontWeight: "900",
    color: C.white,
    textAlign: "center",
    lineHeight: 46,
    letterSpacing: 2,
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: C.gold,
    borderRadius: 2,
    marginVertical: 16,
  },
  subtitle: {
    fontSize: 14,
    color: C.textDim,
    textAlign: "center",
    lineHeight: 22,
  },
  statsCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    marginBottom: 28,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  statLabel: { fontSize: 13, color: C.textDim, fontWeight: "500" },
  statValue: { fontSize: 14, color: C.gold, fontWeight: "700" },
  replayBtn: { borderRadius: 16, overflow: "hidden" },
  replayBtnGradient: { paddingVertical: 16, paddingHorizontal: 48, alignItems: "center" },
  replayBtnText: { fontSize: 18, fontWeight: "900", color: "#1a0a2e", letterSpacing: 3 },
  replayHint: { fontSize: 11, color: C.textDim, marginTop: 12, textAlign: "center" },
});
