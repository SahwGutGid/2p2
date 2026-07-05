import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------- P2P Dark Theme ----------
const C = {
  bg: "#0B1220",
  panel: "#111B2E",
  panelElevated: "#16223A",
  accent: "#00E5FF",
  gain: "#00FF88",
  loss: "#FF4D4D",
  text: "#E6E6E6",
  textMuted: "#8A96AD",
  border: "#1E2A44",
  borderStrong: "#2A3A5C",
};

// ---------- Packages ----------
// Rule: higher profit MUST always require longer duration.
// Cost + duration + profit% scale together so progression feels earned.
type Pkg = {
  id: string;
  name: string;
  tag: string;
  cost: number;
  durationMs: number;
  profitPct: number; // e.g. 0.05 = +5%
  tint: string;
};

const PACKAGES: Pkg[] = [
  {
    id: "starter",
    name: "Starter Bond",
    tag: "Low risk",
    cost: 10,
    durationMs: 3000,
    profitPct: 0.05,
    tint: "#5EE1B0",
  },
  {
    id: "growth",
    name: "Growth Fund",
    tag: "Medium",
    cost: 50,
    durationMs: 8000,
    profitPct: 0.12,
    tint: "#00E5FF",
  },
  {
    id: "momentum",
    name: "Momentum Pool",
    tag: "High",
    cost: 200,
    durationMs: 20000,
    profitPct: 0.25,
    tint: "#FFB84D",
  },
  {
    id: "whale",
    name: "Whale Vault",
    tag: "Very high risk",
    cost: 1000,
    durationMs: 60000,
    profitPct: 0.6,
    tint: "#FF6EC7",
  },
];

const money = (n: number) => `$${n.toFixed(2)}`;
const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
};

