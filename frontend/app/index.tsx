import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import {
  computeRank,
  deriveTreeEffects,
  LEGACY_UNLOCK_THRESHOLD,
  LEGACY_UPGRADES,
  missingPrereqs,
  nextRank,
  PRESTIGE_UPGRADES,
  RANK_META,
  rankMeetsRequirement,
  skillCost,
  SKILLS,
  totalSpentPP,
  type LegacyUpgrade,
  type LegacyUpgradeId,
  type PrestigeUpgrade,
  type PrestigeUpgradeId,
  type Rank,
  type SkillLevels,
  type SkillNode,
  type SkillPath,
  type TreeEffects,
} from "@/src/game/skillTree";
import {
  defaultStats,
  MARKET_EVENTS,
  type AchievementId,
  type ActiveMarketEvent,
  type Stats,
} from "@/src/game/features";

// ---------- Theme ----------
const C = {
  bg: "#0B1220",
  bgSoft: "#0F1830",
  panel: "#111B2E",
  panelElevated: "#16223A",
  accent: "#00E5FF",
  accentDeep: "#00B8D4",
  gold: "#FFD54F",
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
  unlocked?: (t: TreeEffects) => boolean; // gated packages
};

const BASE_PACKAGES: Pkg[] = [
  { id: "starter",    name: "Starter Bond",         tag: "Low risk",       cost: 10,     durationMs: 2500,   profitPct: 0.18, tint: "#5EE1B0" },
  { id: "growth",     name: "Growth Fund",          tag: "Medium",         cost: 50,     durationMs: 6000,   profitPct: 0.32, tint: "#00E5FF" },
  { id: "momentum",   name: "Momentum Pool",        tag: "High",           cost: 200,    durationMs: 15000,  profitPct: 0.60, tint: "#FFB84D" },
  { id: "realestate", name: "Real Estate REIT",     tag: "Housing",        cost: 600,    durationMs: 25000,  profitPct: 0.85, tint: "#FFD54F" },
  { id: "crypto",     name: "Crypto Vault",         tag: "Volatile",       cost: 2500,   durationMs: 40000,  profitPct: 1.30, tint: "#B9F2FF" },
  { id: "whale",      name: "Whale Vault",          tag: "Very high risk", cost: 1000,   durationMs: 50000,  profitPct: 1.40, tint: "#FF6EC7" },
  { id: "contract",   name: "Long-Term Contract",   tag: "Contract",       cost: 10000,  durationMs: 240000, profitPct: 4.5,  tint: "#FFD54F", unlocked: (t) => t.contractsUnlocked },
  { id: "legendary",  name: "Legendary Contract",   tag: "Legendary",      cost: 100000, durationMs: 720000, profitPct: 10.0, tint: "#B9F2FF", unlocked: (t) => t.legendaryUnlocked },
];

const getPackages = (t: TreeEffects): Pkg[] =>
  BASE_PACKAGES.filter((p) => !p.unlocked || p.unlocked(t));

const cheapestCost = (t: TreeEffects) => getPackages(t)[0].cost;

// ---------- Upgrades (unchanged) ----------
type UpgradeId = "yield" | "turbo" | "passive" | "lucky" | "slots";
type Upgrade = {
  id: UpgradeId; name: string; description: string;
  effect: (level: number) => string;
  baseCost: number; costGrowth: number; maxLevel: number; tint: string;
};
const UPGRADES: Upgrade[] = [
  { id: "yield",   name: "Yield Boost",     description: "+8% profit multiplier per level",       effect: (l) => `+${(l * 8).toFixed(0)}% profit`,               baseCost: 15,  costGrowth: 1.55, maxLevel: 15, tint: "#00FF88" },
  { id: "turbo",   name: "Turbo Trades",    description: "-6% investment duration per level",     effect: (l) => `-${Math.min(72, l * 6).toFixed(0)}% time`,     baseCost: 25,  costGrowth: 1.6,  maxLevel: 12, tint: "#00E5FF" },
  { id: "passive", name: "Passive Yield",   description: "+$1.00/sec passive income per level",   effect: (l) => `+$${(l * 1.0).toFixed(2)}/sec`,                baseCost: 40,  costGrowth: 1.5,  maxLevel: 25, tint: "#FFB84D" },
  { id: "lucky",   name: "Lucky Streak",    description: "+4% chance for 2× profit per level",    effect: (l) => `${Math.min(60, l * 4).toFixed(0)}% x2`,        baseCost: 100, costGrowth: 1.7,  maxLevel: 15, tint: "#FF6EC7" },
  { id: "slots",   name: "Portfolio Slots", description: "+1 concurrent investment per level",    effect: (l) => `${l + 1} slot${l === 0 ? "" : "s"}`,           baseCost: 300, costGrowth: 2.5,  maxLevel: 4,  tint: "#00E5FF" },
];
const upgradeCost = (u: Upgrade, level: number) =>
  Math.floor(u.baseCost * Math.pow(u.costGrowth, level));

const effectivePkgCost = (pkg: Pkg, t: TreeEffects, market: ActiveMarketEvent | null = null) => {
  let c = pkg.cost * t.endgameCostMult;
  if (market) {
    const ev = MARKET_EVENTS.find((e) => e.id === market.id);
    if (ev?.costMult) c *= ev.costMult;
  }
  return Math.max(1, Math.round(c));
};

const effectiveUpgradeCost = (u: Upgrade, level: number, t: TreeEffects) =>
  Math.max(1, Math.round(upgradeCost(u, level) * t.endgameUpgradeCostMult));

// ---------- Actives ----------
type ActiveInvestment = {
  runId: string; pkgId: string; cost: number;
  startedAt: number; endsAt: number;
};

// ---------- Save shape (v6) ----------
type Settings = {
  music: boolean;
  sfx: boolean;
  haptics: boolean;
  notifications: boolean;
};
const defaultSettings = (): Settings => ({
  music: true, sfx: true, haptics: true, notifications: true,
});

type SaveData = {
  v: 6;
  balance: number;
  selectedId: string;
  levels: Record<UpgradeId, number>;
  actives: ActiveInvestment[];
  lastSeenAt: number;
  musicEnabled: boolean;   // legacy — mirrors settings.music
  prestige: number;
  totalPrestiges: number;
  skills: SkillLevels;
  stats: Stats;
  unlockedAchievements: AchievementId[];
  activeMarket: ActiveMarketEvent | null;
  lastMarketRollAt: number;
  settings: Settings;
  prestigeUpgrades: Record<PrestigeUpgradeId, boolean>;
  legacyPoints: number;
  legacyUpgrades: Record<LegacyUpgradeId, boolean>;
  onboardingComplete: boolean;
};
const SAVE_KEY = "investmentIdle:v6";
const LEGACY_KEYS = ["investmentIdle:v5", "investmentIdle:v4", "investmentIdle:v3", "investmentIdle:v2"];
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

const PRESTIGE_MIN_BALANCE = 5000;
const PRESTIGE_BONUS_PER_POINT = 0.05;
const computePrestigeGain = (balance: number) => {
  if (balance < PRESTIGE_MIN_BALANCE) return 0;
  return Math.floor(Math.sqrt(balance / PRESTIGE_MIN_BALANCE));
};

const defaultSave = (): SaveData => ({
  v: 6,
  balance: 100,
  selectedId: BASE_PACKAGES[0].id,
  levels: { yield: 0, turbo: 0, passive: 0, lucky: 0, slots: 0 },
  actives: [],
  lastSeenAt: Date.now(),
  musicEnabled: true,
  prestige: 0,
  totalPrestiges: 0,
  skills: {},
  stats: defaultStats(),
  unlockedAchievements: [],
  activeMarket: null,
  lastMarketRollAt: Date.now(),
  settings: defaultSettings(),
  prestigeUpgrades: { foundation: false },
  legacyPoints: 0,
  legacyUpgrades: {
    "investors-foundation": false,
    "global-market": false,
    "financial-automation": false,
    "corporate-empire": false,
    "market-dominance": false,
    "global-network": false,
    "ultimate-investor": false,
  },
  onboardingComplete: false,
});

// ---------- Helpers ----------
const UNITS: { v: number; s: string }[] = [
  { v: 1e33, s: "D" }, { v: 1e30, s: "N" }, { v: 1e27, s: "Oc" },
  { v: 1e24, s: "Sp" }, { v: 1e21, s: "Sx" }, { v: 1e18, s: "Qi" },
  { v: 1e15, s: "Qa" }, { v: 1e12, s: "T" }, { v: 1e9, s: "B" },
  { v: 1e6, s: "M" }, { v: 1e3, s: "K" },
];
const money = (n: number) => {
  if (!isFinite(n)) return "$∞";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 10000) return `${sign}$${abs.toFixed(2)}`;
  for (const u of UNITS) if (abs >= u.v) return `${sign}$${(abs / u.v).toFixed(2)}${u.s}`;
  return `${sign}$${abs.toFixed(2)}`;
};

// Compact non-currency number formatter (K/M/B/T/…).
const compact = (n: number) => {
  if (!isFinite(n)) return "∞";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1000) return `${sign}${Math.floor(abs)}`;
  for (const u of UNITS) if (abs >= u.v) return `${sign}${(abs / u.v).toFixed(abs / u.v >= 100 ? 0 : abs / u.v >= 10 ? 1 : 2)}${u.s}`;
  return `${sign}${Math.floor(abs)}`;
};
const fmtDuration = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
};
const fmtSecs = (ms: number) =>
  ms >= 60000 ? fmtDuration(ms) : `${(ms / 1000).toFixed(1)}s`;

const prestigeBonus = (prestige: number) => 1 + PRESTIGE_BONUS_PER_POINT * prestige;

const computeProfitPct = (
  pkg: Pkg,
  yieldLevel: number,
  prestige: number,
  t: TreeEffects,
  filledSlots: number = 1,
  market: ActiveMarketEvent | null = null,
  hasFoundation: boolean = false,
  legacyUpgrades: Record<LegacyUpgradeId, boolean> = {} as Record<LegacyUpgradeId, boolean>,
) => {
  let m = pkg.profitPct;
  m *= 1 + 0.08 * yieldLevel;
  m *= prestigeBonus(prestige);
  m *= t.profitMult;
  if (hasFoundation) m *= 2;
  m *= t.endgameProfitMult;
  // Legacy upgrade multipliers
  if (legacyUpgrades["investors-foundation"]) m *= 1.5;
  if (legacyUpgrades["corporate-empire"]) m *= 1.25;
  if (legacyUpgrades["global-network"]) m *= 2;
  if (legacyUpgrades["ultimate-investor"]) m *= 3;
  // Market event bonuses
  if (market) {
    const ev = MARKET_EVENTS.find((e) => e.id === market.id);
    if (ev) {
      let marketMult = ev.profitMult ?? 1;
      if (legacyUpgrades["market-dominance"] && marketMult > 1) {
        marketMult *= 1.5; // Positive events +50% stronger
      }
      m *= marketMult;
      const pkgBoost = ev.pkgBoost?.[pkg.id];
      if (pkgBoost) m *= 1 + pkgBoost;
    }
  }
  m *= 1 + t.slotSynergyPct * Math.max(0, filledSlots - 1);
  if (pkg.id === "whale") m *= 1 + t.whaleBonus;
  if (pkg.id === "legendary") m *= 1 + t.legendaryBonus;
  return m;
};

