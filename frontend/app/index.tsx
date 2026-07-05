import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// ---------- Packages (rebalanced for faster early progression) ----------
type Pkg = {
  id: string;
  name: string;
  tag: string;
  cost: number;
  durationMs: number;
  profitPct: number;
  tint: string;
};

const PACKAGES: Pkg[] = [
  { id: "starter", name: "Starter Bond",   tag: "Low risk",       cost: 10,   durationMs: 3000,  profitPct: 0.08, tint: "#5EE1B0" },
  { id: "growth",  name: "Growth Fund",    tag: "Medium",         cost: 50,   durationMs: 8000,  profitPct: 0.18, tint: "#00E5FF" },
  { id: "momentum",name: "Momentum Pool",  tag: "High",           cost: 200,  durationMs: 20000, profitPct: 0.40, tint: "#FFB84D" },
  { id: "whale",   name: "Whale Vault",    tag: "Very high risk", cost: 1000, durationMs: 60000, profitPct: 1.00, tint: "#FF6EC7" },
];

// ---------- Upgrades ----------
type UpgradeId = "yield" | "turbo" | "passive" | "lucky";
type Upgrade = {
  id: UpgradeId;
  name: string;
  description: (level: number) => string;
  effect: (level: number) => string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  tint: string;
};

const UPGRADES: Upgrade[] = [
  {
    id: "yield",
    name: "Yield Boost",
    description: () => "+5% profit multiplier per level",
    effect: (l) => `+${(l * 5).toFixed(0)}% profit`,
    baseCost: 25,
    costGrowth: 1.7,
    maxLevel: 15,
    tint: "#00FF88",
  },
  {
    id: "turbo",
    name: "Turbo Trades",
    description: () => "-4% investment duration per level",
    effect: (l) => `-${Math.min(60, l * 4).toFixed(0)}% time`,
    baseCost: 40,
    costGrowth: 1.75,
    maxLevel: 15,
    tint: "#00E5FF",
  },
  {
    id: "passive",
    name: "Passive Yield",
    description: () => "+$0.50/sec passive income per level",
    effect: (l) => `+$${(l * 0.5).toFixed(2)}/sec`,
    baseCost: 100,
    costGrowth: 1.6,
    maxLevel: 25,
    tint: "#FFB84D",
  },
  {
    id: "lucky",
    name: "Lucky Streak",
    description: () => "+3% chance for 2× profit per level",
    effect: (l) => `${Math.min(60, l * 3).toFixed(0)}% x2 chance`,
    baseCost: 150,
    costGrowth: 1.85,
    maxLevel: 20,
    tint: "#FF6EC7",
  },
];

const upgradeCost = (u: Upgrade, level: number) =>
  Math.floor(u.baseCost * Math.pow(u.costGrowth, level));

// ---------- Save shape ----------
type ActiveState = { id: string; cost: number; endsAt: number } | null;

type SaveData = {
  v: 1;
  balance: number;
  selectedId: string;
  levels: Record<UpgradeId, number>;
  active: ActiveState;
  lastSeenAt: number;
};

const SAVE_KEY = "investmentIdle:v1";
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // 8h offline earnings cap

const defaultSave = (): SaveData => ({
  v: 1,
  balance: 100,
  selectedId: PACKAGES[0].id,
  levels: { yield: 0, turbo: 0, passive: 0, lucky: 0 },
  active: null,
  lastSeenAt: Date.now(),
});

// ---------- Helpers ----------
const money = (n: number) => `$${n.toFixed(2)}`;
const fmtDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
};
const fmtSecs = (ms: number) =>
  ms >= 60000 ? fmtDuration(ms) : `${(ms / 1000).toFixed(1)}s`;

const effectiveProfitPct = (base: number, yieldLevel: number) =>
  base * (1 + 0.05 * yieldLevel);

const effectiveDurationMs = (base: number, turboLevel: number) => {
  const reduction = Math.min(0.6, 0.04 * turboLevel);
  return Math.round(base * (1 - reduction));
};

const passiveRate = (level: number) => 0.5 * level;
const luckyChance = (level: number) => Math.min(0.6, 0.03 * level);