export default function Index() {
  const [balance, setBalance] = useState<number>(100);
  const [selectedId, setSelectedId] = useState<string>(PACKAGES[0].id);
  const [activePkg, setActivePkg] = useState<Pkg | null>(null);
  const [msLeft, setMsLeft] = useState<number>(0);
  const [lastProfit, setLastProfit] = useState<number>(0);

  const progress = useSharedValue(0);
  const floatY = useSharedValue(0);
  const floatOpacity = useSharedValue(0);
  const balancePulse = useSharedValue(1);

  const finishRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (finishRef.current) clearTimeout(finishRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      cancelAnimation(progress);
    };
  }, [progress]);

  const selected = PACKAGES.find((p) => p.id === selectedId) ?? PACKAGES[0];
  const isBusy = activePkg !== null;
  const canAffordSelected = balance >= selected.cost && !isBusy;

  const finish = (pkg: Pkg) => {
    const profit = pkg.cost * pkg.profitPct;
    // cost was already deducted at start; return principal + profit.
    setBalance((b) => b + pkg.cost + profit);
    setLastProfit(profit);
    setActivePkg(null);
    setMsLeft(0);
    progress.value = 0;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );

    balancePulse.value = withSequence(
      withTiming(1.08, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) })
    );

    floatY.value = 0;
    floatOpacity.value = 1;
    floatY.value = withTiming(-90, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
    floatOpacity.value = withDelay(
      600,
      withTiming(0, { duration: 600, easing: Easing.linear })
    );
  };

  const invest = () => {
    if (isBusy || !canAffordSelected) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const pkg = selected;
    setBalance((b) => b - pkg.cost); // deduct cost immediately (locked)
    setActivePkg(pkg);
    setMsLeft(pkg.durationMs);
    startedAtRef.current = Date.now();

    progress.value = 0;
    progress.value = withTiming(1, {
      duration: pkg.durationMs,
      easing: Easing.linear,
    });

    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, pkg.durationMs - elapsed);
      setMsLeft(remaining);
      if (remaining <= 0 && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }, 100);

    finishRef.current = setTimeout(() => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      finish(pkg);
    }, pkg.durationMs);
  };

  // ---- animated styles ----
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const floatStyle = useAnimatedStyle(() => ({
    opacity: floatOpacity.value,
    transform: [{ translateY: floatY.value }],
  }));
  const balanceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: balancePulse.value }],
  }));

  const secondsLeftLabel =
    msLeft >= 60000
      ? fmtDuration(msLeft)
      : `${(msLeft / 1000).toFixed(1)}s`;

  return (
    <SafeAreaView style={styles.safe} testID="game-screen">
      {/* HEADER / BALANCE */}
      <View style={styles.header}>
        <Text style={styles.balanceLabel}>PORTFOLIO BALANCE</Text>
        <View style={styles.balanceRow}>
          <Animated.Text
            style={[styles.balance, balanceStyle]}
            testID="balance-value"
          >
            {money(balance)}
          </Animated.Text>
          <Animated.Text
            style={[styles.floatingProfit, floatStyle]}
            pointerEvents="none"
            testID="floating-profit"
          >
            +{money(lastProfit)}
          </Animated.Text>
        </View>

        {activePkg ? (
          <View style={styles.lockedPill} testID="locked-pill">
            <View style={styles.lockDot} />
            <Text style={styles.lockedText}>
              {money(activePkg.cost)} locked in {activePkg.name}
            </Text>
          </View>
        ) : (
          <View style={styles.availPill}>
            <Text style={styles.availText}>Available to invest</Text>
          </View>
        )}
      </View>

      {/* PACKAGES */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>INVESTMENT PACKAGES</Text>

        {PACKAGES.map((pkg) => {
          const affordable = balance >= pkg.cost;
          const isSelected = pkg.id === selectedId;
          const locked = isBusy;
          const disabled = locked || !affordable;
          const projectedProfit = pkg.cost * pkg.profitPct;
          const roi = `+${(pkg.profitPct * 100).toFixed(0)}%`;

          return (
            <Pressable
              key={pkg.id}
              disabled={disabled}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelectedId(pkg.id);
              }}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                !affordable && !locked && styles.cardLocked,
                pressed && !disabled && styles.cardPressed,
              ]}
              testID={`package-${pkg.id}`}
            >
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: `${pkg.tint}22`, borderColor: pkg.tint }]}>
                  <Text style={[styles.cardIconText, { color: pkg.tint }]}>
                    {roi}
                  </Text>
                </View>

                <View style={styles.cardMain}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{pkg.name}</Text>
                    {!affordable && !locked ? (
                      <View style={styles.badgeLoss}>
                        <Text style={styles.badgeLossText}>LOCKED</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeTag}>
                        <Text style={styles.badgeTagText}>{pkg.tag}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaCell}>
                      <Text style={styles.metaLabel}>Cost</Text>
                      <Text style={styles.metaValue}>{money(pkg.cost)}</Text>
                    </View>
                    <View style={styles.metaCell}>
                      <Text style={styles.metaLabel}>Duration</Text>
                      <Text style={styles.metaValue}>
                        {fmtDuration(pkg.durationMs)}
                      </Text>
                    </View>
                    <View style={styles.metaCell}>
                      <Text style={styles.metaLabel}>Profit</Text>
                      <Text style={[styles.metaValue, styles.metaGain]}>
                        +{money(projectedProfit)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {isSelected && !disabled && (
                <View style={styles.selectedGlow} pointerEvents="none" />
              )}
            </Pressable>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* INVEST BUTTON */}
      <View style={styles.ctaBar}>
        <Pressable
          onPress={invest}
          disabled={isBusy || !canAffordSelected}
          style={({ pressed }) => [
            styles.investBtn,
            isBusy && styles.investBtnBusy,
            !canAffordSelected && !isBusy && styles.investBtnDisabled,
            pressed && canAffordSelected && !isBusy && styles.investBtnPressed,
          ]}
          testID="invest-button"
        >
          <Animated.View
            style={[styles.investProgress, progressStyle]}
            pointerEvents="none"
            testID="invest-progress"
          />
          <View style={styles.investContent}>
            {isBusy && activePkg ? (
              <>
                <Text
                  style={[styles.investLabel, styles.investLabelBusy]}
                  testID="invest-label"
                >
                  Investing {activePkg.name}
                </Text>
                <Text
                  style={[styles.investSub, styles.investSubBusy]}
                  testID="invest-countdown"
                >
                  {secondsLeftLabel} left
                </Text>
              </>
            ) : !canAffordSelected ? (
              <>
                <Text
                  style={[styles.investLabel, styles.investLabelDisabled]}
                  testID="invest-label"
                >
                  Insufficient Balance
                </Text>
                <Text style={styles.investSubDisabled}>
                  Need {money(selected.cost)} for {selected.name}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.investLabel} testID="invest-label">
                  Invest {money(selected.cost)}
                </Text>
                <Text style={styles.investSub}>
                  {selected.name} · +{money(selected.cost * selected.profitPct)} in{" "}
                  {fmtDuration(selected.durationMs)}
                </Text>
              </>
            )}
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  balanceLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  balanceRow: {
    position: "relative",
    marginTop: 6,
  },
  balance: {
    color: C.text,
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1,
  },
  floatingProfit: {
    position: "absolute",
    right: 0,
    top: 0,
    color: C.gain,
    fontSize: 20,
    fontWeight: "900",
  },
  lockedPill: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
  },
  lockDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.loss,
    marginRight: 8,
  },
  lockedText: {
    color: C.loss,
    fontSize: 12,
    fontWeight: "700",
  },
  availPill: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,229,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.35)",
  },
  availText: {
    color: C.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Cards
  card: {
    backgroundColor: C.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: C.accent,
    borderWidth: 2,
    backgroundColor: C.panelElevated,
    shadowColor: C.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  cardLocked: {
    opacity: 0.55,
    borderColor: "rgba(255,77,77,0.25)",
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardIconText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  cardMain: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
    flexShrink: 1,
    marginRight: 8,
  },
  badgeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(0,229,255,0.08)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.25)",
  },
  badgeTagText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeLoss: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "rgba(255,77,77,0.10)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
  },
  badgeLossText: {
    color: C.loss,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardMetaRow: {
    flexDirection: "row",
  },
  metaCell: {
    flex: 1,
  },
  metaLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  metaValue: {
    color: C.text,
    fontSize: 14,
    fontWeight: "800",
  },
  metaGain: {
    color: C.gain,
  },
  selectedGlow: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: C.accent,
  },

  // CTA
  ctaBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  investBtn: {
    height: 76,
    borderRadius: 20,
    backgroundColor: C.accent,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: C.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  investBtnBusy: {
    backgroundColor: "#0A2A44",
    borderWidth: 1,
    borderColor: C.accent,
    shadowOpacity: 0.15,
  },
  investBtnDisabled: {
    backgroundColor: C.panelElevated,
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    shadowOpacity: 0,
  },
  investBtnPressed: {
    transform: [{ scale: 0.98 }],
  },
  investProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,229,255,0.35)",
  },
  investContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  investLabel: {
    color: "#001018",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  investLabelDisabled: {
    color: C.loss,
  },
  investLabelBusy: {
    color: C.accent,
  },
  investSub: {
    color: "#001018",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    opacity: 0.75,
  },
  investSubBusy: {
    color: C.text,
    opacity: 0.85,
  },
  investSubDisabled: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
});