const computeDuration = (pkg: Pkg, turbo: number, t: TreeEffects, market: ActiveMarketEvent | null = null, hasFoundation: boolean = false, legacyUpgrades: Record<LegacyUpgradeId, boolean> = {} as Record<LegacyUpgradeId, boolean>) => {
  const turboRed = Math.min(0.72, 0.06 * turbo);
  let d = pkg.durationMs * t.durationMult * (1 - turboRed);
  if (hasFoundation) d /= 1.5;
  // Legacy upgrade speed bonuses
  if (legacyUpgrades["investors-foundation"]) d /= 1.25;
  if (legacyUpgrades["global-network"]) d /= 1.5;
  if (market) {
    const ev = MARKET_EVENTS.find((e) => e.id === market.id);
    if (ev?.durMult) d *= ev.durMult;
  }
  return Math.max(200, Math.round(d));
};

const computePassiveRate = (passiveLvl: number, t: TreeEffects) =>
  1.0 * passiveLvl * t.passiveMult * t.endgamePassiveMult;

const luckyChance = (level: number) => Math.min(0.6, 0.03 * level);
const slotCount = (level: number) => 1 + level;

let runIdCounter = 0;
const newRunId = () => `r${Date.now()}-${++runIdCounter}`;

// Accelerate: base reduction curve × treeEffects.accelStrengthMult × [autoStrength]
const baseAccelReductionMs = (remaining: number) =>
  Math.max(200, Math.min(400, remaining * 0.06));

