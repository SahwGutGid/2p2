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
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSoundEngine } from "@/src/game/sounds";
import { useBackgroundMusic } from "@/src/game/music";

// ---------- P2P Dark Theme ----------
const C = {
  bg: "#0B1220",
  bgSoft: "#0F1830",
  panel: "#111B2E",
  panelElevated: "#16223A",
  accent: "#00E5FF",
  accentDeep: "#00B8D4",
  gain: "#00FF88",
  loss: "#FF4D4D",
  text: "#E6E6E6",
  textMuted: "#8A96AD",
  border: "#1E2A44",
};

// ---------- Packages ----------
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
  { id: "starter",  name: "Starter Bond",   tag: "Low risk",       cost: 10,   durationMs: 3000,  profitPct: 0.12, tint: "#5EE1B0" },
  { id: "growth",   name: "Growth Fund",    tag: "Medium",         cost: 50,   durationMs: 8000,  profitPct: 0.22, tint: "#00E5FF" },
  { id: "momentum", name: "Momentum Pool",  tag: "High",           cost: 200,  durationMs: 20000, profitPct: 0.45, tint: "#FFB84D" },
  { id: "whale",    name: "Whale Vault",    tag: "Very high risk", cost: 1000, durationMs: 60000, profitPct: 1.10, tint: "#FF6EC7" },
];

const CHEAPEST_COST = PACKAGES[0].cost;

// ---------- Upgrades ----------
type UpgradeId = "yield" | "turbo" | "passive" | "lucky" | "slots";
type Upgrade = {
  id: UpgradeId;
  name: string;
  description: string;
  effect: (level: number) => string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  tint: string;
};

const UPGRADES: Upgrade[] = [
  { id: "yield",   name: "Yield Boost",     description: "+7% profit multiplier per level",     effect: (l) => `+${(l * 7).toFixed(0)}% profit`,             baseCost: 25,  costGrowth: 1.65, maxLevel: 15, tint: "#00FF88" },
  { id: "turbo",   name: "Turbo Trades",    description: "-5% investment duration per level",   effect: (l) => `-${Math.min(70, l * 5).toFixed(0)}% time`,   baseCost: 40,  costGrowth: 1.7,  maxLevel: 14, tint: "#00E5FF" },
  { id: "passive", name: "Passive Yield",   description: "+$0.75/sec passive income per level", effect: (l) => `+$${(l * 0.75).toFixed(2)}/sec`,             baseCost: 80,  costGrowth: 1.55, maxLevel: 25, tint: "#FFB84D" },
  { id: "lucky",   name: "Lucky Streak",    description: "+3% chance for 2× profit per level",  effect: (l) => `${Math.min(60, l * 3).toFixed(0)}% x2`,      baseCost: 150, costGrowth: 1.8,  maxLevel: 20, tint: "#FF6EC7" },
  { id: "slots",   name: "Portfolio Slots", description: "+1 concurrent investment per level",  effect: (l) => `${l + 1} slot${l === 0 ? "" : "s"}`,         baseCost: 500, costGrowth: 3,    maxLevel: 4,  tint: "#00E5FF" },
];

const upgradeCost = (u: Upgrade, level: number) =>
  Math.floor(u.baseCost * Math.pow(u.costGrowth, level));

// ---------- Actives ----------
type ActiveInvestment = {
  runId: string;
  pkgId: string;
  cost: number;
  startedAt: number;
  endsAt: number;
};

// ---------- Save shape ----------
type SaveData = {
  v: 4;
  balance: number;
  selectedId: string;
  levels: Record<UpgradeId, number>;
  actives: ActiveInvestment[];
  lastSeenAt: number;
  musicEnabled: boolean;
  prestige: number;
  totalPrestiges: number;
};

const SAVE_KEY = "investmentIdle:v4";
const LEGACY_KEY_V3 = "investmentIdle:v3";
const LEGACY_KEY_V2 = "investmentIdle:v2";
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const BAILOUT_AMOUNT = 15;

// Prestige mechanic
const PRESTIGE_MIN_BALANCE = 10000;      // must earn $10K before first prestige
const PRESTIGE_BONUS_PER_POINT = 0.02;   // +2% profit multiplier per PP (permanent)
// PP earned this prestige = floor(sqrt(balance / 10000))
const computePrestigeGain = (balance: number) => {
  if (balance < PRESTIGE_MIN_BALANCE) return 0;
  return Math.floor(Math.sqrt(balance / PRESTIGE_MIN_BALANCE));
};

const defaultSave = (): SaveData => ({
  v: 4,
  balance: 100,
  selectedId: PACKAGES[0].id,
  levels: { yield: 0, turbo: 0, passive: 0, lucky: 0, slots: 0 },
  actives: [],
  lastSeenAt: Date.now(),
  musicEnabled: true,
  prestige: 0,
  totalPrestiges: 0,
});