export default function Index() {
  const [ready, setReady] = useState(false);
  const [balance, setBalance] = useState(100);
  const [selectedId, setSelectedId] = useState(PACKAGES[0].id);
  const [levels, setLevels] = useState<Record<UpgradeId, number>>({
    yield: 0,
    turbo: 0,
    passive: 0,
    lucky: 0,
  });
  const [active, setActive] = useState<ActiveState>(null);
  const [msLeft, setMsLeft] = useState(0);
  const [lastProfit, setLastProfit] = useState(0);
  const [wasLucky, setWasLucky] = useState(false);
  const [offlineGain, setOfflineGain] = useState<number>(0);

  const progress = useSharedValue(0);
  const floatY = useSharedValue(0);
  const floatOpacity = useSharedValue(0);
  const balancePulse = useSharedValue(1);

  const finishRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passiveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- persistence ----
  const saveState = useCallback(
    async (data: Partial<SaveData>) => {
      try {
        const merged: SaveData = {
          v: 1,
          balance,
          selectedId,
          levels,
          active,
          lastSeenAt: Date.now(),
          ...data,
        };
        await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(merged));
      } catch {}
    },
    [balance, selectedId, levels, active]
  );

  // Load once
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVE_KEY);
        const now = Date.now();
        let saved: SaveData = defaultSave();
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SaveData>;
          saved = {
            ...defaultSave(),
            ...parsed,
            levels: { ...defaultSave().levels, ...(parsed.levels ?? {}) },
          };
        }

        // Offline passive income (capped)
        const elapsed = Math.min(
          OFFLINE_CAP_MS,
          Math.max(0, now - (saved.lastSeenAt ?? now))
        );
        const passiveEarned =
          (elapsed / 1000) * passiveRate(saved.levels.passive ?? 0);

        // Resolve active investment
        let restoredActive: ActiveState = saved.active;
        let hadCompletion = 0;
        if (restoredActive) {
          if (now >= restoredActive.endsAt) {
            // Settle: pay principal + profit at the base rate captured in the package
            const pkg = PACKAGES.find((p) => p.id === restoredActive!.id);
            if (pkg) {
              const p =
                restoredActive.cost *
                effectiveProfitPct(pkg.profitPct, saved.levels.yield ?? 0);
              hadCompletion = restoredActive.cost + p;
            }
            restoredActive = null;
          }
        }

        setBalance(saved.balance + passiveEarned + hadCompletion);
        setSelectedId(saved.selectedId ?? PACKAGES[0].id);
        setLevels(saved.levels);
        setActive(restoredActive);
        if (passiveEarned > 0.01) setOfflineGain(passiveEarned);

        // If active investment still running, restore progress + timer
        if (restoredActive) {
          const remaining = Math.max(0, restoredActive.endsAt - now);
          const total = restoredActive.endsAt - (saved.lastSeenAt ?? now);
          const initialProgress =
            total > 0 ? Math.min(1, 1 - remaining / total) : 0;
          progress.value = initialProgress;
          progress.value = withTiming(1, {
            duration: remaining,
            easing: Easing.linear,
          });
          setMsLeft(remaining);
          finishRef.current = setTimeout(() => {
            finishActive(restoredActive!);
          }, remaining);
          tickRef.current = setInterval(() => {
            const left = Math.max(0, restoredActive!.endsAt - Date.now());
            setMsLeft(left);
            if (left <= 0 && tickRef.current) {
              clearInterval(tickRef.current);
              tickRef.current = null;
            }
          }, 100);
        }
      } catch {
        // ignore, use defaults
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on state changes (only after initial load)
  useEffect(() => {
    if (!ready) return;
    saveState({});
  }, [ready, balance, selectedId, levels, active, saveState]);

  // Save on backgrounding for extra safety
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") saveState({});
    });
    return () => sub.remove();
  }, [saveState]);

  // Passive income loop
  useEffect(() => {
    if (passiveRef.current) {
      clearInterval(passiveRef.current);
      passiveRef.current = null;
    }
    const rate = passiveRate(levels.passive);
    if (rate <= 0) return;
    passiveRef.current = setInterval(() => {
      setBalance((b) => b + rate);
    }, 1000);
    return () => {
      if (passiveRef.current) {
        clearInterval(passiveRef.current);
        passiveRef.current = null;
      }
    };
  }, [levels.passive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (finishRef.current) clearTimeout(finishRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      cancelAnimation(progress);
    };
  }, [progress]);

  const selected = PACKAGES.find((p) => p.id === selectedId) ?? PACKAGES[0];
  const isBusy = active !== null;
  const canAffordSelected = balance >= selected.cost && !isBusy;

  // ---- Actions ----
  const finishActive = (a: ActiveState) => {
    if (!a) return;
    const pkg = PACKAGES.find((p) => p.id === a.id);
    if (!pkg) {
      setActive(null);
      return;
    }
    const basePct = effectiveProfitPct(pkg.profitPct, levels.yield);
    let profit = a.cost * basePct;
    const lucky = Math.random() < luckyChance(levels.lucky);
    if (lucky) profit *= 2;

    setBalance((b) => b + a.cost + profit);
    setLastProfit(profit);
    setWasLucky(lucky);
    setActive(null);
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
      duration: 1300,
      easing: Easing.out(Easing.cubic),
    });
    floatOpacity.value = withDelay(
      700,
      withTiming(0, { duration: 600, easing: Easing.linear })
    );
  };

  const invest = () => {
    if (isBusy || !canAffordSelected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const pkg = selected;
    const dur = effectiveDurationMs(pkg.durationMs, levels.turbo);
    const now = Date.now();
    const a: ActiveState = { id: pkg.id, cost: pkg.cost, endsAt: now + dur };

    setBalance((b) => b - pkg.cost);
    setActive(a);
    setMsLeft(dur);

    progress.value = 0;
    progress.value = withTiming(1, { duration: dur, easing: Easing.linear });

    tickRef.current = setInterval(() => {
      const left = Math.max(0, a.endsAt - Date.now());
      setMsLeft(left);
      if (left <= 0 && tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }, 100);

    finishRef.current = setTimeout(() => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      finishActive(a);
    }, dur);
  };

  const buyUpgrade = (u: Upgrade) => {
    const level = levels[u.id];
    if (level >= u.maxLevel) return;
    const cost = upgradeCost(u, level);
    if (balance < cost) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBalance((b) => b - cost);
    setLevels((l) => ({ ...l, [u.id]: l[u.id] + 1 }));
  };

  // ---- Animated styles ----
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

  const activePkg = active
    ? PACKAGES.find((p) => p.id === active.id) ?? null
    : null;
  const selectedEffPct = effectiveProfitPct(selected.profitPct, levels.yield);
  const selectedEffDur = effectiveDurationMs(selected.durationMs, levels.turbo);
  const selectedEffProfit = selected.cost * selectedEffPct;

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe} testID="game-screen">
        <View style={styles.loaderWrap}>
          <Text style={styles.loaderText}>Loading portfolio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID="game-screen">
      {/* HEADER */}
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
            {wasLucky ? "2×  " : ""}+{money(lastProfit)}
          </Animated.Text>
        </View>

        <View style={styles.pillRow}>
          {active && activePkg ? (
            <View style={styles.lockedPill} testID="locked-pill">
              <View style={styles.lockDot} />
              <Text style={styles.lockedText}>
                {money(active.cost)} locked · {activePkg.name}
              </Text>
            </View>
          ) : (
            <View style={styles.availPill}>
              <Text style={styles.availText}>Available to invest</Text>
            </View>
          )}

          {passiveRate(levels.passive) > 0 && (
            <View style={styles.passivePill} testID="passive-pill">
              <Text style={styles.passiveText}>
                +${passiveRate(levels.passive).toFixed(2)}/s
              </Text>
            </View>
          )}
        </View>

        {offlineGain > 0.01 && (
          <View style={styles.offlineBanner} testID="offline-banner">
            <Text style={styles.offlineText}>
              Welcome back — earned {money(offlineGain)} while away
            </Text>
            <Pressable
              onPress={() => setOfflineGain(0)}
              hitSlop={12}
              testID="offline-dismiss"
            >
              <Text style={styles.offlineDismiss}>OK</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PACKAGES */}
        <Text style={styles.sectionTitle}>INVESTMENT PACKAGES</Text>

        {PACKAGES.map((pkg) => {
          const affordable = balance >= pkg.cost;
          const isSelected = pkg.id === selectedId;
          const locked = isBusy;
          const disabled = locked || !affordable;
          const effPct = effectiveProfitPct(pkg.profitPct, levels.yield);
          const effDur = effectiveDurationMs(pkg.durationMs, levels.turbo);
          const projectedProfit = pkg.cost * effPct;
          const roi = `+${(effPct * 100).toFixed(0)}%`;

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
                <View
                  style={[
                    styles.cardIcon,
                    { backgroundColor: `${pkg.tint}22`, borderColor: pkg.tint },
                  ]}
                >
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
                      <Text style={styles.metaValue}>{fmtDuration(effDur)}</Text>
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

        {/* UPGRADES */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>UPGRADES</Text>

        {UPGRADES.map((u) => {
          const level = levels[u.id];
          const maxed = level >= u.maxLevel;
          const cost = upgradeCost(u, level);
          const affordable = balance >= cost && !maxed;

          return (
            <Pressable
              key={u.id}
              onPress={() => buyUpgrade(u)}
              disabled={!affordable}
              style={({ pressed }) => [
                styles.upgradeCard,
                !affordable && styles.upgradeCardDisabled,
                pressed && affordable && styles.cardPressed,
              ]}
              testID={`upgrade-${u.id}`}
            >
              <View style={styles.upgradeRow}>
                <View
                  style={[
                    styles.upgradeBadge,
                    { backgroundColor: `${u.tint}22`, borderColor: u.tint },
                  ]}
                >
                  <Text style={[styles.upgradeBadgeLevel, { color: u.tint }]}>
                    Lv {level}
                  </Text>
                </View>

                <View style={styles.upgradeMain}>
                  <Text style={styles.upgradeName}>{u.name}</Text>
                  <Text style={styles.upgradeDesc}>{u.description(level)}</Text>
                  <Text style={[styles.upgradeEffect, { color: u.tint }]}>
                    Current: {u.effect(level)}
                  </Text>
                </View>

                <View style={styles.upgradeCta}>
                  {maxed ? (
                    <View style={styles.maxedPill}>
                      <Text style={styles.maxedText}>MAX</Text>
                    </View>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.upgradeCost,
                          !affordable && styles.upgradeCostDim,
                        ]}
                        testID={`upgrade-cost-${u.id}`}
                      >
                        {money(cost)}
                      </Text>
                      <Text
                        style={[
                          styles.upgradeBuy,
                          !affordable && styles.upgradeBuyDim,
                        ]}
                      >
                        BUY
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* INVEST CTA */}
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
                  {fmtSecs(msLeft)} left
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
                  {selected.name} · +{money(selectedEffProfit)} in{" "}
                  {fmtDuration(selectedEffDur)}
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
  safe: { flex: 1, backgroundColor: C.bg },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderText: { color: C.textMuted, fontSize: 14, fontWeight: "700" },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
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
  balanceRow: { position: "relative", marginTop: 6 },
  balance: {
    color: C.text,
    fontSize: 40,
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
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
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
  lockedText: { color: C.loss, fontSize: 12, fontWeight: "700" },
  availPill: {
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
  passivePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,255,136,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.35)",
  },
  passiveText: {
    color: C.gain,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  offlineBanner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(0,255,136,0.10)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.35)",
  },
  offlineText: { color: C.gain, fontSize: 13, fontWeight: "700", flex: 1 },
  offlineDismiss: {
    color: C.gain,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    marginLeft: 12,
  },

  // Scroll
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Package cards
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
  cardLocked: { opacity: 0.55, borderColor: "rgba(255,77,77,0.25)" },
  cardPressed: { transform: [{ scale: 0.99 }] },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardIconText: { fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  cardMain: { flex: 1 },
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
  cardMetaRow: { flexDirection: "row" },
  metaCell: { flex: 1 },
  metaLabel: {
    color: C.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  metaValue: { color: C.text, fontSize: 14, fontWeight: "800" },
  metaGain: { color: C.gain },
  selectedGlow: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: C.accent,
  },

  // Upgrade cards
  upgradeCard: {
    backgroundColor: C.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  upgradeCardDisabled: { opacity: 0.55 },
  upgradeRow: { flexDirection: "row", alignItems: "center" },
  upgradeBadge: {
    minWidth: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    paddingHorizontal: 6,
  },
  upgradeBadgeLevel: { fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
  upgradeMain: { flex: 1, marginRight: 8 },
  upgradeName: { color: C.text, fontSize: 15, fontWeight: "800" },
  upgradeDesc: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  upgradeEffect: { fontSize: 11, fontWeight: "800", marginTop: 4 },
  upgradeCta: { alignItems: "flex-end" },
  upgradeCost: { color: C.text, fontSize: 14, fontWeight: "900" },
  upgradeCostDim: { color: C.textMuted },
  upgradeBuy: {
    color: C.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  upgradeBuyDim: { color: C.textMuted },
  maxedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,229,255,0.15)",
    borderWidth: 1,
    borderColor: C.accent,
  },
  maxedText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
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
  investBtnPressed: { transform: [{ scale: 0.98 }] },
  investProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,229,255,0.35)",
  },
  investContent: { alignItems: "center", justifyContent: "center" },
  investLabel: {
    color: "#001018",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  investLabelBusy: { color: C.accent },
  investLabelDisabled: { color: C.loss },
  investSub: {
    color: "#001018",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
    opacity: 0.75,
  },
  investSubBusy: { color: C.text, opacity: 0.85 },
  investSubDisabled: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
});