// ============================================================
export default function Index() {
  const sound = useSoundEngine();
  const [showTree, setShowTree] = useState(false);

  // Core state
  const [ready, setReady] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [balance, setBalance] = useState(100);
  const [selectedId, setSelectedId] = useState(BASE_PACKAGES[0].id);
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
  const [skills, setSkills] = useState<SkillLevels>({});
  const [prestigeArmed, setPrestigeArmed] = useState(false);
  const [prestigeCelebrate, setPrestigeCelebrate] = useState<number>(0);
  const [rankUpBanner, setRankUpBanner] = useState<Rank | null>(null);
  const [showLegacy, setShowLegacy] = useState(false);

  // Celebration banners for early game milestones
  const [celebrationBanner, setCelebrationBanner] = useState<string | null>(null);

  // Features state
  const [stats, setStats] = useState<Stats>(defaultStats());
  const [unlockedAchievements, setUnlockedAchievements] = useState<AchievementId[]>([]);
  const [activeMarket, setActiveMarket] = useState<ActiveMarketEvent | null>(null);
  const [lastMarketRollAt, setLastMarketRollAt] = useState<number>(Date.now());
  const [settings, setSettings] = useState<Settings>(defaultSettings());

  // Prestige upgrades state
  const [prestigeUpgrades, setPrestigeUpgrades] = useState<Record<PrestigeUpgradeId, boolean>>({ foundation: false });

  // Legacy endgame state
  const [legacyPoints, setLegacyPoints] = useState<number>(0);
  const [legacyUpgrades, setLegacyUpgrades] = useState<Record<LegacyUpgradeId, boolean>>({
    "investors-foundation": false,
    "global-market": false,
    "financial-automation": false,
    "corporate-empire": false,
    "market-dominance": false,
    "global-network": false,
    "ultimate-investor": false,
  });

  // Loading screen animation hooks (always called, conditionally rendered)
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    if (loadingComplete) return;
    logoScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    textOpacity.value = withDelay(600, withTiming(1, { duration: 600 }));
  }, [loadingComplete]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  // Onboarding screen hooks (always called, conditionally rendered)
  const [onboardingStep, setOnboardingStep] = useState(0);
  const slideAnim = useSharedValue(0);

  useEffect(() => {
    if (!showOnboarding) return;
    slideAnim.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [showOnboarding, onboardingStep]);

  const slideStyle = useAnimatedStyle(() => ({
    opacity: slideAnim.value,
    transform: [{ translateY: (1 - slideAnim.value) * 20 }],
  }));

  // Developer menu (hidden gesture → password → menu)
  const [showDebug, setShowDebug] = useState(false);
  const [debugAuthed, setDebugAuthed] = useState(false);
  const [debugPassword, setDebugPassword] = useState("");
  const [debugPwError, setDebugPwError] = useState(false);
  const [debugMoneyInput, setDebugMoneyInput] = useState("");
  const [debugPPInput, setDebugPPInput] = useState("");
  const secretTapRef = useRef<number[]>([]);

  // Derived
  const treeEffects = useMemo(() => deriveTreeEffects(skills), [skills]);
  const packages = useMemo(() => getPackages(treeEffects), [treeEffects]);
  const rank = useMemo(() => computeRank(totalPrestiges), [totalPrestiges]);

  // Balance counter animation (RAF)
  const [displayBalance, setDisplayBalance] = useState(100);
  const rafRef = useRef<number | null>(null);
  const displayStartRef = useRef({ from: 100, to: 100, start: 0 });
  useEffect(() => {
    displayStartRef.current = {
      from: displayBalance, to: balance,
      start: typeof performance !== "undefined" ? performance.now() : Date.now(),
    };
    const duration = 500;
    const tick = (t: number) => {
      const { from, to, start } = displayStartRef.current;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayBalance(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  // Sync music flag with settings.music (single source of truth: settings)
  useEffect(() => {
    if (musicEnabled !== settings.music) setMusicEnabled(settings.music);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.music]);

  const music = useBackgroundMusic(musicEnabled);

  // Reanimated
  const floatY = useSharedValue(0);
  const floatOpacity = useSharedValue(0);
  const balancePulse = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const flash = useSharedValue(0);
  const selectedPulse = useSharedValue(1);
  const treeSlide = useSharedValue(0);

  useEffect(() => {
    selectedPulse.value = withRepeat(
      withSequence(
        withTiming(1.015, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) })
      ), -1, false
    );
  }, [selectedPulse]);

  useEffect(() => {
    treeSlide.value = withTiming(showTree ? 1 : 0, {
      duration: 300, easing: Easing.out(Easing.cubic),
    });
  }, [showTree, treeSlide]);

  // Refs
  const finishRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nowTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passiveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAccelRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAccelTapRef = useRef<number>(0);
  const lastAutoInvestRef = useRef<number>(0);

  // Live access to volatile values from stable callbacks (avoids stale closures).
  const stateRef = useRef({
    balance, selectedId, levels, actives, prestige, treeEffects, packages, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete,
  });
  useEffect(() => {
    stateRef.current = { balance, selectedId, levels, actives, prestige, treeEffects, packages, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete };
  }, [balance, selectedId, levels, actives, prestige, treeEffects, packages, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete]);

  // -------- Persistence --------
  const saveState = useCallback(async (data: Partial<SaveData>) => {
    try {
      const merged: SaveData = {
        v: 6, balance, selectedId, levels, actives, musicEnabled,
        prestige, totalPrestiges, skills,
        stats, unlockedAchievements, activeMarket, lastMarketRollAt, settings,
        prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete,
        lastSeenAt: Date.now(),
        ...data,
      };
      await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(merged));
    } catch {}
  }, [balance, selectedId, levels, actives, musicEnabled, prestige, totalPrestiges, skills, stats, unlockedAchievements, activeMarket, lastMarketRollAt, settings, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete]);

  // Load (migrate v2/v3/v4 → v5)
  useEffect(() => {
    (async () => {
      try {
        let raw = await AsyncStorage.getItem(SAVE_KEY);
        if (!raw) {
          for (const k of LEGACY_KEYS) {
            const legacy = await AsyncStorage.getItem(k);
            if (legacy) {
              try {
                const p = JSON.parse(legacy);
                raw = JSON.stringify({
                  ...defaultSave(),
                  balance: p.balance ?? 100,
                  selectedId: p.selectedId ?? BASE_PACKAGES[0].id,
                  levels: { ...defaultSave().levels, ...(p.levels ?? {}) },
                  actives: (p.actives ?? (p.active ? [{
                    runId: newRunId(), pkgId: p.active.id, cost: p.active.cost,
                    startedAt: p.active.endsAt - 3000, endsAt: p.active.endsAt,
                  }] : [])) as ActiveInvestment[],
                  lastSeenAt: p.lastSeenAt ?? Date.now(),
                  musicEnabled: p.musicEnabled ?? true,
                  prestige: p.prestige ?? 0,
                  totalPrestiges: p.totalPrestiges ?? 0,
                  skills: p.skills ?? {},
                });
                break;
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
            skills: parsed.skills ?? {},
            prestigeUpgrades: parsed.prestigeUpgrades ?? { foundation: false },
            legacyPoints: parsed.legacyPoints ?? 0,
            legacyUpgrades: parsed.legacyUpgrades ?? {
              "investors-foundation": false,
              "global-market": false,
              "financial-automation": false,
              "corporate-empire": false,
              "market-dominance": false,
              "global-network": false,
              "ultimate-investor": false,
            },
            onboardingComplete: parsed.onboardingComplete ?? false,
          };
        }

        const savedTree = deriveTreeEffects(saved.skills);
        const savedPkgs = getPackages(savedTree);

        // Passive + savings offline earnings
        const elapsed = Math.min(OFFLINE_CAP_MS, Math.max(0, nowMs - (saved.lastSeenAt ?? nowMs)));
        const secs = elapsed / 1000;
        const passiveEarned = secs * computePassiveRate(saved.levels.passive ?? 0, savedTree);
        // Simple discrete savings compounding (avoid overflow)
        let simBal = saved.balance;
        if (savedTree.savingsRatePerSec > 0 && secs > 0) {
          // Cap to avoid absurd exponents (rate is tiny anyway).
          const factor = Math.pow(1 + savedTree.savingsRatePerSec, Math.min(secs, OFFLINE_CAP_MS / 1000));
          simBal = simBal * factor;
        }
        simBal += passiveEarned;

        // Settle completed actives
        let remaining: ActiveInvestment[] = [];
        for (const a of saved.actives) {
          if (nowMs >= a.endsAt) {
            const pkg = savedPkgs.find((p) => p.id === a.pkgId);
            if (pkg) {
              const filled = saved.actives.length; // approx
              const pct = computeProfitPct(pkg, saved.levels.yield ?? 0, saved.prestige ?? 0, savedTree, filled, null, saved.prestigeUpgrades?.foundation ?? false, saved.legacyUpgrades ?? {});
              const div = a.cost * pct * savedTree.dividendPct;
              simBal += a.cost + a.cost * pct + div;
            } else simBal += a.cost;
          } else {
            remaining.push(a);
          }
        }

        // Offline loop: keep re-investing selected pkg into empty slots until time or funds run out
        const offlineLoopEnabled = savedTree.offlineLoop && savedTree.autoReinvest;
        if (offlineLoopEnabled) {
          const slotCap = slotCount(saved.levels.slots ?? 0);
          let cursor = nowMs - elapsed; // simulate from lastSeenAt forward
          const selPkg = savedPkgs.find((p) => p.id === saved.selectedId) ?? savedPkgs[0];
          // Prune completed we already settled
          remaining = remaining.filter((a) => a.endsAt > nowMs);
          // Trim to slotCap
          while (remaining.length > slotCap) remaining.shift();

          // Auto-fill empty slots from cursor onwards
          const dur = computeDuration(selPkg, saved.levels.turbo ?? 0, savedTree, null, saved.prestigeUpgrades?.foundation ?? false, saved.legacyUpgrades ?? {});
          const filled: ActiveInvestment[] = [...remaining];
          let iters = 0;
          while (iters < 2000 && cursor < nowMs) {
            // Complete any active whose end has passed
            const doneNow = filled.filter((a) => a.endsAt <= cursor);
            for (const a of doneNow) {
              const pkg = savedPkgs.find((p) => p.id === a.pkgId);
              if (pkg) {
                const pct = computeProfitPct(pkg, saved.levels.yield ?? 0, saved.prestige ?? 0, savedTree, filled.length, null, saved.prestigeUpgrades?.foundation ?? false, saved.legacyUpgrades ?? {});
                const div = a.cost * pct * savedTree.dividendPct;
                simBal += a.cost + a.cost * pct + div;
              }
            }
            let filledNext = filled.filter((a) => a.endsAt > cursor);
            // Fill empties
            while (filledNext.length < slotCap && simBal >= selPkg.cost) {
              const startedAt = cursor;
              const endsAt = cursor + dur;
              if (endsAt > nowMs) break; // partial cycles finished by real-time completion below
              simBal -= selPkg.cost;
              filledNext.push({
                runId: newRunId(), pkgId: selPkg.id, cost: selPkg.cost, startedAt, endsAt,
              });
            }
            // Advance cursor to soonest end
            if (filledNext.length === 0) break;
            const nextEnd = Math.min(...filledNext.map((a) => a.endsAt));
            cursor = Math.min(nextEnd, nowMs);
            remaining = filledNext.filter((a) => a.endsAt > nowMs);
            filled.length = 0;
            filled.push(...filledNext);
            iters++;
          }
        }

        setBalance(simBal);
        setDisplayBalance(simBal);
        displayStartRef.current = { from: simBal, to: simBal, start: 0 };
        setSelectedId(saved.selectedId ?? BASE_PACKAGES[0].id);
        setLevels(saved.levels);
        setActives(remaining);
        setMusicEnabled(saved.musicEnabled ?? true);
        setPrestige(saved.prestige ?? 0);
        setTotalPrestiges(saved.totalPrestiges ?? 0);
        setSkills(saved.skills ?? {});
        setStats({ ...defaultStats(), ...(saved.stats ?? {}) });
        setUnlockedAchievements(saved.unlockedAchievements ?? []);
        const savedMarket = saved.activeMarket ?? null;
        setActiveMarket(savedMarket && savedMarket.endsAt > Date.now() ? savedMarket : null);
        setLastMarketRollAt(saved.lastMarketRollAt ?? Date.now());
        setSettings({ ...defaultSettings(), ...(saved.settings ?? {}) });
        setPrestigeUpgrades(saved.prestigeUpgrades ?? { foundation: false });
        setLegacyPoints(saved.legacyPoints ?? 0);
        setLegacyUpgrades(saved.legacyUpgrades ?? {
          "investors-foundation": false,
          "global-market": false,
          "financial-automation": false,
          "corporate-empire": false,
          "market-dominance": false,
          "global-network": false,
          "ultimate-investor": false,
        });
        setOnboardingComplete(saved.onboardingComplete ?? false);
        setShowOnboarding(!(saved.onboardingComplete ?? false));
        if (passiveEarned > 0.01 || (savedTree.savingsRatePerSec > 0 && elapsed > 1000)) {
          setOfflineGain(simBal - (saved.balance ?? 100));
        }

        for (const a of remaining) {
          const left = Math.max(0, a.endsAt - Date.now());
          finishRefs.current[a.runId] = setTimeout(() => completeInvestment(a.runId), left);
        }
      } catch {}
      finally {
        setReady(true);
        // Trigger loading screen transition
        setTimeout(() => setLoadingComplete(true), 1500);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveState({});
  }, [ready, balance, selectedId, levels, actives, musicEnabled, prestige, totalPrestiges, skills, stats, unlockedAchievements, activeMarket, settings, prestigeUpgrades, legacyPoints, legacyUpgrades, saveState]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s !== "active") saveState({}); });
    return () => sub.remove();
  }, [saveState]);

  // Passive + savings tick
  useEffect(() => {
    if (passiveRef.current) { clearInterval(passiveRef.current); passiveRef.current = null; }
    const rate = computePassiveRate(levels.passive, treeEffects);
    const savRate = treeEffects.savingsRatePerSec;
    if (rate <= 0 && savRate <= 0) return;
    passiveRef.current = setInterval(() => {
      setBalance((b) => {
        const savings = b * savRate;
        return b + rate + savings;
      });
    }, 1000);
    return () => {
      if (passiveRef.current) { clearInterval(passiveRef.current); passiveRef.current = null; }
    };
  }, [levels.passive, treeEffects]);

  // Global ticker for progress + countdown display
  useEffect(() => {
    if (nowTickerRef.current) { clearInterval(nowTickerRef.current); nowTickerRef.current = null; }
    if (actives.length === 0) return;
    nowTickerRef.current = setInterval(() => setNow(Date.now()), 100);
    return () => {
      if (nowTickerRef.current) { clearInterval(nowTickerRef.current); nowTickerRef.current = null; }
    };
  }, [actives.length]);

  // Anti-soft-lock bailout (bailout amount from tree)
  useEffect(() => {
    if (!ready) return;
    if (actives.length > 0) return;
    if (computePassiveRate(levels.passive, treeEffects) > 0) return;
    if (treeEffects.savingsRatePerSec > 0 && balance > 0.01) return;
    if (balance >= cheapestCost(treeEffects)) return;
    const bail = treeEffects.bailoutAmount;
    const t = setTimeout(() => {
      setBalance((b) => (b < cheapestCost(treeEffects) ? bail : b));
      setBailoutNotice(true);
      sound.play("upgrade");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [balance, actives.length, levels.passive, ready, sound, treeEffects]);

  // Rank-up detection
  const prevRankRef = useRef<Rank>("bronze");
  useEffect(() => {
    if (!ready) return;
    if (RANK_META[rank].minPrestiges > RANK_META[prevRankRef.current].minPrestiges) {
      setRankUpBanner(rank);
      sound.play("upgrade");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setRankUpBanner(null), 6000);
    }
    prevRankRef.current = rank;
  }, [rank, ready, sound]);

  useEffect(() => {
    return () => {
      Object.values(finishRefs.current).forEach(clearTimeout);
      finishRefs.current = {};
      if (nowTickerRef.current) clearInterval(nowTickerRef.current);
      if (passiveRef.current) clearInterval(passiveRef.current);
      if (autoAccelRef.current) clearInterval(autoAccelRef.current);
    };
  }, []);

  // -------- Completion --------
  const completeInvestment = useCallback((runId: string) => {
    setActives((list) => {
      const a = list.find((x) => x.runId === runId);
      if (!a) return list;
      const state = stateRef.current;
      const pkg = state.packages.find((p) => p.id === a.pkgId);
      if (!pkg) return list.filter((x) => x.runId !== runId);

      const filled = list.length;
      const pct = computeProfitPct(pkg, state.levels.yield, state.prestige, state.treeEffects, filled, null, state.prestigeUpgrades?.foundation ?? false, state.legacyUpgrades);
      let profit = a.cost * pct;
      const lucky = Math.random() < luckyChance(state.levels.lucky);
      if (lucky) profit *= 2;
      const dividend = a.cost * pct * state.treeEffects.dividendPct;
      const totalReturn = a.cost + profit + dividend;

      setBalance((b) => b + totalReturn);
      setLastProfit(profit + dividend);
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
  }, [sound, balancePulse, floatY, floatOpacity]);

  // -------- Actions --------
  const doShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }), withTiming(10, { duration: 60 }),
      withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  };
  const kickMusicOnce = () => { music.kick(); };

  // Pick the best package the user can afford (for smart-select)
  const pickAutoPackage = useCallback((bal: number): Pkg | null => {
    const state = stateRef.current;
    const pkgs = state.treeEffects.smartSelect
      ? [...state.packages].sort((a, b) => b.cost - a.cost)
      : [state.packages.find((p) => p.id === state.selectedId) ?? state.packages[0]];
    for (const p of pkgs) if (bal >= p.cost) return p;
    return null;
  }, []);

  const investPkg = useCallback((pkg: Pkg): boolean => {
    const state = stateRef.current;
    const slots = slotCount(state.levels.slots);
    if (state.actives.length >= slots) return false;
    const cost = effectivePkgCost(pkg, state.treeEffects);
    if (state.balance < cost) return false;

    const dur = computeDuration(pkg, state.levels.turbo, state.treeEffects, null, state.prestigeUpgrades?.foundation ?? false, state.legacyUpgrades ?? {});
    const startedAt = Date.now();
    const a: ActiveInvestment = {
      runId: newRunId(), pkgId: pkg.id, cost,
      startedAt, endsAt: startedAt + dur,
    };
    setBalance((b) => b - cost);
    setActives((list) => [...list, a]);
    finishRefs.current[a.runId] = setTimeout(() => completeInvestment(a.runId), dur);

    // Early game milestone: First investment
    if (state.actives.length === 0 && !onboardingComplete) {
      setCelebrationBanner("First Investment Started!");
      setTimeout(() => setCelebrationBanner(null), 3000);
    }

    return true;
  }, [completeInvestment, onboardingComplete]);

  const invest = () => {
    kickMusicOnce();
    const state = stateRef.current;
    const slots = slotCount(state.levels.slots);
    const hasFreeSlot = state.actives.length < slots;
    const selected = state.packages.find((p) => p.id === state.selectedId) ?? state.packages[0];
    if (!hasFreeSlot || state.balance < effectivePkgCost(selected, state.treeEffects)) {
      sound.play("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      doShake();
      return;
    }
    sound.play("investStart");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    flash.value = 0.55;
    flash.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
    investPkg(selected);
  };

  const ACCELERATE_COOLDOWN_MS = 80;
  const accelerate = (runId: string, opts: { silent?: boolean; strength?: number } = {}) => {
    if (!opts.silent) kickMusicOnce();
    const nowMs = Date.now();
    if (!opts.silent && nowMs - lastAccelTapRef.current < ACCELERATE_COOLDOWN_MS) return;
    if (!opts.silent) lastAccelTapRef.current = nowMs;

    setActives((list) => {
      const idx = list.findIndex((x) => x.runId === runId);
      if (idx === -1) return list;
      const a = list[idx];
      const remaining = Math.max(0, a.endsAt - nowMs);
      if (remaining <= 0) return list;
      const state = stateRef.current;
      const reduction = baseAccelReductionMs(remaining) * state.treeEffects.accelStrengthMult * (opts.strength ?? 1);
      const newEndsAt = Math.max(nowMs, a.endsAt - reduction);
      const updated: ActiveInvestment = { ...a, endsAt: newEndsAt };
      if (finishRefs.current[a.runId]) clearTimeout(finishRefs.current[a.runId]);
      finishRefs.current[a.runId] = setTimeout(() => completeInvestment(a.runId), Math.max(0, newEndsAt - Date.now()));
      const copy = [...list];
      copy[idx] = updated;
      return copy;
    });

    if (!opts.silent) {
      sound.play("click");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // Auto-accelerate loop
  useEffect(() => {
    if (autoAccelRef.current) { clearInterval(autoAccelRef.current); autoAccelRef.current = null; }
    if (treeEffects.autoAccelStrength <= 0) return;
    if (actives.length === 0) return;
    autoAccelRef.current = setInterval(() => {
      const state = stateRef.current;
      for (const a of state.actives) {
        accelerate(a.runId, { silent: true, strength: state.treeEffects.autoAccelStrength });
      }
    }, 400);
    return () => {
      if (autoAccelRef.current) { clearInterval(autoAccelRef.current); autoAccelRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeEffects.autoAccelStrength, actives.length]);

  // Auto-reinvest / auto-fill loop (checks periodically for empty slots)
  useEffect(() => {
    if (!ready) return;
    if (!treeEffects.autoReinvest) return;
    const state = stateRef.current;
    const slots = slotCount(state.levels.slots);
    if (state.actives.length >= slots) return;
    const nowMs = Date.now();
    if (nowMs - lastAutoInvestRef.current < 250) return;
    // If autoFill: try to fill all empty; else just refill one (post-completion behavior)
    const attempts = treeEffects.autoFill ? slots - state.actives.length : 1;
    for (let i = 0; i < attempts; i++) {
      const s = stateRef.current;
      const pkg = pickAutoPackage(s.balance);
      if (!pkg) break;
      if (!investPkg(pkg)) break;
      lastAutoInvestRef.current = Date.now();
    }
  }, [ready, actives.length, balance, treeEffects.autoReinvest, treeEffects.autoFill, treeEffects.smartSelect, pickAutoPackage, investPkg, levels.slots]);

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

    // Early game milestone: First upgrade
    if (level === 0 && !onboardingComplete) {
      setCelebrationBanner("First Upgrade Purchased!");
      setTimeout(() => setCelebrationBanner(null), 3000);
    }
  };

  const buySkill = (node: SkillNode) => {
    kickMusicOnce();
    const level = skills[node.id] ?? 0;
    if (level >= node.maxLevel) return;
    if (!rankMeetsRequirement(rank, node.requiredRank)) {
      sound.play("error"); doShake(); return;
    }
    if (missingPrereqs(node, skills).length > 0) {
      sound.play("error"); doShake(); return;
    }
    const cost = skillCost(node, level);
    if (prestige < cost) {
      sound.play("error"); doShake(); return;
    }
    setPrestige((p) => p - cost);
    setSkills((s) => ({ ...s, [node.id]: (s[node.id] ?? 0) + 1 }));
    sound.play("upgrade");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const toggleMusic = () => {
    setMusicEnabled((v) => {
      const next = !v;
      if (next) music.kick();
      return next;
    });
    Haptics.selectionAsync().catch(() => {});
  };

  // ---------- Developer menu (hidden gesture) ----------
  const DEBUG_PASSWORD = "1337";
  const DEBUG_TAP_COUNT = 7;
  const DEBUG_TAP_WINDOW_MS = 3000;

  const handleSecretTap = () => {
    const nowMs = Date.now();
    const recent = [...secretTapRef.current, nowMs].filter(
      (t) => nowMs - t < DEBUG_TAP_WINDOW_MS
    );
    secretTapRef.current = recent;
    if (recent.length >= DEBUG_TAP_COUNT) {
      secretTapRef.current = [];
      setDebugAuthed(false);
      setDebugPassword("");
      setDebugPwError(false);
      setDebugMoneyInput("");
      setDebugPPInput("");
      setShowDebug(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  };

  const submitDebugPassword = () => {
    if (debugPassword === DEBUG_PASSWORD) {
      setDebugAuthed(true);
      setDebugPwError(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setDebugPwError(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const closeDebug = () => {
    setShowDebug(false);
    setDebugAuthed(false);
    setDebugPassword("");
    setDebugPwError(false);
    setDebugMoneyInput("");
    setDebugPPInput("");
  };

  const parseAmount = (raw: string): number => {
    const n = Number(raw.replace(/[^0-9.eE+-]/g, ""));
    return isFinite(n) ? n : 0;
  };

  const devAddMoney = () => {
    const amount = parseAmount(debugMoneyInput);
    if (amount <= 0) return;
    setBalance((b) => b + amount);
    setDebugMoneyInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const devAddPP = () => {
    const amount = Math.floor(parseAmount(debugPPInput));
    if (amount <= 0) return;
    setPrestige((p) => p + amount);
    setDebugPPInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

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
      setTimeout(() => setPrestigeArmed(false), 5000);
      return;
    }
    const gain = prestigeGainAvailable;
    Object.values(finishRefs.current).forEach(clearTimeout);
    finishRefs.current = {};
    setActives([]);
    const start = 100 + treeEffects.startingCashBonus;
    setBalance(start);
    setDisplayBalance(start);
    displayStartRef.current = { from: start, to: start, start: 0 };
    setSelectedId(BASE_PACKAGES[0].id);
    setLevels({ yield: 0, turbo: 0, passive: 0, lucky: 0, slots: 0 });
    setPrestige((p) => p + gain);
    setTotalPrestiges((t) => t + 1);
    setPrestigeArmed(false);
    setPrestigeCelebrate(gain);
    setTimeout(() => setPrestigeCelebrate(0), 4500);

    // Award Legacy Points after threshold is reached
    // Earn 1 LP per 100 PP gained (slow progression)
    const newTotalPrestiges = totalPrestiges + 1;
    if (newTotalPrestiges >= LEGACY_UNLOCK_THRESHOLD) {
      const legacyGain = Math.max(1, Math.floor(gain / 100));
      setLegacyPoints((lp: number) => lp + legacyGain);
      // Persist Legacy Points immediately to ensure they're saved
      setTimeout(() => {
        setLegacyPoints((currentLp) => {
          saveState({ legacyPoints: currentLp });
          return currentLp;
        });
      }, 100);
    }

    sound.play("upgrade");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    balancePulse.value = withSequence(
      withTiming(1.2, { duration: 220 }), withTiming(1, { duration: 320 })
    );
  };

  // -------- Animated styles --------
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
  const treeSlideStyle = useAnimatedStyle(() => ({
    opacity: treeSlide.value,
    transform: [{ translateY: (1 - treeSlide.value) * 20 }],
  }));

  if (!ready) {
    return (
      <SafeAreaView style={styles.safe} testID="game-screen">
        <View style={styles.loaderWrap}>
          <Text style={styles.loaderText}>Loading portfolio...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const slots = slotCount(levels.slots);
  const hasFreeSlot = actives.length < slots;
  const selected = packages.find((p) => p.id === selectedId) ?? packages[0];
  const canAffordSelected = balance >= selected.cost;
  const canInvest = hasFreeSlot && canAffordSelected;
  const selectedEffPct = computeProfitPct(selected, levels.yield, prestige, treeEffects, Math.max(1, actives.length + 1), null, prestigeUpgrades.foundation, legacyUpgrades);
  const selectedEffDur = computeDuration(selected, levels.turbo, treeEffects, null, prestigeUpgrades.foundation, legacyUpgrades);
  const selectedEffProfit = selected.cost * selectedEffPct;
  const rankMeta = RANK_META[rank];
  const nRank = nextRank(rank);
  const nRankMeta = nRank ? RANK_META[nRank] : null;
  const currentBonusPct = (treeEffects.profitMult - 1 + prestige * PRESTIGE_BONUS_PER_POINT) * 100;

  const ctaLabel = !hasFreeSlot ? "All slots busy" : !canAffordSelected ? "Insufficient Balance" : `Invest ${money(selected.cost)}`;
  const ctaSub = !hasFreeSlot
    ? `Unlock more via Portfolio Slots (Lv ${levels.slots}/4)`
    : !canAffordSelected
    ? `Need ${money(selected.cost)} for ${selected.name}`
    : `${selected.name} · +${money(selectedEffProfit)} in ${fmtDuration(selectedEffDur)}`;

  // ============================================================
  // Skill Tree Screen (overlay)
  // ============================================================
  if (showTree) {
    return (
      <SafeAreaView style={styles.safe} testID="prestige-screen">
        <Animated.View style={[{ flex: 1 }, treeSlideStyle]}>
          <LinearGradient
            colors={[C.bgSoft, C.bg]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.treeHeader}
          >
            <View style={styles.treeHeaderRow}>
              <Pressable
                onPress={() => { sound.play("click"); setShowTree(false); }}
                hitSlop={16}
                testID="tree-back"
                style={styles.backBtn}
              >
                <Text style={styles.backBtnText}>← BACK</Text>
              </Pressable>
              <Text style={styles.treeTitle}>PRESTIGE TREE</Text>
              {totalPrestiges >= LEGACY_UNLOCK_THRESHOLD && (
                <Pressable
                  onPress={() => { sound.play("click"); setShowLegacy(true); }}
                  hitSlop={12}
                  style={[styles.iconChip, { borderColor: C.gold, backgroundColor: `${C.gold}25`, marginLeft: 6, borderWidth: 1.5 }]}
                  testID="open-legacy"
                >
                  <Text style={[styles.iconChipText, { color: C.gold }]}>
                    LEGACY · {compact(legacyPoints)}
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.rankCard}>
              <View
                style={[
                  styles.rankBadge,
                  { borderColor: rankMeta.tint, backgroundColor: `${rankMeta.tint}22` },
                ]}
              >
                <Text style={[styles.rankBadgeIcon, { color: rankMeta.tint }]}>
                  {rankMeta.icon}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rankLabel}>CURRENT RANK</Text>
                <Text style={[styles.rankName, { color: rankMeta.tint }]}>
                  {rankMeta.name}
                </Text>
                {nRankMeta ? (
                  <>
                    <View style={styles.rankBar}>
                      <View
                        style={[
                          styles.rankBarFill,
                          {
                            backgroundColor: nRankMeta.tint,
                            width: `${Math.min(100, ((totalPrestiges - rankMeta.minPrestiges) / (nRankMeta.minPrestiges - rankMeta.minPrestiges)) * 100).toFixed(1)}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.rankProgress}>
                      {totalPrestiges - rankMeta.minPrestiges} / {nRankMeta.minPrestiges - rankMeta.minPrestiges} to {nRankMeta.short}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.rankProgress}>Maximum rank achieved</Text>
                )}
              </View>
            </View>

            <View style={styles.treeStats}>
              <View style={styles.treeStatCell}>
                <Text style={styles.treeStatLabel}>PP AVAILABLE</Text>
                <Text style={[styles.treeStatValue, { color: C.gold }]} testID="tree-pp-available">{prestige}</Text>
              </View>
              <View style={styles.treeStatDivider} />
              <View style={styles.treeStatCell}>
                <Text style={styles.treeStatLabel}>PP SPENT</Text>
                <Text style={styles.treeStatValue}>{totalSpentPP(skills)}</Text>
              </View>
              <View style={styles.treeStatDivider} />
              <View style={styles.treeStatCell}>
                <Text style={styles.treeStatLabel}>PROFIT BONUS</Text>
                <Text style={[styles.treeStatValue, { color: C.gain }]}>+{currentBonusPct.toFixed(0)}%</Text>
              </View>
              <View style={styles.treeStatDivider} />
              <View style={styles.treeStatCell}>
                <Text style={styles.treeStatLabel}>CASH-OUTS</Text>
                <Text style={styles.treeStatValue}>{totalPrestiges}</Text>
              </View>
            </View>

            {/* Prestige Upgrades */}
            <View style={styles.upgradesSection}>
              <Text style={styles.upgradesSectionTitle}>PRESTIGE UPGRADES</Text>
              {PRESTIGE_UPGRADES.map((upgrade) => {
                const owned = prestigeUpgrades[upgrade.id];
                const canAfford = prestige >= upgrade.cost && !owned;
                return (
                  <Pressable
                    key={upgrade.id}
                    onPress={() => {
                      if (canAfford) {
                        sound.play("upgrade");
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                        const newPrestigeUpgrades = { ...prestigeUpgrades, [upgrade.id]: true };
                        setPrestige((p) => p - upgrade.cost);
                        setPrestigeUpgrades(newPrestigeUpgrades);
                        saveState({ prestigeUpgrades: newPrestigeUpgrades });
                      }
                    }}
                    disabled={!canAfford}
                    style={({ pressed }) => [
                      styles.prestigeUpgradeCard,
                      owned && styles.prestigeUpgradeCardOwned,
                      !owned && { borderColor: upgrade.tint, backgroundColor: `${upgrade.tint}15` },
                      pressed && canAfford && { transform: [{ scale: 0.98 }] },
                    ]}
                    testID={`upgrade-${upgrade.id}`}
                  >
                    {owned && (
                      <View style={[styles.prestigeUpgradeOwnedBadge, { backgroundColor: upgrade.tint }]}>
                        <Text style={styles.prestigeUpgradeOwnedIcon}>✓</Text>
                      </View>
                    )}
                    <View style={styles.prestigeUpgradeCardLeft}>
                      <Text style={[styles.prestigeUpgradeCardName, owned && { color: upgrade.tint }]}>
                        {upgrade.name}
                      </Text>
                      <Text style={styles.prestigeUpgradeCardDesc}>{upgrade.description}</Text>
                    </View>
                    <View style={styles.prestigeUpgradeCardRight}>
                      {owned ? (
                        <Text style={[styles.prestigeUpgradeCardStatus, { color: upgrade.tint }]}>OWNED</Text>
                      ) : (
                        <View style={[styles.prestigeUpgradeCostBadge, { borderColor: upgrade.tint, backgroundColor: `${upgrade.tint}25` }]}>
                          <Text style={[styles.prestigeUpgradeCostText, { color: upgrade.tint }]}>
                            ★ {upgrade.cost} PP
                          </Text>
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Cash out */}
            <Pressable
              onPress={doPrestige}
              style={({ pressed }) => [
                styles.cashOutBtn,
                !canPrestige && styles.cashOutBtnDim,
                prestigeArmed && styles.cashOutBtnArmed,
                pressed && canPrestige && { transform: [{ scale: 0.98 }] },
              ]}
              testID="prestige-button"
            >
              {canPrestige && !prestigeArmed && (
                <LinearGradient
                  colors={[C.gold, "#F9A825"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text
                style={[
                  styles.cashOutBtnText,
                  !canPrestige && { color: C.textMuted },
                  prestigeArmed && { color: "#001018" },
                  canPrestige && !prestigeArmed && { color: "#001018" },
                ]}
                testID="prestige-button-label"
              >
                {!canPrestige
                  ? `Reach ${money(PRESTIGE_MIN_BALANCE)} to cash out`
                  : prestigeArmed
                  ? `TAP AGAIN — CONFIRM +${prestigeGainAvailable} PP`
                  : `CASH OUT · +${prestigeGainAvailable} PP`}
              </Text>
              {canPrestige && !prestigeArmed && (
                <Text style={styles.cashOutBtnSub}>
                  Reset run · permanent +{(prestigeGainAvailable * PRESTIGE_BONUS_PER_POINT * 100).toFixed(0)}% profit
                </Text>
              )}
            </Pressable>
          </LinearGradient>

          {/* Tree body: 3 columns */}
          <ScrollView
            style={styles.treeBody}
            contentContainerStyle={styles.treeBodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.treeGridRow}>
              <TreeColumn
                title="AUTOMATION"
                subtitle="Idle strength"
                icon="A"
                tint={C.accent}
                path="automation"
                skills={skills}
                prestige={prestige}
                rank={rank}
                onBuy={buySkill}
              />
              <TreeColumn
                title="BONUS"
                subtitle="Steady growth"
                icon="B"
                tint={C.gain}
                path="bonus"
                skills={skills}
                prestige={prestige}
                rank={rank}
                onBuy={buySkill}
              />
              <TreeColumn
                title="METHODS"
                subtitle="New income"
                icon="M"
                tint={C.gold}
                path="money"
                skills={skills}
                prestige={prestige}
                rank={rank}
                onBuy={buySkill}
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // Legacy Endgame Screen
  // ============================================================
  if (showLegacy) {
    const buyLegacyUpgrade = (upgrade: LegacyUpgrade) => {
      if (legacyPoints < upgrade.cost || legacyUpgrades[upgrade.id]) return;
      sound.play("upgrade");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const newLegacyPoints = legacyPoints - upgrade.cost;
      const newLegacyUpgrades = { ...legacyUpgrades, [upgrade.id]: true };
      setLegacyPoints(newLegacyPoints);
      setLegacyUpgrades(newLegacyUpgrades);
      saveState({ legacyPoints: newLegacyPoints, legacyUpgrades: newLegacyUpgrades });
    };

    const isUltimateOwned = legacyUpgrades["ultimate-investor"];

    return (
      <SafeAreaView style={styles.safe} testID="legacy-screen">
        <LinearGradient
          colors={isUltimateOwned ? ["#FFD700", "#FFA500", "#FF8C00"] : ["#0B1220", "#16223A", "#1E2A44"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.legacyHeader}>
          <View style={styles.legacyHeaderRow}>
            <Pressable
              onPress={() => { sound.play("click"); setShowLegacy(false); }}
              hitSlop={16}
              testID="legacy-back"
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>← BACK</Text>
            </Pressable>
            <Text style={[styles.legacyTitle, isUltimateOwned && { color: "#FFD700" }]}>
              {isUltimateOwned ? "THE ULTIMATE INVESTOR" : "LEGACY ENDGAME"}
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.legacyStats}>
            <View style={styles.legacyStatCell}>
              <Text style={styles.legacyStatLabel}>LEGACY POINTS</Text>
              <Text style={[styles.legacyStatValue, { color: C.gold }]}>{compact(legacyPoints)}</Text>
            </View>
            <View style={styles.legacyStatDivider} />
            <View style={styles.legacyStatCell}>
              <Text style={styles.legacyStatLabel}>TOTAL PRESTIGES</Text>
              <Text style={styles.legacyStatValue}>{compact(totalPrestiges)}</Text>
            </View>
            <View style={styles.legacyStatDivider} />
            <View style={styles.legacyStatCell}>
              <Text style={styles.legacyStatLabel}>UPGRADES OWNED</Text>
              <Text style={styles.legacyStatValue}>
                {Object.values(legacyUpgrades).filter(Boolean).length}/{LEGACY_UPGRADES.length}
              </Text>
            </View>
          </View>

          {isUltimateOwned && (
            <View style={styles.ultimateBanner}>
              <Text style={styles.ultimateBannerText}>🏆 GAME COMPLETE 🏆</Text>
              <Text style={styles.ultimateBannerSub}>You have achieved the Ultimate Investor rank</Text>
            </View>
          )}
        </View>

        <ScrollView
          style={styles.legacyBody}
          contentContainerStyle={styles.legacyBodyContent}
          showsVerticalScrollIndicator={false}
        >
          {LEGACY_UPGRADES.map((upgrade) => {
            const owned = legacyUpgrades[upgrade.id];
            const canAfford = legacyPoints >= upgrade.cost && !owned;
            return (
              <Pressable
                key={upgrade.id}
                onPress={() => buyLegacyUpgrade(upgrade)}
                disabled={!canAfford}
                style={({ pressed }) => [
                  styles.legacyCard,
                  owned && styles.legacyCardOwned,
                  upgrade.isFinal && styles.legacyCardFinal,
                  !owned && { borderColor: upgrade.tint, backgroundColor: `${upgrade.tint}15` },
                  pressed && canAfford && { transform: [{ scale: 0.98 }] },
                ]}
                testID={`legacy-upgrade-${upgrade.id}`}
              >
                {owned && (
                  <View style={[styles.legacyOwnedBadge, { backgroundColor: upgrade.tint }]}>
                    <Text style={styles.legacyOwnedIcon}>✓</Text>
                  </View>
                )}
                <View style={styles.legacyCardLeft}>
                  <Text style={[styles.legacyCardName, owned && { color: upgrade.tint }]}>
                    {upgrade.name}
                  </Text>
                  <Text style={styles.legacyCardDesc}>{upgrade.description}</Text>
                  <Text style={styles.legacyCardEffect}>{upgrade.effect}</Text>
                </View>
                <View style={styles.legacyCardRight}>
                  {owned ? (
                    <Text style={[styles.legacyCardStatus, { color: upgrade.tint }]}>OWNED</Text>
                  ) : (
                    <View style={[styles.legacyCostBadge, { borderColor: upgrade.tint, backgroundColor: `${upgrade.tint}25` }]}>
                      <Text style={[styles.legacyCostText, { color: upgrade.tint }]}>
                        {compact(upgrade.cost)} LP
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================================
  // Loading Screen
  // ============================================================
  if (!loadingComplete) {
    return (
      <SafeAreaView style={styles.loadingContainer} testID="loading-screen">
        <LinearGradient
          colors={[C.bg, C.bgSoft, C.bg]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.loadingLogo, logoStyle]}>
          <View style={[styles.loadingLogoInner, { borderColor: C.accent }]}>
            <Text style={[styles.loadingLogoText, { color: C.accent }]}>P2P</Text>
          </View>
        </Animated.View>
        <Animated.View style={[styles.loadingTextContainer, textStyle]}>
          <Text style={styles.loadingTitle}>INVESTMENT IDLE</Text>
          <Text style={styles.loadingSubtitle}>Build Your Financial Empire</Text>
        </Animated.View>
        <View style={styles.loadingSpinner}>
          <View style={[styles.spinnerDot, { backgroundColor: C.accent }]} />
          <View style={[styles.spinnerDot, { backgroundColor: C.accent, opacity: 0.6 }]} />
          <View style={[styles.spinnerDot, { backgroundColor: C.accent, opacity: 0.3 }]} />
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // Onboarding Screen
  // ============================================================
  if (showOnboarding) {
    const onboardingSteps = [
      {
        title: "Welcome to Investment Idle",
        description: "Build your financial empire through smart investments. Start small, grow big.",
        highlight: "Tap to continue",
      },
      {
        title: "How It Works",
        description: "Invest in funds, wait for returns, and reinvest your profits to compound growth.",
        highlight: "Investments complete automatically",
      },
      {
        title: "Upgrades Matter",
        description: "Buy upgrades to increase profits, speed up investments, and unlock new opportunities.",
        highlight: "Always upgrade when possible",
      },
      {
        title: "Prestige System",
        description: "Cash out to earn Prestige Points. Use them to unlock permanent bonuses and new ranks.",
        highlight: "Prestige resets your run but keeps upgrades",
      },
      {
        title: "You're Ready!",
        description: "Start with $100 and make your first investment. Your journey to wealth begins now.",
        highlight: "Tap to start investing",
      },
    ];

    const nextStep = () => {
      if (onboardingStep < onboardingSteps.length - 1) {
        setOnboardingStep(onboardingStep + 1);
      } else {
        setShowOnboarding(false);
        setOnboardingComplete(true);
        saveState({ onboardingComplete: true });
      }
    };

    const current = onboardingSteps[onboardingStep];

    return (
      <SafeAreaView style={styles.onboardingContainer} testID="onboarding-screen">
        <LinearGradient
          colors={[C.bg, C.bgSoft, C.bg]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.onboardingContent}>
          <View style={styles.onboardingProgress}>
            {onboardingSteps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i <= onboardingStep && { backgroundColor: C.accent },
                  i < onboardingStep && { backgroundColor: C.accentDeep },
                ]}
              />
            ))}
          </View>

          <Animated.View style={[styles.onboardingCard, slideStyle]}>
            <Text style={styles.onboardingTitle}>{current.title}</Text>
            <Text style={styles.onboardingDescription}>{current.description}</Text>
            <View style={styles.onboardingHighlight}>
              <Text style={styles.onboardingHighlightText}>{current.highlight}</Text>
            </View>
          </Animated.View>

          <Pressable
            onPress={nextStep}
            style={({ pressed }) => [
              styles.onboardingButton,
              pressed && styles.onboardingButtonPressed,
            ]}
            testID="onboarding-next"
          >
            <Text style={styles.onboardingButtonText}>
              {onboardingStep === onboardingSteps.length - 1 ? "START INVESTING" : "NEXT"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setShowOnboarding(false);
              setOnboardingComplete(true);
              saveState({ onboardingComplete: true });
            }}
            style={styles.onboardingSkip}
            hitSlop={16}
          >
            <Text style={styles.onboardingSkipText}>Skip Tutorial</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // Main Game Screen
  // ============================================================
  return (
    <SafeAreaView style={styles.safe} testID="game-screen">
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.flashOverlay, flashStyle]}
      />

      {/* Celebration Banner */}
      {celebrationBanner && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.celebrationOverlay,
          ]}
        >
          <LinearGradient
            colors={[`${C.accent}30`, `${C.accent}10`, `${C.accent}30`]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.celebrationContent}>
            <Text style={styles.celebrationText}>{celebrationBanner}</Text>
          </View>
        </Animated.View>
      )}

      {/* HEADER */}
      <LinearGradient
        colors={[C.bgSoft, C.bg]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={handleSecretTap}
            hitSlop={8}
            testID="secret-tap-target"
            accessibilityLabel="Portfolio Balance"
          >
            <Text style={styles.balanceLabel}>PORTFOLIO BALANCE</Text>
          </Pressable>
          <View style={styles.headerRightRow}>
            <Pressable
              onPress={toggleMusic}
              hitSlop={12}
              style={styles.iconChip}
              testID="music-toggle"
            >
              <Text style={styles.iconChipText}>
                {musicEnabled ? "MUSIC ON" : "MUSIC OFF"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { sound.play("click"); setShowTree(true); }}
              hitSlop={12}
              style={[styles.iconChip, { borderColor: rankMeta.tint, backgroundColor: `${rankMeta.tint}18`, marginLeft: 6 }]}
              testID="open-tree"
            >
              <Text style={[styles.iconChipText, { color: rankMeta.tint }]}>
                {rankMeta.short.toUpperCase()} · TREE
              </Text>
            </Pressable>
          </View>
        </View>

        <Animated.View style={[styles.balanceRow, balanceStyle]}>
          <Text style={styles.balance} testID="balance-value">{money(displayBalance)}</Text>
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
            <Text style={styles.slotPillText}>Slots {actives.length}/{slots}</Text>
          </View>
          {prestige > 0 && (
            <View style={[styles.pill, { borderColor: C.gold, backgroundColor: `${C.gold}22` }]} testID="prestige-pill">
              <Text style={[styles.pillText, { color: C.gold }]}>
                ★ {prestige} PP · +{(currentBonusPct).toFixed(0)}%
              </Text>
            </View>
          )}
          {actives.length === 0 && (
            <View style={styles.availPill}>
              <Text style={styles.availText}>Available to invest</Text>
            </View>
          )}
          {computePassiveRate(levels.passive, treeEffects) > 0 && (
            <View style={styles.passivePill} testID="passive-pill">
              <Text style={styles.passiveText}>
                +${computePassiveRate(levels.passive, treeEffects).toFixed(2)}/s
              </Text>
            </View>
          )}
          {treeEffects.savingsRatePerSec > 0 && (
            <View style={[styles.pill, { borderColor: C.gold, backgroundColor: `${C.gold}18` }]} testID="savings-pill">
              <Text style={[styles.pillText, { color: C.gold }]}>
                Savings +{(treeEffects.savingsRatePerSec * 3600 * 100).toFixed(1)}%/h
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
          <View style={[styles.banner, { backgroundColor: `${C.accent}18`, borderColor: `${C.accent}55` }]} testID="bailout-banner">
            <Text style={[styles.bannerText, { color: C.accent }]}>
              Stimulus received — {money(treeEffects.bailoutAmount)} added
            </Text>
            <Pressable onPress={() => setBailoutNotice(false)} hitSlop={12}>
              <Text style={[styles.bannerDismiss, { color: C.accent }]}>OK</Text>
            </Pressable>
          </View>
        )}
        {rankUpBanner && (
          <View style={[styles.banner, { backgroundColor: `${RANK_META[rankUpBanner].tint}22`, borderColor: RANK_META[rankUpBanner].tint }]} testID="rankup-banner">
            <Text style={[styles.bannerText, { color: RANK_META[rankUpBanner].tint }]}>
              Rank up! Welcome, {RANK_META[rankUpBanner].name}
            </Text>
            <Pressable onPress={() => setRankUpBanner(null)} hitSlop={12}>
              <Text style={[styles.bannerDismiss, { color: RANK_META[rankUpBanner].tint }]}>OK</Text>
            </Pressable>
          </View>
        )}
        {prestigeCelebrate > 0 && (
          <View style={[styles.banner, { backgroundColor: `${C.gold}22`, borderColor: C.gold }]} testID="prestige-celebrate">
            <Text style={[styles.bannerText, { color: C.gold }]}>
              +{prestigeCelebrate} PP earned — run #{totalPrestiges}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {actives.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ACTIVE INVESTMENTS</Text>
            {actives.map((a) => {
              const pkg = packages.find((p) => p.id === a.pkgId);
              if (!pkg) return null;
              const total = a.endsAt - a.startedAt;
              const remaining = Math.max(0, a.endsAt - now);
              const progress = total > 0 ? Math.min(1, 1 - remaining / total) : 1;
              const effPct = computeProfitPct(pkg, levels.yield, prestige, treeEffects, actives.length, null, prestigeUpgrades.foundation, legacyUpgrades);
              const projected = a.cost * effPct;
              return (
                <View key={a.runId} style={styles.activeCard} testID={`active-${a.runId}`}>
                  <View style={styles.activeHeaderRow}>
                    <View style={[styles.activeIcon, { backgroundColor: `${pkg.tint}22`, borderColor: pkg.tint }]}>
                      <Text style={[styles.activeIconText, { color: pkg.tint }]}>
                        +{(effPct * 100).toFixed(0)}%
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeName}>{pkg.name}</Text>
                      <Text style={styles.activeMeta}>{money(a.cost)} → +{money(projected)}</Text>
                    </View>
                    <Text style={styles.activeCountdown}>{fmtSecs(remaining)}</Text>
                  </View>
                  <View style={styles.activeBarTrack}>
                    <LinearGradient
                      colors={[C.accent, C.accentDeep]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.activeBarFill, { width: `${progress * 100}%` }]}
                    />
                  </View>
                  <Pressable
                    onPress={() => accelerate(a.runId)}
                    style={({ pressed }) => [styles.accelerateBtn, pressed && { transform: [{ scale: 0.97 }] }]}
                    testID={`accelerate-${a.runId}`}
                  >
                    <LinearGradient
                      colors={["rgba(0,229,255,0.20)", "rgba(0,229,255,0.05)"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.accelerateText}>ACCELERATE</Text>
                    <Text style={styles.accelerateHint}>
                      {treeEffects.autoAccelStrength > 0 ? "Auto-tap active · manual for burst" : "Tap to shave time"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        <Text style={[styles.sectionTitle, actives.length > 0 && { marginTop: 20 }]}>
          INVESTMENT PACKAGES
        </Text>

        {packages.map((pkg) => {
          const affordable = balance >= pkg.cost;
          const isSelected = pkg.id === selectedId;
          const disabled = !affordable;
          const effPct = computeProfitPct(pkg, levels.yield, prestige, treeEffects, Math.max(1, actives.length + 1), null, prestigeUpgrades.foundation, legacyUpgrades);
          const effDur = computeDuration(pkg, levels.turbo, treeEffects, null, prestigeUpgrades.foundation, legacyUpgrades);
          const projectedProfit = pkg.cost * effPct;
          const roi = `+${(effPct * 100).toFixed(0)}%`;
          return (
            <Animated.View key={pkg.id} style={isSelected ? selectedPulseStyle : undefined}>
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
                  pressed && !disabled && { transform: [{ scale: 0.99 }] },
                ]}
                testID={`package-${pkg.id}`}
              >
                {isSelected && !disabled && (
                  <LinearGradient
                    colors={["rgba(0,229,255,0.14)", "rgba(0,229,255,0)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
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
              </Pressable>
            </Animated.View>
          );
        })}

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
                pressed && affordable && { transform: [{ scale: 0.99 }] },
                maxed && { borderColor: C.accent, backgroundColor: C.panelElevated },
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
                  <Text style={[styles.upgradeEffect, { color: u.tint }]}>Current: {u.effect(level)}</Text>
                </View>
                <View style={styles.upgradeCta}>
                  {maxed ? (
                    <View style={styles.maxedPill}><Text style={styles.maxedText}>MAX</Text></View>
                  ) : (
                    <>
                      <Text style={[styles.upgradeCost, !affordable && { color: C.textMuted }]} testID={`upgrade-cost-${u.id}`}>{money(cost)}</Text>
                      <Text style={[styles.upgradeBuy, !affordable && { color: C.textMuted }]}>BUY</Text>
                    </>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        {/* Prestige summary */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>PRESTIGE</Text>
        <Pressable
          onPress={() => { sound.play("click"); setShowTree(true); }}
          style={({ pressed }) => [styles.prestigeSummary, pressed && { transform: [{ scale: 0.99 }] }]}
          testID="prestige-summary"
        >
          <LinearGradient
            colors={[`${C.gold}22`, `${C.accent}18`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.prestigeSummaryRow}>
            <View style={[styles.rankBadge, { borderColor: rankMeta.tint, backgroundColor: `${rankMeta.tint}22` }]}>
              <Text style={[styles.rankBadgeIcon, { color: rankMeta.tint }]}>{rankMeta.icon}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.prestigeSummaryTitle}>{rankMeta.name}</Text>
              <Text style={styles.prestigeSummarySub}>
                {prestige} PP · +{currentBonusPct.toFixed(0)}% profit · {totalPrestiges} cash-outs
              </Text>
              {canPrestige && (
                <Text style={[styles.prestigeSummarySub, { color: C.gold, marginTop: 4 }]}>
                  Ready to cash out for +{prestigeGainAvailable} PP
                </Text>
              )}
            </View>
            <Text style={styles.prestigeSummaryChevron}>▶</Text>
          </View>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>

      <View style={styles.ctaBar}>
        <Animated.View style={ctaShakeStyle}>
          <Pressable
            onPress={invest}
            style={({ pressed }) => [
              styles.investBtn,
              !canInvest && styles.investBtnDisabled,
              pressed && canInvest && { transform: [{ scale: 0.98 }] },
            ]}
            testID="invest-button"
          >
            {canInvest && (
              <LinearGradient
                colors={[C.accent, C.accentDeep]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill} pointerEvents="none"
              />
            )}
            <View style={styles.investContent}>
              <Text style={[styles.investLabel, !canInvest && { color: C.loss }]} testID="invest-label">
                {ctaLabel}
              </Text>
              <Text style={[styles.investSub, !canInvest && { color: C.textMuted, opacity: 1 }]}>
                {ctaSub}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Developer menu overlay (hidden gesture: 7 taps on "PORTFOLIO BALANCE" within 3s) */}
      {showDebug && (
        <View style={styles.debugOverlay} testID="debug-overlay">
          <View style={styles.debugCard}>
            <View style={styles.debugHeader}>
              <Text style={styles.debugTitle}>DEVELOPER MENU</Text>
              <Pressable
                onPress={closeDebug}
                hitSlop={12}
                testID="debug-close"
                style={styles.debugCloseBtn}
              >
                <Text style={styles.debugCloseText}>✕</Text>
              </Pressable>
            </View>

            {!debugAuthed ? (
              <View>
                <Text style={styles.debugLabel}>Password required</Text>
                <TextInput
                  value={debugPassword}
                  onChangeText={(v) => { setDebugPassword(v); setDebugPwError(false); }}
                  onSubmitEditing={submitDebugPassword}
                  placeholder="••••"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry
                  keyboardType="numeric"
                  autoFocus
                  style={[styles.debugInput, debugPwError && styles.debugInputError]}
                  testID="debug-password-input"
                />
                {debugPwError && (
                  <Text style={styles.debugErrorText} testID="debug-password-error">
                    Incorrect password
                  </Text>
                )}
                <Pressable
                  onPress={submitDebugPassword}
                  style={({ pressed }) => [
                    styles.debugActionBtn,
                    styles.debugActionPrimary,
                    pressed && { opacity: 0.85 },
                  ]}
                  testID="debug-password-submit"
                >
                  <Text style={styles.debugActionText}>UNLOCK</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <View style={styles.debugSection}>
                  <Text style={styles.debugLabel}>Add money</Text>
                  <View style={styles.debugRow}>
                    <TextInput
                      value={debugMoneyInput}
                      onChangeText={setDebugMoneyInput}
                      placeholder="Amount"
                      placeholderTextColor={C.textMuted}
                      keyboardType="numeric"
                      style={[styles.debugInput, { flex: 1, marginBottom: 0 }]}
                      testID="debug-money-input"
                    />
                    <Pressable
                      onPress={devAddMoney}
                      style={({ pressed }) => [
                        styles.debugActionBtn,
                        styles.debugActionSecondary,
                        { marginLeft: 8, marginTop: 0, flex: 0 },
                        pressed && { opacity: 0.85 },
                      ]}
                      testID="debug-add-money"
                    >
                      <Text style={styles.debugActionText}>ADD</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.debugSection}>
                  <Text style={styles.debugLabel}>Add prestige points</Text>
                  <View style={styles.debugRow}>
                    <TextInput
                      value={debugPPInput}
                      onChangeText={setDebugPPInput}
                      placeholder="Amount"
                      placeholderTextColor={C.textMuted}
                      keyboardType="numeric"
                      style={[styles.debugInput, { flex: 1, marginBottom: 0 }]}
                      testID="debug-pp-input"
                    />
                    <Pressable
                      onPress={devAddPP}
                      style={({ pressed }) => [
                        styles.debugActionBtn,
                        styles.debugActionSecondary,
                        { marginLeft: 8, marginTop: 0, flex: 0 },
                        pressed && { opacity: 0.85 },
                      ]}
                      testID="debug-add-pp"
                    >
                      <Text style={styles.debugActionText}>ADD</Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  onPress={closeDebug}
                  style={({ pressed }) => [
                    styles.debugActionBtn,
                    styles.debugActionClose,
                    pressed && { opacity: 0.85 },
                  ]}
                  testID="debug-close-btn"
                >
                  <Text style={[styles.debugActionText, { color: C.text }]}>CLOSE</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================
// TreeColumn — renders one path of the skill tree
// ============================================================
function TreeColumn({
  title, subtitle, icon, tint, path, skills, prestige, rank, onBuy,
}: {
  title: string; subtitle: string; icon: string; tint: string;
  path: SkillPath;
  skills: SkillLevels;
  prestige: number;
  rank: Rank;
  onBuy: (n: SkillNode) => void;
}) {
  const nodes = SKILLS.filter((s) => s.path === path).sort((a, b) => a.row - b.row);
  return (
    <View style={styles.treeCol}>
      <View style={[styles.treeColHeader, { borderColor: tint, backgroundColor: `${tint}18` }]}>
        <Text style={[styles.treeColIcon, { color: tint }]}>{icon}</Text>
        <Text style={[styles.treeColTitle, { color: tint }]}>{title}</Text>
        <Text style={styles.treeColSub}>{subtitle}</Text>
      </View>

      {nodes.map((n, i) => {
        const level = skills[n.id] ?? 0;
        const maxed = level >= n.maxLevel;
        const rankOk = rankMeetsRequirement(rank, n.requiredRank);
        const missing = missingPrereqs(n, skills);
        const nextCost = maxed ? 0 : skillCost(n, level);
        const affordable = rankOk && missing.length === 0 && !maxed && prestige >= nextCost;
        const locked = !rankOk || missing.length > 0;
        const hasPrereq = n.prereqs.length > 0;
        return (
          <View key={n.id} style={{ width: "100%", alignItems: "center" }}>
            {i > 0 && (
              <View
                style={[
                  styles.treeConnector,
                  {
                    backgroundColor:
                      (level > 0 || !hasPrereq) ? `${tint}90` : `${C.border}90`,
                  },
                ]}
              />
            )}
            <Pressable
              onPress={() => onBuy(n)}
              disabled={locked || maxed || !affordable}
              style={({ pressed }) => [
                styles.skillNode,
                { borderColor: level > 0 ? tint : C.border },
                level > 0 && { backgroundColor: `${tint}15` },
                maxed && { borderColor: tint, backgroundColor: `${tint}28` },
                locked && styles.skillNodeLocked,
                !affordable && !locked && !maxed && styles.skillNodeDim,
                pressed && affordable && { transform: [{ scale: 0.97 }] },
              ]}
              testID={`skill-${n.id}`}
            >
              <Text style={[styles.skillName, { color: level > 0 ? tint : C.text }]}>
                {n.short}
              </Text>
              <Text style={styles.skillLvl}>
                {maxed ? "MAX" : `Lv ${level}/${n.maxLevel}`}
              </Text>
              <Text style={[styles.skillEffect, { color: level > 0 ? tint : C.textMuted }]} numberOfLines={2}>
                {n.effect(level)}
              </Text>
              {locked ? (
                <View style={styles.skillLockBox}>
                  <Text style={styles.skillLockText}>
                    {!rankOk ? `${RANK_META[n.requiredRank].short} rank` : missing[0]}
                  </Text>
                </View>
              ) : maxed ? (
                <View style={[styles.skillCostBox, { borderColor: tint }]}>
                  <Text style={[styles.skillCostText, { color: tint }]}>OWNED</Text>
                </View>
              ) : (
                <View style={[styles.skillCostBox, { borderColor: affordable ? C.gold : C.border }]}>
                  <Text style={[styles.skillCostText, { color: affordable ? C.gold : C.textMuted }]} testID={`skill-cost-${n.id}`}>
                    {nextCost} PP
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flashOverlay: { backgroundColor: C.accent, zIndex: 1 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderText: { color: C.textMuted, fontSize: 14, fontWeight: "700" },

  header: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRightRow: { flexDirection: "row", alignItems: "center" },
  balanceLabel: { color: C.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  iconChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.panel,
  },
  iconChipText: { color: C.accent, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },

  balanceRow: { position: "relative", marginTop: 6 },
  balance: { color: C.text, fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  floatingProfit: {
    position: "absolute", right: 0, top: 0,
    color: C.gain, fontSize: 20, fontWeight: "900",
  },
  pillRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8, flexWrap: "wrap" },
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
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },

  banner: {
    marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: "rgba(0,255,136,0.10)", borderWidth: 1, borderColor: "rgba(0,255,136,0.35)",
  },
  bannerText: { color: C.gain, fontSize: 13, fontWeight: "700", flex: 1 },
  bannerDismiss: { color: C.gain, fontSize: 13, fontWeight: "900", letterSpacing: 1, marginLeft: 12 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { color: C.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 2, marginBottom: 12, marginLeft: 4 },

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
  accelerateText: { color: C.accent, fontSize: 14, fontWeight: "900", letterSpacing: 1.5 },
  accelerateHint: { color: C.textMuted, fontSize: 10, fontWeight: "700", marginTop: 1 },

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
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardIcon: {
    width: 56, height: 56, borderRadius: 16, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  cardIconText: { fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  cardMain: { flex: 1 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: "800", flexShrink: 1, marginRight: 8 },
  badgeTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: "rgba(0,229,255,0.08)", borderWidth: 1, borderColor: "rgba(0,229,255,0.25)",
  },
  badgeTagText: { color: C.accent, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  badgeLoss: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: "rgba(255,77,77,0.10)", borderWidth: 1, borderColor: "rgba(255,77,77,0.35)",
  },
  badgeLossText: { color: C.loss, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  cardMetaRow: { flexDirection: "row" },
  metaCell: { flex: 1 },
  metaLabel: { color: C.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 2, textTransform: "uppercase" },
  metaValue: { color: C.text, fontSize: 14, fontWeight: "800" },
  metaGain: { color: C.gain },

  upgradeCard: {
    backgroundColor: C.panel, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  upgradeCardDim: { opacity: 0.6 },
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
  upgradeBuy: { color: C.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 4 },
  maxedPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: "rgba(0,229,255,0.15)", borderWidth: 1, borderColor: C.accent,
  },
  maxedText: { color: C.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1 },

  prestigeSummary: {
    borderRadius: 20, borderWidth: 1, borderColor: C.gold,
    padding: 14, overflow: "hidden", backgroundColor: C.panelElevated,
    shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  prestigeSummaryRow: { flexDirection: "row", alignItems: "center" },
  prestigeSummaryTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  prestigeSummarySub: { color: C.textMuted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  prestigeSummaryChevron: { color: C.gold, fontSize: 18, fontWeight: "900", marginLeft: 8 },

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
    backgroundColor: C.panelElevated, borderWidth: 1, borderColor: "rgba(255,77,77,0.35)", shadowOpacity: 0,
  },
  investContent: { alignItems: "center", justifyContent: "center" },
  investLabel: { color: "#001018", fontSize: 20, fontWeight: "900", letterSpacing: 0.3 },
  investSub: { color: "#001018", fontSize: 12, fontWeight: "700", marginTop: 2, opacity: 0.8 },

  // Prestige tree screen
  treeHeader: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  treeHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnText: { color: C.accent, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  treeTitle: { color: C.text, fontSize: 16, fontWeight: "900", letterSpacing: 2 },

  rankCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.panelElevated, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  rankBadge: {
    width: 60, height: 60, borderRadius: 20, borderWidth: 2,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  rankBadgeIcon: { fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  rankLabel: { color: C.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  rankName: { fontSize: 18, fontWeight: "900", letterSpacing: 0.3, marginTop: 2 },
  rankBar: {
    height: 6, borderRadius: 999, backgroundColor: C.panel,
    marginTop: 8, overflow: "hidden", borderWidth: 1, borderColor: C.border,
  },
  rankBarFill: { height: "100%", borderRadius: 999 },
  rankProgress: { color: C.textMuted, fontSize: 11, fontWeight: "700", marginTop: 4 },

  treeStats: {
    flexDirection: "row", alignItems: "center",
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border,
  },
  treeStatCell: { flex: 1, alignItems: "center" },
  treeStatDivider: { width: 1, height: 28, backgroundColor: C.border },
  treeStatLabel: { color: C.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  treeStatValue: { color: C.text, fontSize: 16, fontWeight: "900" },

  upgradesSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  upgradesSectionTitle: { color: C.text, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginBottom: 10 },
  prestigeUpgradeCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.panelElevated, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
  },
  prestigeUpgradeCardOwned: {
    backgroundColor: `${C.gold}10`,
  },
  prestigeUpgradeCardLeft: { flex: 1 },
  prestigeUpgradeCardRight: { alignItems: "flex-end" },
  prestigeUpgradeCardName: { color: C.text, fontSize: 15, fontWeight: "800" },
  prestigeUpgradeCardDesc: { color: C.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  prestigeUpgradeCardStatus: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  prestigeUpgradeOwnedBadge: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  prestigeUpgradeOwnedIcon: { color: "#001018", fontSize: 14, fontWeight: "900" },
  prestigeUpgradeCostBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1,
  },
  prestigeUpgradeCostText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },

  // Legacy Endgame screen
  legacyHeader: {
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  legacyHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  legacyTitle: { color: C.text, fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  legacyStats: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.panelElevated, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  legacyStatCell: { flex: 1, alignItems: "center" },
  legacyStatDivider: { width: 1, height: 28, backgroundColor: C.border },
  legacyStatLabel: { color: C.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  legacyStatValue: { color: C.text, fontSize: 16, fontWeight: "900" },
  ultimateBanner: {
    marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: "rgba(255,213,79,0.2)", borderWidth: 1, borderColor: C.gold,
    alignItems: "center",
  },
  ultimateBannerText: { color: C.gold, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  ultimateBannerSub: { color: C.text, fontSize: 11, fontWeight: "700", marginTop: 4 },
  legacyBody: { flex: 1 },
  legacyBodyContent: { padding: 20, paddingBottom: 40 },
  legacyCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.panelElevated, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 12,
  },
  legacyCardOwned: {
    backgroundColor: `${C.gold}10`,
  },
  legacyCardFinal: {
    borderWidth: 2, borderColor: C.gold,
    backgroundColor: "rgba(255,213,79,0.15)",
  },
  legacyCardLeft: { flex: 1 },
  legacyCardRight: { alignItems: "flex-end" },
  legacyCardName: { color: C.text, fontSize: 16, fontWeight: "800" },
  legacyCardDesc: { color: C.textMuted, fontSize: 12, fontWeight: "600", marginTop: 3 },
  legacyCardEffect: { color: C.accent, fontSize: 11, fontWeight: "700", marginTop: 4 },
  legacyCardStatus: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  legacyOwnedBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },
  legacyOwnedIcon: { color: "#001018", fontSize: 16, fontWeight: "900" },
  legacyCostBadge: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1,
  },
  legacyCostText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },

  // Loading screen
  loadingContainer: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogo: {
    marginBottom: 24,
  },
  loadingLogoInner: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.panelElevated,
  },
  loadingLogoText: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
  },
  loadingTextContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  loadingTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 8,
  },
  loadingSubtitle: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 1,
  },
  loadingSpinner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spinnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Onboarding screen
  onboardingContainer: {
    flex: 1,
    backgroundColor: C.bg,
  },
  onboardingContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "space-between",
  },
  onboardingProgress: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 40,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  onboardingCard: {
    backgroundColor: C.panelElevated,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.border,
    width: "100%",
    marginBottom: 40,
  },
  onboardingTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 12,
  },
  onboardingDescription: {
    color: C.textMuted,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 16,
  },
  onboardingHighlight: {
    backgroundColor: `${C.accent}15`,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: `${C.accent}30`,
  },
  onboardingHighlightText: {
    color: C.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  onboardingButton: {
    backgroundColor: C.accent,
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  onboardingButtonPressed: {
    opacity: 0.8,
  },
  onboardingButtonText: {
    color: "#001018",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  onboardingSkip: {
    padding: 8,
  },
  onboardingSkipText: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },

  // Celebration banner
  celebrationOverlay: {
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  celebrationContent: {
    backgroundColor: C.panelElevated,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: C.accent,
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  celebrationText: {
    color: C.accent,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },

  cashOutBtn: {
    marginTop: 14, height: 56, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: C.gold, overflow: "hidden",
    backgroundColor: `${C.gold}15`,
  },
  cashOutBtnDim: { borderColor: C.border, backgroundColor: C.panel },
  cashOutBtnArmed: { backgroundColor: C.gold, borderColor: C.gold },
  cashOutBtnText: { color: C.gold, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  cashOutBtnSub: { color: "#001018", fontSize: 11, fontWeight: "800", marginTop: 2 },

  treeBody: { flex: 1 },
  treeBodyContent: { paddingHorizontal: 8, paddingTop: 12 },
  treeGridRow: { flexDirection: "row", alignItems: "flex-start" },
  treeCol: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  treeColHeader: {
    width: "100%", paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
    alignItems: "center",
  },
  treeColIcon: { fontSize: 14, fontWeight: "900" },
  treeColTitle: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginTop: 2 },
  treeColSub: { color: C.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.3, marginTop: 1 },

  treeConnector: {
    width: 3, height: 18, borderRadius: 2,
  },

  skillNode: {
    width: "100%", minHeight: 116, borderRadius: 14, borderWidth: 1,
    backgroundColor: C.panel, padding: 8, alignItems: "center",
  },
  skillNodeLocked: { opacity: 0.6, borderStyle: "dashed" },
  skillNodeDim: { opacity: 0.75 },
  skillName: { fontSize: 11, fontWeight: "900", letterSpacing: 0.3, textAlign: "center" },
  skillLvl: { color: C.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 },
  skillEffect: { fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 4, lineHeight: 12 },
  skillLockBox: {
    marginTop: "auto", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    backgroundColor: "rgba(255,77,77,0.10)", borderWidth: 1, borderColor: "rgba(255,77,77,0.35)",
  },
  skillLockText: { color: C.loss, fontSize: 9, fontWeight: "900", letterSpacing: 0.3 },
  skillCostBox: {
    marginTop: "auto", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1,
  },
  skillCostText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  // Developer menu
  debugOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center",
    padding: 24, zIndex: 100,
  },
  debugCard: {
    width: "100%", maxWidth: 360,
    backgroundColor: C.panelElevated,
    borderRadius: 20, borderWidth: 1, borderColor: C.accent,
    padding: 20,
    shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  debugHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  debugTitle: {
    color: C.accent, fontSize: 14, fontWeight: "900", letterSpacing: 2,
  },
  debugCloseBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
  },
  debugCloseText: { color: C.textMuted, fontSize: 16, fontWeight: "900" },
  debugSection: { marginBottom: 14 },
  debugLabel: {
    color: C.textMuted, fontSize: 10, fontWeight: "800",
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8,
  },
  debugRow: { flexDirection: "row", alignItems: "center" },
  debugInput: {
    backgroundColor: C.panel, color: C.text,
    fontSize: 15, fontWeight: "700",
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: C.border,
    marginBottom: 8,
  },
  debugInputError: { borderColor: C.loss },
  debugErrorText: {
    color: C.loss, fontSize: 11, fontWeight: "700", marginBottom: 8,
  },
  debugActionBtn: {
    marginTop: 8, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16,
  },
  debugActionPrimary: { backgroundColor: C.accent },
  debugActionSecondary: {
    backgroundColor: C.accent, height: 40,
  },
  debugActionClose: {
    backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, marginTop: 4,
  },
  debugActionText: {
    color: "#001018", fontSize: 12, fontWeight: "900", letterSpacing: 1,
  },
});