// ---------- Helpers ----------
// Compact currency formatter: cents-precise under $10K, K/M/B/T/… above.
const UNITS: { v: number; s: string }[] = [
  { v: 1e33, s: "D" },
  { v: 1e30, s: "N" },
  { v: 1e27, s: "Oc" },
  { v: 1e24, s: "Sp" },
  { v: 1e21, s: "Sx" },
  { v: 1e18, s: "Qi" },
  { v: 1e15, s: "Qa" },
  { v: 1e12, s: "T" },
  { v: 1e9,  s: "B" },
  { v: 1e6,  s: "M" },
  { v: 1e3,  s: "K" },
];
const money = (n: number) => {
  if (!isFinite(n)) return "$∞";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 10000) return `${sign}$${abs.toFixed(2)}`;
  for (const u of UNITS) {
    if (abs >= u.v) return `${sign}$${(abs / u.v).toFixed(2)}${u.s}`;
  }
  return `${sign}$${abs.toFixed(2)}`;
};
const fmtDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
};
const fmtSecs = (ms: number) =>
  ms >= 60000 ? fmtDuration(ms) : `${(ms / 1000).toFixed(1)}s`;

const prestigeMultiplier = (prestige: number) => 1 + PRESTIGE_BONUS_PER_POINT * prestige;
const effectiveProfitPct = (base: number, yieldLevel: number, prestige: number = 0) =>
  base * (1 + 0.07 * yieldLevel) * prestigeMultiplier(prestige);
const effectiveDurationMs = (base: number, turboLevel: number) => {
  const reduction = Math.min(0.7, 0.05 * turboLevel);
  return Math.round(base * (1 - reduction));
};
const passiveRate = (level: number) => 0.75 * level;
const luckyChance = (level: number) => Math.min(0.6, 0.03 * level);
const slotCount = (level: number) => 1 + level;

// Accelerate: reduce remaining by 6% (min 200ms, max 400ms) per tap
const ACCELERATE_COOLDOWN_MS = 80;

let runIdCounter = 0;
const newRunId = () => `r${Date.now()}-${++runIdCounter}`;

export default function Index() {
  const sound = useSoundEngine();

  const [ready, setReady] = useState(false);
  const [balance, setBalance] = useState(100);
  const [selectedId, setSelectedId] = useState(PACKAGES[0].id);
  const [levels, setLevels] = useState<Record<UpgradeId, number>>({
    yield: 0, turbo: 0, passive: 0, lucky: 0, slots: 0,
  });
  const [actives, setActives] = useState<ActiveInvestment[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [lastProfit, setLastProfit] = useState(0);
  const [wasLucky, setWasLucky] = useState(false);
  const [offlineGain, setOfflineGain] = useState<number>(0);
  const [bailoutNotice, setBailoutNotice] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [prestige, setPrestige] = useState(0);
  const [totalPrestiges, setTotalPrestiges] = useState(0);
  const [prestigeArmed, setPrestigeArmed] = useState(false);
  const [prestigeCelebrate, setPrestigeCelebrate] = useState<number>(0);

  // Smooth balance counter (RAF-based, cross-platform safe)
  const [displayBalance, setDisplayBalance] = useState(100);
  const rafRef = useRef<number | null>(null);
  const displayStartRef = useRef({ from: 100, to: 100, start: 0 });

  useEffect(() => {
    displayStartRef.current = {
      from: displayBalance,
      to: balance,
      start: (typeof performance !== "undefined" ? performance.now() : Date.now()),
    };
    const duration = 550;
    const tick = (t: number) => {
      const { from, to, start } = displayStartRef.current;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayBalance(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  // Background music (respects toggle)
  const music = useBackgroundMusic(musicEnabled);

  // Reanimated values
  const floatY = useSharedValue(0);
  const floatOpacity = useSharedValue(0);
  const balancePulse = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const flash = useSharedValue(0);
  const selectedPulse = useSharedValue(1);

  useEffect(() => {
    selectedPulse.value = withRepeat(
      withSequence(
        withTiming(1.015, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [selectedPulse]);

  // Refs
  const finishRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nowTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passiveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAccelTapRef = useRef<number>(0);

  // ---- Persistence ----
  const saveState = useCallback(async (data: Partial<SaveData>) => {
    try {
      const merged: SaveData = {
        v: 4, balance, selectedId, levels, actives, musicEnabled,
        prestige, totalPrestiges,
        lastSeenAt: Date.now(),
        ...data,
      };
      await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(merged));
    } catch {}
  }, [balance, selectedId, levels, actives, musicEnabled, prestige, totalPrestiges]);

  // Load (migrate v2/v3 → v4 if needed)
  useEffect(() => {
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(SAVE_KEY);
        if (!raw) {
          // Try v3 first
          const legacy3 = await AsyncStorage.getItem(LEGACY_KEY_V3);
          if (legacy3) {
            try {
              const p = JSON.parse(legacy3);
              raw = JSON.stringify({
                ...defaultSave(),
                balance: p.balance ?? 100,
                selectedId: p.selectedId ?? PACKAGES[0].id,
                levels: { ...defaultSave().levels, ...(p.levels ?? {}) },
                actives: (p.actives ?? []) as ActiveInvestment[],
                lastSeenAt: p.lastSeenAt ?? Date.now(),
                musicEnabled: p.musicEnabled ?? true,
              });
            } catch {}
          } else {
            const legacy = await AsyncStorage.getItem(LEGACY_KEY_V2);
            if (legacy) {
              try {
                const p = JSON.parse(legacy);
                raw = JSON.stringify({
                  ...defaultSave(),
                  balance: p.balance ?? 100,
                  selectedId: p.selectedId ?? PACKAGES[0].id,
                  levels: { ...defaultSave().levels, ...(p.levels ?? {}) },
                  actives: p.active ? [{ runId: newRunId(), pkgId: p.active.id, cost: p.active.cost, startedAt: p.active.endsAt - 3000, endsAt: p.active.endsAt }] : [],
                  lastSeenAt: p.lastSeenAt ?? Date.now(),
                });
              } catch {}
            }
          }
        }

        const nowMs = Date.now();
        let saved: SaveData = defaultSave();
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SaveData>;
          saved = {
            ...defaultSave(),
            ...parsed,
            levels: { ...defaultSave().levels, ...(parsed.levels ?? {}) },
            actives: (parsed.actives ?? []) as ActiveInvestment[],
          };
        }

        // Passive offline earnings
        const elapsed = Math.min(OFFLINE_CAP_MS, Math.max(0, nowMs - (saved.lastSeenAt ?? nowMs)));
        const passiveEarned = (elapsed / 1000) * passiveRate(saved.levels.passive ?? 0);

        // Settle any actives that would have completed while away
        let payout = 0;
        const remaining: ActiveInvestment[] = [];
        for (const a of saved.actives) {
          if (nowMs >= a.endsAt) {
            const pkg = PACKAGES.find((p) => p.id === a.pkgId);
            if (pkg) {
              const p = a.cost * effectiveProfitPct(pkg.profitPct, saved.levels.yield ?? 0, saved.prestige ?? 0);
              payout += a.cost + p;
            } else {
              payout += a.cost;
            }
          } else {
            remaining.push(a);
          }
        }

        const nextBalance = saved.balance + passiveEarned + payout;
        setBalance(nextBalance);
        setDisplayBalance(nextBalance);
        displayStartRef.current = { from: nextBalance, to: nextBalance, start: 0 };
        setSelectedId(saved.selectedId ?? PACKAGES[0].id);
        setLevels(saved.levels);
        setActives(remaining);
        setMusicEnabled(saved.musicEnabled ?? true);
        setPrestige(saved.prestige ?? 0);
        setTotalPrestiges(saved.totalPrestiges ?? 0);
        if (passiveEarned > 0.01) setOfflineGain(passiveEarned);

        // Schedule completions for remaining actives
        for (const a of remaining) {
          const left = Math.max(0, a.endsAt - Date.now());
          finishRefs.current[a.runId] = setTimeout(() => completeInvestment(a.runId), left);
        }
      } catch {}
      finally { setReady(true); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save
  useEffect(() => {
    if (!ready) return;
    saveState({});
  }, [ready, balance, selectedId, levels, actives, musicEnabled, prestige, totalPrestiges, saveState]);

  // Save when backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s !== "active") saveState({}); });
    return () => sub.remove();
  }, [saveState]);

  // Passive income tick
  useEffect(() => {
    if (passiveRef.current) { clearInterval(passiveRef.current); passiveRef.current = null; }
    const rate = passiveRate(levels.passive);
    if (rate <= 0) return;
    passiveRef.current = setInterval(() => { setBalance((b) => b + rate); }, 1000);
    return () => {
      if (passiveRef.current) { clearInterval(passiveRef.current); passiveRef.current = null; }
    };
  }, [levels.passive]);

  // Global `now` ticker while any investment is active (for progress + countdown display)
  useEffect(() => {
    if (nowTickerRef.current) { clearInterval(nowTickerRef.current); nowTickerRef.current = null; }
    if (actives.length === 0) return;
    nowTickerRef.current = setInterval(() => setNow(Date.now()), 100);
    return () => {
      if (nowTickerRef.current) { clearInterval(nowTickerRef.current); nowTickerRef.current = null; }
    };
  }, [actives.length]);

  // Anti-soft-lock bailout
  useEffect(() => {
    if (!ready) return;
    if (actives.length > 0) return;
    if (passiveRate(levels.passive) > 0) return;
    if (balance >= CHEAPEST_COST) return;
    const t = setTimeout(() => {
      setBalance((b) => (b < CHEAPEST_COST ? BAILOUT_AMOUNT : b));
      setBailoutNotice(true);
      sound.play("upgrade");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [balance, actives.length, levels.passive, ready, sound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(finishRefs.current).forEach(clearTimeout);
      finishRefs.current = {};
      if (nowTickerRef.current) clearInterval(nowTickerRef.current);
      if (passiveRef.current) clearInterval(passiveRef.current);
    };
  }, []);

  // ---- Actions ----
  const completeInvestment = useCallback((runId: string) => {
    setActives((list) => {
      const a = list.find((x) => x.runId === runId);
      if (!a) return list;
      const pkg = PACKAGES.find((p) => p.id === a.pkgId);
      if (!pkg) return list.filter((x) => x.runId !== runId);

      const basePct = effectiveProfitPct(pkg.profitPct, levels.yield, prestige);
      let profit = a.cost * basePct;
      const lucky = Math.random() < luckyChance(levels.lucky);
      if (lucky) profit *= 2;

      setBalance((b) => b + a.cost + profit);
      setLastProfit(profit);
      setWasLucky(lucky);

      sound.play("investComplete");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      balancePulse.value = withSequence(
        withTiming(1.1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) })
      );
      floatY.value = 0;
      floatOpacity.value = 1;
      floatY.value = withTiming(-100, { duration: 1300, easing: Easing.out(Easing.cubic) });
      floatOpacity.value = withDelay(700, withTiming(0, { duration: 600 }));

      delete finishRefs.current[runId];
      return list.filter((x) => x.runId !== runId);
    });
  }, [levels.yield, levels.lucky, prestige, sound, balancePulse, floatY, floatOpacity]);

  const doShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  };

  const kickMusicOnce = () => { music.kick(); };

  const slots = slotCount(levels.slots);
  const hasFreeSlot = actives.length < slots;
  const selected = PACKAGES.find((p) => p.id === selectedId) ?? PACKAGES[0];
  const canAffordSelected = balance >= selected.cost;
  const canInvest = hasFreeSlot && canAffordSelected;

  const invest = () => {
    kickMusicOnce();
    if (!canInvest) {
      sound.play("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      doShake();
      return;
    }
    sound.play("investStart");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    flash.value = 0.55;
    flash.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });

    const pkg = selected;
    const dur = effectiveDurationMs(pkg.durationMs, levels.turbo);
    const startedAt = Date.now();
    const a: ActiveInvestment = {
      runId: newRunId(),
      pkgId: pkg.id,
      cost: pkg.cost,
      startedAt,
      endsAt: startedAt + dur,
    };
    setBalance((b) => b - pkg.cost);
    setActives((list) => [...list, a]);
    finishRefs.current[a.runId] = setTimeout(() => completeInvestment(a.runId), dur);
  };

  const accelerate = (runId: string) => {
    kickMusicOnce();
    const nowMs = Date.now();
    if (nowMs - lastAccelTapRef.current < ACCELERATE_COOLDOWN_MS) return;
    lastAccelTapRef.current = nowMs;

    setActives((list) => {
      const idx = list.findIndex((x) => x.runId === runId);
      if (idx === -1) return list;
      const a = list[idx];
      const remaining = Math.max(0, a.endsAt - nowMs);
      if (remaining <= 0) return list;
      const reduction = Math.max(200, Math.min(400, remaining * 0.06));
      const newEndsAt = Math.max(nowMs, a.endsAt - reduction);
      const updated: ActiveInvestment = { ...a, endsAt: newEndsAt };
      // reschedule
      if (finishRefs.current[a.runId]) clearTimeout(finishRefs.current[a.runId]);
      finishRefs.current[a.runId] = setTimeout(() => completeInvestment(a.runId), Math.max(0, newEndsAt - Date.now()));
      const copy = [...list];
      copy[idx] = updated;
      return copy;
    });

    sound.play("click");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const buyUpgrade = (u: Upgrade) => {
    kickMusicOnce();
    const level = levels[u.id];
    if (level >= u.maxLevel) return;
    const cost = upgradeCost(u, level);
    if (balance < cost) {
      sound.play("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      doShake();
      return;
    }
    sound.play("upgrade");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setBalance((b) => b - cost);
    setLevels((l) => ({ ...l, [u.id]: l[u.id] + 1 }));
  };

  const toggleMusic = () => {
    setMusicEnabled((v) => {
      const next = !v;
      // if enabling, ensure the audio context is unlocked
      if (next) music.kick();
      return next;
    });
    Haptics.selectionAsync().catch(() => {});
  };

  // ---- Prestige ----
  const prestigeGainAvailable = computePrestigeGain(balance);
  const canPrestige = prestigeGainAvailable > 0;

  const doPrestige = () => {
    kickMusicOnce();
    if (!canPrestige) {
      sound.play("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      doShake();
      return;
    }
    if (!prestigeArmed) {
      setPrestigeArmed(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // auto-disarm after 5s if not confirmed
      setTimeout(() => setPrestigeArmed(false), 5000);
      return;
    }
    // Confirm: reset run, keep prestige gains
    const gain = prestigeGainAvailable;
    // Clear all running timers
    Object.values(finishRefs.current).forEach(clearTimeout);
    finishRefs.current = {};
    setActives([]);
    setBalance(100);
    setDisplayBalance(100);
    displayStartRef.current = { from: 100, to: 100, start: 0 };
    setSelectedId(PACKAGES[0].id);
    setLevels({ yield: 0, turbo: 0, passive: 0, lucky: 0, slots: 0 });
    setPrestige((p) => p + gain);
    setTotalPrestiges((t) => t + 1);
    setPrestigeArmed(false);
    setPrestigeCelebrate(gain);
    setTimeout(() => setPrestigeCelebrate(0), 4500);

    sound.play("upgrade");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    balancePulse.value = withSequence(
      withTiming(1.18, { duration: 220, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 320, easing: Easing.inOut(Easing.quad) })
    );
  };

  // ---- Animated styles ----
  const floatStyle = useAnimatedStyle(() => ({
    opacity: floatOpacity.value,
    transform: [{ translateY: floatY.value }],
  }));
  const balanceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: balancePulse.value }, { translateX: shakeX.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const ctaShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const selectedPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: selectedPulse.value }] }));

  const selectedEffPct = effectiveProfitPct(selected.profitPct, levels.yield, prestige);
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

  const ctaLabel = !hasFreeSlot
    ? "All slots busy"
    : !canAffordSelected
    ? "Insufficient Balance"
    : `Invest ${money(selected.cost)}`;
  const ctaSub = !hasFreeSlot
    ? `Unlock more via Portfolio Slots (Lv ${levels.slots}/4)`
    : !canAffordSelected
    ? `Need ${money(selected.cost)} for ${selected.name}`
    : `${selected.name} · +${money(selectedEffProfit)} in ${fmtDuration(selectedEffDur)}`;

  return (
    <SafeAreaView style={styles.safe} testID="game-screen">
      {/* Flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.flashOverlay, flashStyle]}
        testID="invest-flash"
      />

      {/* HEADER */}
      <LinearGradient
        colors={[C.bgSoft, C.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <Text style={styles.balanceLabel}>PORTFOLIO BALANCE</Text>
          <Pressable
            onPress={toggleMusic}
            hitSlop={12}
            style={styles.musicToggle}
            testID="music-toggle"
          >
            <Text style={styles.musicToggleText}>
              {musicEnabled ? "MUSIC ON" : "MUSIC OFF"}
            </Text>
          </Pressable>
        </View>

        <Animated.View style={[styles.balanceRow, balanceStyle]}>
          <Text style={styles.balance} testID="balance-value">
            {money(displayBalance)}
          </Text>
          <Animated.Text
            style={[styles.floatingProfit, floatStyle]}
            pointerEvents="none"
            testID="floating-profit"
          >
            {wasLucky ? "2×  " : ""}+{money(lastProfit)}
          </Animated.Text>
        </Animated.View>

        <View style={styles.pillRow}>
          <View style={styles.slotPill} testID="slot-pill">
            <Text style={styles.slotPillText}>
              Slots {actives.length}/{slots}
            </Text>
          </View>

          {prestige > 0 && (
            <View style={styles.prestigePill} testID="prestige-pill">
              <Text style={styles.prestigePillText}>
                ★ {prestige} PP · +{(prestige * PRESTIGE_BONUS_PER_POINT * 100).toFixed(0)}%
              </Text>
            </View>
          )}

          {actives.length === 0 && (
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
          <View style={styles.banner} testID="offline-banner">
            <Text style={styles.bannerText}>
              Welcome back — earned {money(offlineGain)} while away
            </Text>
            <Pressable onPress={() => setOfflineGain(0)} hitSlop={12}>
              <Text style={styles.bannerDismiss}>OK</Text>
            </Pressable>
          </View>
        )}

        {bailoutNotice && (
          <View style={[styles.banner, styles.bannerWarn]} testID="bailout-banner">
            <Text style={[styles.bannerText, { color: C.accent }]}>
              Stimulus received — {money(BAILOUT_AMOUNT)} added to keep you trading
            </Text>
            <Pressable onPress={() => setBailoutNotice(false)} hitSlop={12}>
              <Text style={[styles.bannerDismiss, { color: C.accent }]}>OK</Text>
            </Pressable>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ACTIVE INVESTMENTS */}
        {actives.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ACTIVE INVESTMENTS</Text>
            {actives.map((a) => {
              const pkg = PACKAGES.find((p) => p.id === a.pkgId);
              if (!pkg) return null;
              const total = a.endsAt - a.startedAt;
              const remaining = Math.max(0, a.endsAt - now);
              const progress = total > 0 ? Math.min(1, 1 - remaining / total) : 1;
              const effPct = effectiveProfitPct(pkg.profitPct, levels.yield, prestige);
              const projected = a.cost * effPct;
              return (
                <View key={a.runId} style={styles.activeCard} testID={`active-${a.runId}`}>
                  <View style={styles.activeHeaderRow}>
                    <View
                      style={[
                        styles.activeIcon,
                        { backgroundColor: `${pkg.tint}22`, borderColor: pkg.tint },
                      ]}
                    >
                      <Text style={[styles.activeIconText, { color: pkg.tint }]}>
                        +{(effPct * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeName}>{pkg.name}</Text>
                      <Text style={styles.activeMeta}>
                        {money(a.cost)} → +{money(projected)}
                      </Text>
                    </View>
                    <Text style={styles.activeCountdown}>{fmtSecs(remaining)}</Text>
                  </View>

                  <View style={styles.activeBarTrack}>
                    <LinearGradient
                      colors={[C.accent, C.accentDeep]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.activeBarFill, { width: `${progress * 100}%` }]}
                    />
                  </View>

                  <Pressable
                    onPress={() => accelerate(a.runId)}
                    style={({ pressed }) => [
                      styles.accelerateBtn,
                      pressed && styles.accelerateBtnPressed,
                    ]}
                    testID={`accelerate-${a.runId}`}
                  >
                    <LinearGradient
                      colors={["rgba(0,229,255,0.20)", "rgba(0,229,255,0.05)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.accelerateText}>ACCELERATE</Text>
                    <Text style={styles.accelerateHint}>Tap to shave time</Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        {/* PACKAGES */}
        <Text style={[styles.sectionTitle, actives.length > 0 && { marginTop: 20 }]}>
          INVESTMENT PACKAGES
        </Text>

        {PACKAGES.map((pkg) => {
          const affordable = balance >= pkg.cost;
          const isSelected = pkg.id === selectedId;
          const disabled = !affordable;
          const effPct = effectiveProfitPct(pkg.profitPct, levels.yield, prestige);
          const effDur = effectiveDurationMs(pkg.durationMs, levels.turbo);
          const projectedProfit = pkg.cost * effPct;
          const roi = `+${(effPct * 100).toFixed(0)}%`;

          return (
            <Animated.View
              key={pkg.id}
              style={isSelected ? selectedPulseStyle : undefined}
            >
              <Pressable
                disabled={disabled}
                onPress={() => {
                  kickMusicOnce();
                  sound.play("click");
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedId(pkg.id);
                }}
                style={({ pressed }) => [
                  styles.card,
                  isSelected && styles.cardSelected,
                  !affordable && styles.cardLocked,
                  pressed && !disabled && styles.cardPressed,
                ]}
                testID={`package-${pkg.id}`}
              >
                {isSelected && !disabled && (
                  <LinearGradient
                    colors={["rgba(0,229,255,0.14)", "rgba(0,229,255,0)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                )}
                <View style={styles.cardRow}>
                  <View style={[styles.cardIcon, { backgroundColor: `${pkg.tint}22`, borderColor: pkg.tint }]}>
                    <Text style={[styles.cardIconText, { color: pkg.tint }]}>{roi}</Text>
                  </View>
                  <View style={styles.cardMain}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle}>{pkg.name}</Text>
                      {!affordable ? (
                        <View style={styles.badgeLoss}><Text style={styles.badgeLossText}>LOCKED</Text></View>
                      ) : (
                        <View style={styles.badgeTag}><Text style={styles.badgeTagText}>{pkg.tag}</Text></View>
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
                        <Text style={[styles.metaValue, styles.metaGain]}>+{money(projectedProfit)}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                {isSelected && !disabled && (
                  <View style={styles.selectedGlow} pointerEvents="none" />
                )}
              </Pressable>
            </Animated.View>
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
              style={({ pressed }) => [
                styles.upgradeCard,
                !affordable && !maxed && styles.upgradeCardDim,
                pressed && affordable && styles.cardPressed,
                maxed && styles.upgradeCardMaxed,
              ]}
              testID={`upgrade-${u.id}`}
            >
              <View style={styles.upgradeRow}>
                <View style={[styles.upgradeBadge, { backgroundColor: `${u.tint}22`, borderColor: u.tint }]}>
                  <Text style={[styles.upgradeBadgeLevel, { color: u.tint }]}>Lv {level}</Text>
                </View>
                <View style={styles.upgradeMain}>
                  <Text style={styles.upgradeName}>{u.name}</Text>
                  <Text style={styles.upgradeDesc}>{u.description}</Text>
                  <Text style={[styles.upgradeEffect, { color: u.tint }]}>
                    Current: {u.effect(level)}
                  </Text>
                </View>
                <View style={styles.upgradeCta}>
                  {maxed ? (
                    <View style={styles.maxedPill}><Text style={styles.maxedText}>MAX</Text></View>
                  ) : (
                    <>
                      <Text
                        style={[styles.upgradeCost, !affordable && styles.upgradeCostDim]}
                        testID={`upgrade-cost-${u.id}`}
                      >
                        {money(cost)}
                      </Text>
                      <Text style={[styles.upgradeBuy, !affordable && styles.upgradeBuyDim]}>BUY</Text>
                    </>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        {/* PRESTIGE */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>PRESTIGE</Text>

        <View style={styles.prestigeCard} testID="prestige-card">
          <LinearGradient
            colors={["rgba(0,229,255,0.16)", "rgba(0,229,255,0.03)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.prestigeHeader}>
            <View>
              <Text style={styles.prestigeTitle}>Cash Out</Text>
              <Text style={styles.prestigeSubtitle}>
                Reset run · keep permanent profit boosts
              </Text>
            </View>
            <View style={styles.prestigeStarWrap}>
              <Text style={styles.prestigeStar}>★</Text>
              <Text style={styles.prestigeStarLabel}>
                {prestige} PP
              </Text>
            </View>
          </View>

          <View style={styles.prestigeStatsRow}>
            <View style={styles.prestigeStatCell}>
              <Text style={styles.prestigeStatLabel}>Current bonus</Text>
              <Text style={styles.prestigeStatValue}>
                +{(prestige * PRESTIGE_BONUS_PER_POINT * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.prestigeStatDivider} />
            <View style={styles.prestigeStatCell}>
              <Text style={styles.prestigeStatLabel}>Cash-outs</Text>
              <Text style={styles.prestigeStatValue}>{totalPrestiges}</Text>
            </View>
            <View style={styles.prestigeStatDivider} />
            <View style={styles.prestigeStatCell}>
              <Text style={styles.prestigeStatLabel}>Available now</Text>
              <Text
                style={[
                  styles.prestigeStatValue,
                  { color: canPrestige ? C.gain : C.textMuted },
                ]}
                testID="prestige-available"
              >
                +{prestigeGainAvailable} PP
              </Text>
            </View>
          </View>

          {!canPrestige && (
            <Text style={styles.prestigeHint}>
              Reach {money(PRESTIGE_MIN_BALANCE)} balance to unlock your first cash-out.
            </Text>
          )}

          <Pressable
            onPress={doPrestige}
            style={({ pressed }) => [
              styles.prestigeBtn,
              !canPrestige && styles.prestigeBtnDisabled,
              prestigeArmed && styles.prestigeBtnArmed,
              pressed && canPrestige && { transform: [{ scale: 0.98 }] },
            ]}
            testID="prestige-button"
          >
            <Text
              style={[
                styles.prestigeBtnText,
                !canPrestige && { color: C.textMuted },
                prestigeArmed && { color: "#001018" },
              ]}
              testID="prestige-button-label"
            >
              {!canPrestige
                ? "PRESTIGE LOCKED"
                : prestigeArmed
                ? `TAP AGAIN TO CONFIRM (+${prestigeGainAvailable} PP)`
                : `CASH OUT FOR +${prestigeGainAvailable} PP`}
            </Text>
            {canPrestige && !prestigeArmed && (
              <Text style={styles.prestigeBtnSub}>
                Permanent +{(prestigeGainAvailable * PRESTIGE_BONUS_PER_POINT * 100).toFixed(0)}% profit boost
              </Text>
            )}
          </Pressable>

          {prestigeCelebrate > 0 && (
            <View style={styles.prestigeCelebrateBanner} testID="prestige-celebrate">
              <Text style={styles.prestigeCelebrateText}>
                +{prestigeCelebrate} PP earned — welcome to run #{totalPrestiges}!
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* CTA */}
      <View style={styles.ctaBar}>
        <Animated.View style={ctaShakeStyle}>
          <Pressable
            onPress={invest}
            style={({ pressed }) => [
              styles.investBtn,
              !canInvest && styles.investBtnDisabled,
              pressed && canInvest && styles.investBtnPressed,
            ]}
            testID="invest-button"
          >
            {canInvest && (
              <LinearGradient
                colors={[C.accent, C.accentDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            )}
            <View style={styles.investContent}>
              <Text
                style={[
                  styles.investLabel,
                  !canInvest && styles.investLabelDisabled,
                ]}
                testID="invest-label"
              >
                {ctaLabel}
              </Text>
              <Text
                style={[
                  styles.investSub,
                  !canInvest && styles.investSubDisabled,
                ]}
              >
                {ctaSub}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flashOverlay: { backgroundColor: C.accent, zIndex: 1 },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderText: { color: C.textMuted, fontSize: 14, fontWeight: "700" },

  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTopRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  balanceLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 2,
  },
  musicToggle: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
  },
  musicToggleText: {
    color: C.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.8,
  },
  balanceRow: { position: "relative", marginTop: 6 },
  balance: { color: C.text, fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  floatingProfit: {
    position: "absolute", right: 0, top: 0,
    color: C.gain, fontSize: 20, fontWeight: "900",
  },
  pillRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: 12, gap: 8, flexWrap: "wrap",
  },
  slotPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(0,229,255,0.12)", borderWidth: 1, borderColor: C.accent,
  },
  slotPillText: { color: C.accent, fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  availPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(0,229,255,0.10)", borderWidth: 1, borderColor: "rgba(0,229,255,0.35)",
  },
  availText: { color: C.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  passivePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(0,255,136,0.12)", borderWidth: 1, borderColor: "rgba(0,255,136,0.35)",
  },
  passiveText: { color: C.gain, fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },

  banner: {
    marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(0,255,136,0.10)", borderWidth: 1, borderColor: "rgba(0,255,136,0.35)",
  },
  bannerWarn: { backgroundColor: "rgba(0,229,255,0.10)", borderColor: "rgba(0,229,255,0.35)" },
  bannerText: { color: C.gain, fontSize: 13, fontWeight: "700", flex: 1 },
  bannerDismiss: { color: C.gain, fontSize: 13, fontWeight: "900", letterSpacing: 1, marginLeft: 12 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: {
    color: C.textMuted, fontSize: 11, fontWeight: "700",
    letterSpacing: 2, marginBottom: 12, marginLeft: 4,
  },

  // Active investment card
  activeCard: {
    backgroundColor: C.panelElevated, borderRadius: 20,
    borderWidth: 1, borderColor: C.accent,
    padding: 14, marginBottom: 12, overflow: "hidden",
    shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  activeHeaderRow: { flexDirection: "row", alignItems: "center" },
  activeIcon: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  activeIconText: { fontSize: 12, fontWeight: "900" },
  activeName: { color: C.text, fontSize: 15, fontWeight: "800" },
  activeMeta: { color: C.gain, fontSize: 12, fontWeight: "700", marginTop: 2 },
  activeCountdown: { color: C.accent, fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  activeBarTrack: {
    height: 8, borderRadius: 999, backgroundColor: C.panel, marginTop: 12,
    overflow: "hidden", borderWidth: 1, borderColor: C.border,
  },
  activeBarFill: { height: "100%", borderRadius: 999 },
  accelerateBtn: {
    marginTop: 12, height: 48, borderRadius: 14,
    borderWidth: 1, borderColor: C.accent, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  accelerateBtnPressed: { transform: [{ scale: 0.97 }] },
  accelerateText: { color: C.accent, fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },
  accelerateHint: { color: C.textMuted, fontSize: 10, fontWeight: "700", marginTop: 1 },

  // Package cards
  card: {
    backgroundColor: C.panel, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 12, position: "relative", overflow: "hidden",
  },
  cardSelected: {
    borderColor: C.accent, borderWidth: 2,
    backgroundColor: C.panelElevated,
    shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  cardLocked: { opacity: 0.55, borderColor: "rgba(255,77,77,0.25)" },
  cardPressed: { transform: [{ scale: 0.99 }] },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardIcon: {
    width: 56, height: 56, borderRadius: 16, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  cardIconText: { fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  cardMain: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: "800", flexShrink: 1, marginRight: 8 },
  badgeTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: "rgba(0,229,255,0.08)", borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(0,229,255,0.25)",
  },
  badgeTagText: { color: C.accent, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  badgeLoss: {
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: "rgba(255,77,77,0.10)", borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(255,77,77,0.35)",
  },
  badgeLossText: { color: C.loss, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  cardMetaRow: { flexDirection: "row" },
  metaCell: { flex: 1 },
  metaLabel: {
    color: C.textMuted, fontSize: 10, fontWeight: "700",
    letterSpacing: 0.5, marginBottom: 2, textTransform: "uppercase",
  },
  metaValue: { color: C.text, fontSize: 14, fontWeight: "800" },
  metaGain: { color: C.gain },
  selectedGlow: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: C.accent,
  },

  // Upgrade cards
  upgradeCard: {
    backgroundColor: C.panel, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  upgradeCardDim: { opacity: 0.6 },
  upgradeCardMaxed: { borderColor: C.accent, backgroundColor: C.panelElevated },
  upgradeRow: { flexDirection: "row", alignItems: "center" },
  upgradeBadge: {
    minWidth: 48, height: 48, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginRight: 12, paddingHorizontal: 6,
  },
  upgradeBadgeLevel: { fontSize: 13, fontWeight: "900", letterSpacing: 0.3 },
  upgradeMain: { flex: 1, marginRight: 8 },
  upgradeName: { color: C.text, fontSize: 15, fontWeight: "800" },
  upgradeDesc: { color: C.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  upgradeEffect: { fontSize: 11, fontWeight: "800", marginTop: 4 },
  upgradeCta: { alignItems: "flex-end" },
  upgradeCost: { color: C.text, fontSize: 14, fontWeight: "900" },
  upgradeCostDim: { color: C.textMuted },
  upgradeBuy: {
    color: C.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 4,
  },
  upgradeBuyDim: { color: C.textMuted },
  maxedPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: "rgba(0,229,255,0.15)", borderWidth: 1, borderColor: C.accent,
  },
  maxedText: { color: C.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  // CTA
  ctaBar: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
  },
  investBtn: {
    height: 76, borderRadius: 20, backgroundColor: C.accent,
    overflow: "hidden", justifyContent: "center", alignItems: "center",
    shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  investBtnDisabled: {
    backgroundColor: C.panelElevated, borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)", shadowOpacity: 0,
  },
  investBtnPressed: { transform: [{ scale: 0.98 }] },
  investContent: { alignItems: "center", justifyContent: "center" },
  investLabel: { color: "#001018", fontSize: 20, fontWeight: "900", letterSpacing: 0.3 },
  investLabelDisabled: { color: C.loss },
  investSub: { color: "#001018", fontSize: 12, fontWeight: "700", marginTop: 2, opacity: 0.8 },
  investSubDisabled: { color: C.textMuted, opacity: 1 },

  // Prestige
  prestigePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(255,214,79,0.15)", borderWidth: 1, borderColor: "#FFD54F",
  },
  prestigePillText: {
    color: "#FFD54F", fontSize: 12, fontWeight: "900", letterSpacing: 0.3,
  },
  prestigeCard: {
    backgroundColor: C.panelElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.accent,
    padding: 16,
    overflow: "hidden",
    shadowColor: C.accent,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  prestigeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  prestigeTitle: {
    color: C.text, fontSize: 18, fontWeight: "900", letterSpacing: 0.3,
  },
  prestigeSubtitle: {
    color: C.textMuted, fontSize: 12, fontWeight: "600", marginTop: 2,
  },
  prestigeStarWrap: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: "#FFD54F",
    backgroundColor: "rgba(255,214,79,0.1)",
  },
  prestigeStar: { color: "#FFD54F", fontSize: 20, fontWeight: "900", lineHeight: 22 },
  prestigeStarLabel: { color: "#FFD54F", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  prestigeStatsRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border,
  },
  prestigeStatCell: { flex: 1, alignItems: "center" },
  prestigeStatDivider: { width: 1, height: 28, backgroundColor: C.border },
  prestigeStatLabel: {
    color: C.textMuted, fontSize: 10, fontWeight: "700",
    letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3,
  },
  prestigeStatValue: { color: C.text, fontSize: 16, fontWeight: "900" },
  prestigeHint: {
    color: C.textMuted, fontSize: 12, fontWeight: "600",
    marginTop: 14, textAlign: "center",
  },
  prestigeBtn: {
    marginTop: 16, height: 56, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,229,255,0.15)",
    borderWidth: 1, borderColor: C.accent, overflow: "hidden",
  },
  prestigeBtnDisabled: {
    backgroundColor: C.panel, borderColor: C.border,
  },
  prestigeBtnArmed: {
    backgroundColor: C.accent, borderColor: C.accent,
  },
  prestigeBtnText: {
    color: C.accent, fontSize: 14, fontWeight: "900", letterSpacing: 1.2,
  },
  prestigeBtnSub: {
    color: C.gain, fontSize: 11, fontWeight: "700", marginTop: 2,
  },
  prestigeCelebrateBanner: {
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(255,214,79,0.15)",
    borderWidth: 1, borderColor: "#FFD54F",
    alignItems: "center",
  },
  prestigeCelebrateText: {
    color: "#FFD54F", fontSize: 13, fontWeight: "800",
  },
});
