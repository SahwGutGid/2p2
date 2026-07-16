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
import { Image as ExpoImage } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSoundEngine } from "@/src/game/sounds";
import { EndingScreen } from "@/src/game/EndingScreen";
import { HoldButton } from "@/src/components/HoldButton";
import { useBackgroundMusic } from "@/src/game/music";
import { LoadingScreen } from "@/src/components/LoadingScreen";
import { SettingsScreen } from "@/src/components/SettingsScreen";
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
  getNewsForProgression,
  NEWS_ROTATION_INTERVAL_MS,
  type NewsItem,
  getLeaderboard,
  LEADERBOARD_CATEGORIES,
  LEADERBOARD_REFRESH_INTERVAL_MS,
  type LeaderboardCategory,
  type LeaderboardData,
} from "@/src/game/features";
import { formatCurrency, formatNumber, formatDuration, formatSeconds, formatPercent } from "@/src/utils/format";
import { getTheme, type ThemeColors } from "@/src/utils/theme";

// ---------- Theme ----------
const C = {
  bg: "#FFFFFF",
  bgSoft: "#F7F8FA",
  panel: "#FFFFFF",
  panelElevated: "#FFFFFF",
  accent: "#006B5E",
  accentDeep: "#005A4E",
  gold: "#F59E0B",
  gain: "#00A67E",
  loss: "#DC2626",
  info: "#2563EB",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
};

// ---------- Packages ----------
type PackageCategory = "consumer" | "business" | "diversified" | "property" | "sector" | "institutional" | "premium";

type Pkg = {
  id: string;
  name: string;
  tag: string;
  category: PackageCategory;
  cost: number;
  durationMs: number;
  profitPct: number;
  tint: string;
  unlocked?: (t: TreeEffects) => boolean; // gated packages
  unlockRequirement?: string; // display text for locked packages
  isPremium?: boolean; // special styling for premium packages
};

const BASE_PACKAGES: Pkg[] = [
  // Consumer Lending (Early Game - Available from start)
  { id: "micro-loan", name: "Micro Loan", tag: "Low risk", category: "consumer", cost: 10, durationMs: 10000, profitPct: 0.30, tint: "#5EE1B0" },
  { id: "personal-loan", name: "Personal Loan", tag: "Low risk", category: "consumer", cost: 50, durationMs: 20000, profitPct: 0.50, tint: "#5EE1B0" },
  { id: "consumer-credit", name: "Consumer Credit Bundle", tag: "Medium", category: "consumer", cost: 200, durationMs: 45000, profitPct: 0.80, tint: "#5EE1B0" },
  
  // Business Financing (Early-Mid Game - Unlock via Prestige)
  { id: "small-business", name: "Small Business Loan", tag: "Medium", category: "business", cost: 500, durationMs: 90000, profitPct: 1.00, tint: "#00E5FF", unlocked: (t) => t.businessUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "business-expansion", name: "Business Expansion Fund", tag: "Medium", category: "business", cost: 2000, durationMs: 180000, profitPct: 1.30, tint: "#00E5FF", unlocked: (t) => t.businessUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "commercial-financing", name: "Commercial Financing", tag: "High", category: "business", cost: 8000, durationMs: 300000, profitPct: 1.60, tint: "#00E5FF", unlocked: (t) => t.businessUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  
  // Diversified Portfolios (Mid Game - Unlock via Prestige)
  { id: "credit-portfolio", name: "Credit Portfolio", tag: "Low risk", category: "diversified", cost: 1500, durationMs: 480000, profitPct: 1.80, tint: "#FFB84D", unlocked: (t) => t.diversifiedUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "diversified-loan", name: "Diversified Loan Portfolio", tag: "Medium", category: "diversified", cost: 5000, durationMs: 720000, profitPct: 2.20, tint: "#FFB84D", unlocked: (t) => t.diversifiedUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "international-credit", name: "International Credit Portfolio", tag: "High", category: "diversified", cost: 15000, durationMs: 1080000, profitPct: 2.60, tint: "#FFB84D", unlocked: (t) => t.diversifiedUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  
  // Property Investments (Mid-Late Game - Unlock via Prestige)
  { id: "mortgage-portfolio", name: "Mortgage Portfolio", tag: "Low risk", category: "property", cost: 3000, durationMs: 1800000, profitPct: 3.00, tint: "#FFD54F", unlocked: (t) => t.propertyUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "commercial-property", name: "Commercial Property Fund", tag: "Medium", category: "property", cost: 10000, durationMs: 2700000, profitPct: 3.50, tint: "#FFD54F", unlocked: (t) => t.propertyUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "real-estate-dev", name: "Real Estate Development", tag: "High", category: "property", cost: 30000, durationMs: 3600000, profitPct: 4.00, tint: "#FFD54F", unlocked: (t) => t.propertyUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  
  // Sector Funds (Late Game - Unlock via Prestige)
  { id: "renewable-energy", name: "Renewable Energy Fund", tag: "Growth", category: "sector", cost: 8000, durationMs: 5400000, profitPct: 4.50, tint: "#B9F2FF", unlocked: (t) => t.sectorUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "healthcare-growth", name: "Healthcare Growth Fund", tag: "Growth", category: "sector", cost: 25000, durationMs: 7200000, profitPct: 5.00, tint: "#B9F2FF", unlocked: (t) => t.sectorUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "tech-venture", name: "Technology Venture Fund", tag: "High", category: "sector", cost: 75000, durationMs: 10800000, profitPct: 5.50, tint: "#B9F2FF", unlocked: (t) => t.sectorUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "ai-infrastructure", name: "AI Infrastructure Fund", tag: "Very high", category: "sector", cost: 200000, durationMs: 14400000, profitPct: 6.00, tint: "#B9F2FF", unlocked: (t) => t.sectorUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  
  // Institutional Investments (End Game - Unlock via Prestige)
  { id: "corporate-bond", name: "Corporate Bond Portfolio", tag: "Low risk", category: "institutional", cost: 50000, durationMs: 21600000, profitPct: 6.50, tint: "#FF6EC7", unlocked: (t) => t.institutionalUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "private-equity", name: "Private Equity Portfolio", tag: "High", category: "institutional", cost: 150000, durationMs: 28800000, profitPct: 7.50, tint: "#FF6EC7", unlocked: (t) => t.institutionalUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "institutional-growth", name: "Institutional Growth Fund", tag: "High", category: "institutional", cost: 500000, durationMs: 36000000, profitPct: 8.50, tint: "#FF6EC7", unlocked: (t) => t.institutionalUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  { id: "global-investment", name: "Global Investment Portfolio", tag: "Very high", category: "institutional", cost: 1500000, durationMs: 43200000, profitPct: 9.50, tint: "#FF6EC7", unlocked: (t) => t.institutionalUnlocked, unlockRequirement: "Unlock via Prestige Tree" },
  
  // Premium P2P Packages (Late End Game - Unlock via Prestige)
  { id: "p2p-max-3", name: "P2P MAX 3", tag: "Premium", category: "premium", cost: 100000, durationMs: 1800000, profitPct: 5.00, tint: "#FFD700", unlocked: (t) => t.premiumUnlocked, unlockRequirement: "Unlock via Prestige Tree", isPremium: true },
  { id: "p2p-max-6", name: "P2P MAX 6", tag: "Premium", category: "premium", cost: 300000, durationMs: 3600000, profitPct: 6.00, tint: "#FFD700", unlocked: (t) => t.premiumUnlocked, unlockRequirement: "Unlock via Prestige Tree", isPremium: true },
  { id: "p2p-max-12", name: "P2P MAX 12", tag: "Premium", category: "premium", cost: 800000, durationMs: 7200000, profitPct: 7.00, tint: "#FFD700", unlocked: (t) => t.premiumUnlocked, unlockRequirement: "Unlock via Prestige Tree", isPremium: true },
  { id: "p2p-max-24", name: "P2P MAX 24", tag: "Premium", category: "premium", cost: 2000000, durationMs: 14400000, profitPct: 8.00, tint: "#FFD700", unlocked: (t) => t.premiumUnlocked, unlockRequirement: "Unlock via Prestige Tree", isPremium: true },
  { id: "p2p-safe", name: "P2P SAFE", tag: "Premium", category: "premium", cost: 5000000, durationMs: 36000000, profitPct: 9.00, tint: "#FFD700", unlocked: (t) => t.premiumUnlocked, unlockRequirement: "Unlock via Prestige Tree", isPremium: true },
];

const getPackages = (t: TreeEffects): Pkg[] =>
  BASE_PACKAGES.filter((p) => !p.unlocked || p.unlocked(t));

const getAllPackages = (): Pkg[] => BASE_PACKAGES;

const groupPackagesByCategory = (pkgs: Pkg[]): Record<PackageCategory, Pkg[]> => {
  const groups: Record<PackageCategory, Pkg[]> = {
    consumer: [],
    business: [],
    diversified: [],
    property: [],
    sector: [],
    institutional: [],
    premium: [],
  };
  for (const pkg of pkgs) {
    groups[pkg.category].push(pkg);
  }
  return groups;
};

const CATEGORY_NAMES: Record<PackageCategory, string> = {
  consumer: "Consumer Lending",
  business: "Business Financing",
  diversified: "Diversified Portfolios",
  property: "Property Investments",
  sector: "Sector Funds",
  institutional: "Institutional Investments",
  premium: "Premium P2P",
};

const CATEGORY_ORDER: PackageCategory[] = ["consumer", "business", "diversified", "property", "sector", "institutional", "premium"];

// Package ID migration for save compatibility
const PACKAGE_ID_MIGRATION: Record<string, string> = {
  "starter": "micro-loan",
  "growth": "personal-loan",
  "momentum": "consumer-credit",
  "realestate": "mortgage-portfolio",
  "crypto": "renewable-energy",
  "whale": "tech-venture",
  "contract": "corporate-bond",
  "legendary": "global-investment",
};

const migratePackageId = (oldId: string): string => {
  return PACKAGE_ID_MIGRATION[oldId] || oldId;
};

const cheapestCost = (t: TreeEffects) => getPackages(t)[0].cost;

// ---------- Upgrades (unchanged) ----------
type UpgradeId = "yield" | "turbo" | "passive" | "lucky" | "slots";
type Upgrade = {
  id: UpgradeId; name: string; description: string;
  effect: (level: number) => string;
  baseCost: number; costGrowth: number; maxLevel: number; tint: string;
};
const UPGRADES: Upgrade[] = [
  { id: "yield",   name: "Yield Boost",     description: "Increases profit multiplier by 6% per level",       effect: (l) => `+${fmtPct(l * 6)} profit`,               baseCost: 15,  costGrowth: 1.55, maxLevel: 15, tint: "#00FF88" },
  { id: "turbo",   name: "Turbo Trades",    description: "Reduces investment duration by 5% per level",     effect: (l) => `-${fmtPct(Math.min(60, l * 5))} time`,     baseCost: 25,  costGrowth: 1.6,  maxLevel: 12, tint: "#00E5FF" },
  { id: "passive", name: "Passive Yield",   description: "Generates $1.00/sec passive income per level",   effect: (l) => `+$${(l * 1.0).toFixed(2)}/sec`,                baseCost: 40,  costGrowth: 1.5,  maxLevel: 25, tint: "#FFB84D" },
  { id: "lucky",   name: "Lucky Streak",    description: "Adds 3% chance for 2× profit per level",        effect: (l) => `${fmtPct(Math.min(45, l * 3))} x2`,        baseCost: 100, costGrowth: 1.7,  maxLevel: 15, tint: "#FF6EC7" },
  { id: "slots",   name: "Portfolio Slots", description: "Adds 1 concurrent investment slot per level",    effect: (l) => `${l + 1} slot${l === 0 ? "" : "s"}`,           baseCost: 300, costGrowth: 2.5,  maxLevel: 4,  tint: "#00E5FF" },
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
  holdToPrestige: boolean;
};
const defaultSettings = (): Settings => ({
  music: true, sfx: true, haptics: true, notifications: true, holdToPrestige: true,
});

type CompletionStats = {
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
  gameComplete: boolean;
  endingPending: boolean;
  completionStats: CompletionStats | null;
  runTimeMs: number;
};
const SAVE_KEY = "investmentIdle:v6";
const LEGACY_KEYS = ["investmentIdle:v5", "investmentIdle:v4", "investmentIdle:v3", "investmentIdle:v2"];
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

const PRESTIGE_MIN_BALANCE = 10000;
const PRESTIGE_BONUS_PER_POINT = 0.05;
const computePrestigeGain = (balance: number) => {
  if (balance < PRESTIGE_MIN_BALANCE) return 0;
  return Math.floor(Math.sqrt(balance / PRESTIGE_MIN_BALANCE));
};

const defaultSave = (): SaveData => ({
  v: 6,
  balance: 100,
  selectedId: "micro-loan",
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
  gameComplete: false,
  endingPending: false,
  completionStats: null,
  runTimeMs: 0,
});

const prestigeBonus = (prestige: number) => 1 + PRESTIGE_BONUS_PER_POINT * prestige;

// Local aliases for centralized formatting functions
const money = formatCurrency;
const compact = formatNumber;
const fmtDuration = formatDuration;
const fmtSecs = formatSeconds;
const fmtPct = formatPercent;

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
  m *= 1 + 0.06 * yieldLevel;
  m *= prestigeBonus(prestige);
  m *= t.profitMult;
  if (hasFoundation) m *= 1.5;
  m *= t.endgameProfitMult;
  // Legacy upgrade multipliers
  if (legacyUpgrades["investors-foundation"]) m *= 1.3;
  if (legacyUpgrades["corporate-empire"]) m *= 1.15;
  if (legacyUpgrades["global-network"]) m *= 1.5;
  if (legacyUpgrades["ultimate-investor"]) m *= 2;
  // Market event bonuses
  if (market) {
    const ev = MARKET_EVENTS.find((e) => e.id === market.id);
    if (ev) {
      let marketMult = ev.profitMult ?? 1;
      if (legacyUpgrades["global-market"] && marketMult > 1) marketMult *= 1.3;
      if (legacyUpgrades["market-dominance"] && marketMult > 1) {
        marketMult *= 1.5; // Positive events +50% stronger
      }
      if (legacyUpgrades["market-dominance"] && marketMult < 1) {
        marketMult = 1 + (marketMult - 1) * 0.25; // Negative events reduced by 75%
      }
      m *= marketMult;
      const pkgBoost = ev.pkgBoost?.[pkg.id];
      if (pkgBoost) m *= 1 + pkgBoost;
    }
  }
  m *= 1 + t.slotSynergyPct * Math.max(0, filledSlots - 1);
  return m;
};

const computeDuration = (pkg: Pkg, turbo: number, t: TreeEffects, market: ActiveMarketEvent | null = null, hasFoundation: boolean = false, legacyUpgrades: Record<LegacyUpgradeId, boolean> = {} as Record<LegacyUpgradeId, boolean>) => {
  const turboRed = Math.min(0.60, 0.05 * turbo);
  let d = pkg.durationMs * t.durationMult * (1 - turboRed);
  if (hasFoundation) d /= 1.5;
  // Legacy upgrade speed bonuses
  if (legacyUpgrades["investors-foundation"]) d /= 1.2;
  if (legacyUpgrades["global-network"]) d /= 1.3;
  if (market) {
    const ev = MARKET_EVENTS.find((e) => e.id === market.id);
    if (ev?.durMult) d *= ev.durMult;
  }
  return Math.max(200, Math.round(d));
};

const computePassiveRate = (passiveLvl: number, t: TreeEffects, legacyUpgrades: Record<LegacyUpgradeId, boolean> = {} as Record<LegacyUpgradeId, boolean>) => {
  let rate = 1.0 * passiveLvl * t.passiveMult * t.endgamePassiveMult;
  if (legacyUpgrades["corporate-empire"]) rate += 138.89; // +$500K/h
  return rate;
};

const luckyChance = (level: number) => Math.min(0.45, 0.03 * level);
const slotCount = (level: number) => 1 + level;

let runIdCounter = 0;
const newRunId = () => `r${Date.now()}-${++runIdCounter}`;

// Accelerate: base reduction curve × treeEffects.accelStrengthMult × [autoStrength]
const baseAccelReductionMs = (remaining: number) =>
  Math.max(200, Math.min(400, remaining * 0.06));

// ============================================================
export default function Index() {
  const [showTree, setShowTree] = useState(false);
  const [showPrestigeInfo, setShowPrestigeInfo] = useState(false);
  const [showLegacyInfo, setShowLegacyInfo] = useState(false);

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
  const [showSettings, setShowSettings] = useState(false);

  // Game completion state
  const [gameComplete, setGameComplete] = useState(false);
  const [endingPending, setEndingPending] = useState(false);
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);

  // Loading screen state
  const [showLoading, setShowLoading] = useState(true);

  // Features state
  const [stats, setStats] = useState<Stats>(defaultStats());
  const [runTimeMs, setRunTimeMs] = useState<number>(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<AchievementId[]>([]);
  const [activeMarket, setActiveMarket] = useState<ActiveMarketEvent | null>(null);
  const [lastMarketRollAt, setLastMarketRollAt] = useState<number>(Date.now());
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  
  // News Feed state
  const [currentNews, setCurrentNews] = useState<NewsItem | null>(null);
  const [newsIndex, setNewsIndex] = useState(0);
  
  // Leaderboards state
  const [showLeaderboards, setShowLeaderboards] = useState(false);
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>("money");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  
  // Market event notification state
  const [showMarketBanner, setShowMarketBanner] = useState(false);

  // Sound and haptics
  const sound = useSoundEngine(settings.sfx);

  // Helper to trigger haptics only if enabled in settings
  const triggerHaptic = useCallback(async (hapticFn: () => Promise<void>) => {
    if (settings.haptics) {
      await hapticFn().catch(() => {});
    }
  }, [settings.haptics]);

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

  // Theme - always dark mode
  const theme = getTheme();

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
  const loadingLogoScale = useSharedValue(0);
  const loadingLogoOpacity = useSharedValue(0);
  const loadingTextOpacity = useSharedValue(0);

  useEffect(() => {
    loadingLogoScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) });
    loadingLogoOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
    loadingTextOpacity.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }));
  }, []);

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

  // Legacy screen slide-in
  const legacySlide = useSharedValue(0);
  useEffect(() => {
    legacySlide.value = withTiming(showLegacy ? 1 : 0, {
      duration: 300, easing: Easing.out(Easing.cubic),
    });
  }, [showLegacy, legacySlide]);

  // Main screen entrance fade
  const mainScreenOpacity = useSharedValue(0);
  useEffect(() => {
    if (loadingComplete && !showOnboarding && !endingPending) {
      mainScreenOpacity.value = withTiming(1, {
        duration: 400, easing: Easing.out(Easing.cubic),
      });
    }
  }, [loadingComplete, showOnboarding, endingPending]);

  // Loading screen spinner dots pulse
  const spinnerPulse = useSharedValue(0);
  useEffect(() => {
    spinnerPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    );
  }, []);

  // Calculate next goal (must be called before early returns)
  const nextGoal = useMemo(() => {
    if (stats.totalPPEarned >= LEGACY_UNLOCK_THRESHOLD) {
      return {
        title: "Legacy Endgame",
        description: `You've unlocked the Legacy system! Spend your Legacy Points on permanent upgrades.`,
        progress: "UNLOCKED",
        color: theme.legacy,
      };
    }
    if (balance >= PRESTIGE_MIN_BALANCE) {
      return {
        title: "Prestige",
        description: `Cash out to earn Prestige Points. Each PP gives +${fmtPct(5)} permanent profit bonus.`,
        progress: `Ready to cash out`,
        color: theme.legacy,
      };
    }
    if (prestige > 0) {
      return {
        title: "Build Wealth",
        description: `Reach ${money(PRESTIGE_MIN_BALANCE)} to prestige and earn permanent bonuses.`,
        progress: `${money(balance)} / ${money(PRESTIGE_MIN_BALANCE)}`,
        color: theme.gain,
      };
    }
    return {
      title: "Start Investing",
      description: `Make your first investment to begin building your portfolio.`,
      progress: actives.length > 0 ? "In progress" : "Not started",
      color: theme.upgrade,
    };
  }, [balance, prestige, stats.totalPPEarned, actives.length]);

  // Refs
  const finishRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nowTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const passiveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAccelRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAccelTapRef = useRef<number>(0);
  const lastAutoInvestRef = useRef<number>(0);

  // Live access to volatile values from stable callbacks (avoids stale closures).
  const stateRef = useRef({
    balance, selectedId, levels, actives, prestige, treeEffects, packages, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete, gameComplete, endingPending, completionStats, runTimeMs,
  });
  useEffect(() => {
    stateRef.current = { balance, selectedId, levels, actives, prestige, treeEffects, packages, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete, gameComplete, endingPending, completionStats, runTimeMs };
  }, [balance, selectedId, levels, actives, prestige, treeEffects, packages, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete, gameComplete, endingPending, completionStats, runTimeMs]);

  // -------- Persistence --------
  const saveState = useCallback(async (data: Partial<SaveData>) => {
    try {
      const merged: SaveData = {
        v: 6, balance, selectedId, levels, actives, musicEnabled,
        prestige, totalPrestiges, skills,
        stats, unlockedAchievements, activeMarket, lastMarketRollAt, settings,
        prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete,
        gameComplete, endingPending, completionStats, runTimeMs,
        lastSeenAt: Date.now(),
        ...data,
      };
      await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(merged));
    } catch {}
  }, [balance, selectedId, levels, actives, musicEnabled, prestige, totalPrestiges, skills, stats, unlockedAchievements, activeMarket, lastMarketRollAt, settings, prestigeUpgrades, legacyPoints, legacyUpgrades, onboardingComplete, gameComplete, endingPending, completionStats, runTimeMs]);

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
          // Migrate old package IDs to new ones
          const migratedSelectedId = parsed.selectedId ? migratePackageId(parsed.selectedId) : "micro-loan";
          const migratedActives = (parsed.actives ?? []).map((a: any) => ({
            ...a,
            pkgId: migratePackageId(a.pkgId),
          }));
          
          saved = {
            ...defaultSave(),
            ...parsed,
            selectedId: migratedSelectedId,
            levels: { ...defaultSave().levels, ...(parsed.levels ?? {}) },
            actives: migratedActives as ActiveInvestment[],
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
            gameComplete: parsed.gameComplete ?? false,
            endingPending: parsed.endingPending ?? false,
            completionStats: parsed.completionStats ?? null,
            runTimeMs: parsed.runTimeMs ?? 0,
            settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
          };
        }

        const savedTree = deriveTreeEffects(saved.skills);
        const savedPkgs = getPackages(savedTree);

        // Passive + savings offline earnings
        const offlineCapMs = saved.legacyUpgrades?.["financial-automation"] ? OFFLINE_CAP_MS * 2 : OFFLINE_CAP_MS;
        const elapsed = Math.min(offlineCapMs, Math.max(0, nowMs - (saved.lastSeenAt ?? nowMs)));
        const secs = elapsed / 1000;
        const passiveEarned = secs * computePassiveRate(saved.levels.passive ?? 0, savedTree, saved.legacyUpgrades ?? {});
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
              const lpMult = 1 + 0.10 * (saved.legacyPoints ?? 0);
              const div = a.cost * pct * lpMult * savedTree.dividendPct;
              simBal += a.cost + a.cost * pct * lpMult + div;
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
                const lpMult = 1 + 0.10 * (saved.legacyPoints ?? 0);
                const div = a.cost * pct * lpMult * savedTree.dividendPct;
                simBal += a.cost + a.cost * pct * lpMult + div;
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
        setGameComplete(saved.gameComplete ?? false);
        setEndingPending(saved.endingPending ?? false);
        setCompletionStats(saved.completionStats ?? null);
        setRunTimeMs(saved.runTimeMs ?? 0);
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
    const rate = computePassiveRate(levels.passive, treeEffects, legacyUpgrades);
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

  // Active play time tracker — accumulates real time spent in app
  useEffect(() => {
    const interval = setInterval(() => {
      setStats((s) => ({ ...s, activePlayTimeMs: s.activePlayTimeMs + 1000 }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // News Feed rotation
  useEffect(() => {
    if (!ready) return;
    
    // Get unlocked categories
    const unlockedCategories: string[] = [];
    if (treeEffects.businessUnlocked) unlockedCategories.push("business");
    if (treeEffects.diversifiedUnlocked) unlockedCategories.push("diversified");
    if (treeEffects.propertyUnlocked) unlockedCategories.push("property");
    if (treeEffects.sectorUnlocked) unlockedCategories.push("sector");
    if (treeEffects.institutionalUnlocked) unlockedCategories.push("institutional");
    if (treeEffects.premiumUnlocked) unlockedCategories.push("premium");
    
    const hasLegacy = legacyPoints > 0;
    const newsItems = getNewsForProgression(totalPrestiges, unlockedCategories, hasLegacy);
    
    if (newsItems.length === 0) return;
    
    // Set initial news
    setCurrentNews(newsItems[0]);
    setNewsIndex(0);
    
    // Rotate news
    const interval = setInterval(() => {
      setNewsIndex((prev) => {
        const nextIndex = (prev + 1) % newsItems.length;
        setCurrentNews(newsItems[nextIndex]);
        return nextIndex;
      });
    }, NEWS_ROTATION_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [ready, totalPrestiges, treeEffects, legacyPoints]);
  
  // Leaderboards refresh
  useEffect(() => {
    if (!ready) return;
    
    const refreshLeaderboard = () => {
      let playerValue: number;
      switch (leaderboardCategory) {
        case "money":
          playerValue = balance;
          break;
        case "playtime":
          playerValue = stats.activePlayTimeMs;
          break;
        case "prestige":
          playerValue = prestige;
          break;
        case "legacy":
          playerValue = legacyPoints;
          break;
      }
      setLeaderboardData(getLeaderboard(leaderboardCategory, playerValue));
    };
    
    refreshLeaderboard();
    const interval = setInterval(refreshLeaderboard, LEADERBOARD_REFRESH_INTERVAL_MS);
    
    return () => clearInterval(interval);
  }, [ready, leaderboardCategory, balance, stats.activePlayTimeMs, prestige, legacyPoints]);
  
  // Market event notification banner
  useEffect(() => {
    if (!ready) return;
    if (!activeMarket) {
      setShowMarketBanner(false);
      return;
    }
    
    setShowMarketBanner(true);
    const timeout = setTimeout(() => setShowMarketBanner(false), 5000);
    
    return () => clearTimeout(timeout);
  }, [ready, activeMarket]);

  // Play victory sound when ending screen first appears
  useEffect(() => {
    if (endingPending && completionStats) {
      sound.play("victory");
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    }
  }, [endingPending, sound, triggerHaptic]);

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
    if (computePassiveRate(levels.passive, treeEffects, legacyUpgrades) > 0) return;
    if (treeEffects.savingsRatePerSec > 0 && balance > 0.01) return;
    if (balance >= cheapestCost(treeEffects)) return;
    const bail = treeEffects.bailoutAmount;
    const t = setTimeout(() => {
      setBalance((b) => (b < cheapestCost(treeEffects) ? bail : b));
      setBailoutNotice(true);
      sound.play("upgrade");
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    }, 700);
    return () => clearTimeout(t);
  }, [balance, actives.length, levels.passive, ready, sound, treeEffects, triggerHaptic]);

  // Rank-up detection
  const prevRankRef = useRef<Rank>("bronze");
  useEffect(() => {
    if (!ready) return;
    if (RANK_META[rank].minPrestiges > RANK_META[prevRankRef.current].minPrestiges) {
      setRankUpBanner(rank);
      sound.play("upgrade");
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      setTimeout(() => setRankUpBanner(null), 6000);
    }
    prevRankRef.current = rank;
  }, [rank, ready, sound, triggerHaptic]);

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
      const lpMult = 1 + 0.10 * (state.legacyPoints ?? 0);
      let profit = a.cost * pct * lpMult;
      const lucky = Math.random() < luckyChance(state.levels.lucky);
      if (lucky) profit *= 2;
      const dividend = a.cost * pct * lpMult * state.treeEffects.dividendPct;
      const totalReturn = a.cost + profit + dividend;

      setBalance((b) => b + totalReturn);
      setLastProfit(profit + dividend);
      setWasLucky(lucky);

      // Track stats
      setStats((s) => ({
        ...s,
        totalMoneyEarned: s.totalMoneyEarned + profit + dividend,
        investmentsCompleted: s.investmentsCompleted + 1,
        biggestSingleProfit: Math.max(s.biggestSingleProfit, profit + dividend),
        highestBalance: Math.max(s.highestBalance, balance + totalReturn),
      }));

      sound.play("investComplete");
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

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

    return true;
  }, [completeInvestment, triggerHaptic]);

  const invest = useCallback(() => {
    kickMusicOnce();
    const state = stateRef.current;
    const slots = slotCount(state.levels.slots);
    const hasFreeSlot = state.actives.length < slots;
    const selected = state.packages.find((p) => p.id === state.selectedId) ?? state.packages[0];
    if (!hasFreeSlot || state.balance < effectivePkgCost(selected, state.treeEffects)) {
      sound.play("error");
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      doShake();
      return;
    }
    sound.play("investStart");
    triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    flash.value = 0.55;
    flash.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
    investPkg(selected);
  }, [sound, triggerHaptic]);

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
      triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      setStats((s) => ({ ...s, accelerateUses: s.accelerateUses + 1 }));
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
    if (nowMs - lastAutoInvestRef.current < (legacyUpgrades["financial-automation"] ? 125 : 250)) return;
    void legacyUpgrades;
    // If autoFill: try to fill all empty; else just refill one (post-completion behavior)
    const attempts = treeEffects.autoFill ? slots - state.actives.length : 1;
    for (let i = 0; i < attempts; i++) {
      const s = stateRef.current;
      const pkg = pickAutoPackage(s.balance);
      if (!pkg) break;
      if (!investPkg(pkg)) break;
      lastAutoInvestRef.current = Date.now();
    }
  }, [ready, actives.length, balance, treeEffects.autoReinvest, treeEffects.autoFill, treeEffects.smartSelect, pickAutoPackage, investPkg, levels.slots, legacyUpgrades]);

  const buyUpgrade = useCallback((u: Upgrade) => {
    kickMusicOnce();
    const level = levels[u.id];
    if (level >= u.maxLevel) return;
    const cost = upgradeCost(u, level);
    if (balance < cost) {
      sound.play("error");
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      doShake();
      return;
    }
    sound.play("upgrade");
    triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    setBalance((b) => b - cost);
    setLevels((l) => ({ ...l, [u.id]: l[u.id] + 1 }));
    setStats((s) => ({ ...s, upgradesPurchased: s.upgradesPurchased + 1 }));
  }, [balance, levels, sound, triggerHaptic]);

  const buySkill = useCallback((node: SkillNode) => {
    kickMusicOnce();
    const level = skills[node.id] ?? 0;
    if (level >= node.maxLevel) return;
    if (!prestigeUpgrades.foundation) {
      sound.play("error"); doShake(); return;
    }
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
    triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, [skills, prestigeUpgrades, rank, prestige, sound, triggerHaptic]);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((v) => {
      const next = !v;
      if (next) music.kick();
      return next;
    });
    triggerHaptic(() => Haptics.selectionAsync());
  }, [triggerHaptic]);

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
      triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    }
  };

  const submitDebugPassword = () => {
    if (debugPassword === DEBUG_PASSWORD) {
      setDebugAuthed(true);
      setDebugPwError(false);
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    } else {
      setDebugPwError(true);
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
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
    triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  };

  const devAddPP = () => {
    const amount = Math.floor(parseAmount(debugPPInput));
    if (amount <= 0) return;
    setPrestige((p) => p + amount);
    setDebugPPInput("");
    triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  };

  const prestigeGainAvailable = computePrestigeGain(balance);
  const canPrestige = prestigeGainAvailable > 0;

  const doPrestige = useCallback(() => {
    kickMusicOnce();
    if (!canPrestige) {
      sound.play("error");
      triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      doShake();
      return;
    }
    if (!prestigeArmed) {
      setPrestigeArmed(true);
      triggerHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
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
    setSelectedId("micro-loan");
    setLevels({ yield: 0, turbo: 0, passive: 0, lucky: 0, slots: 0 });
    setPrestige((p) => p + gain);
    setTotalPrestiges((t) => t + 1);
    const newStats: Stats = {
      ...stats,
      totalPrestiges: totalPrestiges + 1,
      totalPPEarned: stats.totalPPEarned + gain,
    };
    setStats(newStats);
    setPrestigeArmed(false);
    setPrestigeCelebrate(gain);
    setTimeout(() => setPrestigeCelebrate(0), 4500);

    // Award Legacy Points after threshold is reached
    // Earn 1 LP per 250 PP gained (slow progression)
    const newTotalPrestiges = totalPrestiges + 1;
    if (newStats.totalPPEarned >= LEGACY_UNLOCK_THRESHOLD) {
      const legacyGain = Math.max(1, Math.floor(gain / 250));
      setLegacyPoints((lp: number) => lp + legacyGain);
      // Persist Legacy Points immediately to ensure they're saved
      setTimeout(() => {
        setLegacyPoints((currentLp) => {
          saveState({ legacyPoints: currentLp, stats: newStats });
          return currentLp;
        });
      }, 100);
    }

    sound.play("upgrade");
    triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    balancePulse.value = withSequence(
      withTiming(1.2, { duration: 220 }), withTiming(1, { duration: 320 })
    );
  }, [canPrestige, prestigeArmed, prestigeGainAvailable, treeEffects, totalPrestiges, stats, sound, triggerHaptic, saveState]);

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

  const legacySlideStyle = useAnimatedStyle(() => ({
    opacity: legacySlide.value,
    transform: [{ translateY: (1 - legacySlide.value) * 20 }],
  }));

  const mainScreenEntranceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mainScreenOpacity.value, [0, 1], [0, 1]),
    transform: [{ translateY: interpolate(mainScreenOpacity.value, [0, 1], [12, 0]) }],
  }));

  // Loading screen spinner dot styles (declared unconditionally to satisfy
  // the Rules of Hooks — used only inside the !loadingComplete early return).
  const loadingDot1Style = useAnimatedStyle(() => ({
    opacity: interpolate(spinnerPulse.value, [0, 0.33, 1], [0.3, 1, 0.3]),
    transform: [{ scale: interpolate(spinnerPulse.value, [0, 0.33, 1], [0.8, 1.2, 0.8]) }],
  }));
  const loadingDot2Style = useAnimatedStyle(() => ({
    opacity: interpolate(spinnerPulse.value, [0, 0.66, 1], [0.3, 1, 0.3]),
    transform: [{ scale: interpolate(spinnerPulse.value, [0, 0.66, 1], [0.8, 1.2, 0.8]) }],
  }));
  const loadingDot3Style = useAnimatedStyle(() => ({
    opacity: interpolate(spinnerPulse.value, [0.33, 1, 1.33], [0.3, 1, 0.3], 'clamp'),
    transform: [{ scale: interpolate(spinnerPulse.value, [0.33, 1, 1.33], [0.8, 1.2, 0.8], 'clamp') }],
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

  // Game completion ending screen
  if (endingPending && completionStats) {
    const handleContinue = () => {
      // Simply dismiss the ending screen and continue playing
      setEndingPending(false);
      setGameComplete(false);
      setCompletionStats(null);
      saveState({ endingPending: false, gameComplete: false, completionStats: null });
    };

    const handleReplay = () => {
      // Take a fresh snapshot from current live stats
      const comp: CompletionStats = {
        balance,
        totalPrestiges: totalPrestiges,
        totalPPEarned: stats.totalPPEarned,
        investmentsCompleted: stats.investmentsCompleted,
        upgradesPurchased: stats.upgradesPurchased,
        accelerateUses: stats.accelerateUses,
        activePlayTimeMs: runTimeMs,
        highestBalance: stats.highestBalance,
        totalMoneyEarned: stats.totalMoneyEarned,
        legacyUpgradesOwned: Object.values(legacyUpgrades).filter(Boolean).length,
        completedAt: Date.now(),
      };
      // Wipe save but preserve completion data
      const freshSave: SaveData = {
        ...defaultSave(),
        gameComplete: true,
        endingPending: false,
        completionStats: comp,
        lastSeenAt: Date.now(),
      };
      AsyncStorage.setItem(SAVE_KEY, JSON.stringify(freshSave)).then(() => {
        // Reset all state to defaults
        setBalance(100);
        setSelectedId("starter-bond");
        setLevels({ yield: 0, turbo: 0, passive: 0, lucky: 0, slots: 0 });
        setActives([]);
        setPrestige(0);
        setTotalPrestiges(0);
        setSkills({});
        setStats(defaultStats());
        setRunTimeMs(0);
        setUnlockedAchievements([]);
        setActiveMarket(null);
        setLastMarketRollAt(Date.now());
        setPrestigeUpgrades({} as Record<PrestigeUpgradeId, boolean>);
        setLegacyPoints(0);
        setLegacyUpgrades({} as Record<LegacyUpgradeId, boolean>);
        setGameComplete(true);
        setEndingPending(false);
        setCompletionStats(comp);
        setShowLegacy(false);
        setShowTree(false);
        setShowOnboarding(false);
        setOnboardingComplete(true);
      });
    };
    return (
      <SafeAreaView style={styles.safe} testID="ending-screen">
        <EndingScreen stats={completionStats} onReplay={handleReplay} onContinue={handleContinue} />
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
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} testID="prestige-screen">
        <Animated.View style={[{ flex: 1 }, treeSlideStyle]}>
          <ScrollView
            style={styles.treeBody}
            contentContainerStyle={styles.treeBodyContent}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
          >
            <LinearGradient
              colors={[theme.bgSoft, theme.bg]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.treeHeader}
            >
              <View style={styles.treeHeaderRow}>
                <Pressable
                  onPress={() => { sound.play("click"); triggerHaptic(() => Haptics.selectionAsync()); setShowTree(false); }}
                  hitSlop={16}
                  testID="tree-back"
                  style={styles.backBtn}
                >
                  <Text style={[styles.backBtnText, { color: theme.upgrade }]}>← BACK</Text>
                </Pressable>
                <View style={styles.treeHeaderCenter}>
                  <Text style={[styles.treeTitle, { color: theme.text }]}>PRESTIGE TREE</Text>
                </View>
                {stats.totalPPEarned >= LEGACY_UNLOCK_THRESHOLD && (
                  <Pressable
                    onPress={() => { sound.play("click"); triggerHaptic(() => Haptics.selectionAsync()); setShowLegacy(true); }}
                    hitSlop={12}
                    style={[styles.iconChip, { borderColor: theme.legacy, backgroundColor: `${theme.legacy}25`, marginLeft: 6, borderWidth: 1.5 }]}
                    testID="open-legacy"
                  >
                    <Text style={[styles.iconChipText, { color: theme.legacy }]}>
                      LEGACY · {compact(legacyPoints)}
                    </Text>
                  </Pressable>
                )}
              </View>

              <View style={[styles.rankCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
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
                  <Text style={[styles.rankLabel, { color: theme.textMuted }]}>CURRENT RANK</Text>
                  <Text style={[styles.rankName, { color: rankMeta.tint }]}>
                    {rankMeta.name}
                  </Text>
                  {nRankMeta ? (
                    <>
                      <View style={[styles.rankBar, { backgroundColor: theme.bgSoft }]}>
                        <View
                          style={[
                            styles.rankBarFill,
                            {
                              backgroundColor: nRankMeta.tint,
                              width: Math.min(100, ((totalPrestiges - rankMeta.minPrestiges) / (nRankMeta.minPrestiges - rankMeta.minPrestiges)) * 100).toFixed(1) + "%" as any,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.rankProgress, { color: theme.textMuted }]}>
                        {totalPrestiges - rankMeta.minPrestiges} / {nRankMeta.minPrestiges - rankMeta.minPrestiges} to {nRankMeta.short}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.rankProgress, { color: theme.textMuted }]}>Maximum rank achieved</Text>
                  )}
                </View>
              </View>

              <View style={[styles.treeStats, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                <View style={styles.treeStatCell}>
                  <Text style={[styles.treeStatLabel, { color: theme.textMuted }]}>PP AVAILABLE</Text>
                  <Text style={[styles.treeStatValue, { color: theme.prestige }]} testID="tree-pp-available">{prestige}</Text>
                </View>
                <View style={[styles.treeStatDivider, { backgroundColor: theme.border }]} />
                <View style={styles.treeStatCell}>
                  <Text style={[styles.treeStatLabel, { color: theme.textMuted }]}>PP SPENT</Text>
                  <Text style={[styles.treeStatValue, { color: theme.text }]}>{totalSpentPP(skills)}</Text>
                </View>
                <View style={[styles.treeStatDivider, { backgroundColor: theme.border }]} />
                <View style={styles.treeStatCell}>
                  <Text style={[styles.treeStatLabel, { color: theme.textMuted }]}>PROFIT BONUS</Text>
                  <Text style={[styles.treeStatValue, { color: theme.gain }]}>+{fmtPct(currentBonusPct)}</Text>
                </View>
                <View style={[styles.treeStatDivider, { backgroundColor: theme.border }]} />
                <View style={styles.treeStatCell}>
                  <Text style={[styles.treeStatLabel, { color: theme.textMuted }]}>CASH-OUTS</Text>
                  <Text style={[styles.treeStatValue, { color: theme.text }]}>{totalPrestiges}</Text>
                </View>
              </View>

              {/* Legacy Progress */}
              <View style={[styles.legacyProgressSection, { borderTopColor: theme.border }]}>
                <View style={styles.legacyProgressHeader}>
                  <Text style={[styles.legacyProgressTitle, { color: theme.text }]}>LEGACY PROGRESS</Text>
                  <Text style={[styles.legacyProgressSubtitle, { color: theme.textMuted }]}>Unlock at 10,000 total PP</Text>
                </View>
                <View style={[styles.legacyProgressBar, { backgroundColor: theme.bgSoft }]}>
                  <View
                    style={[
                      styles.legacyProgressBarFill,
                      {
                        width: Math.min(100, (stats.totalPPEarned / LEGACY_UNLOCK_THRESHOLD) * 100).toFixed(0) + "%" as any,
                        backgroundColor: stats.totalPPEarned >= LEGACY_UNLOCK_THRESHOLD ? theme.legacy : theme.legacy,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.legacyProgressText, { color: theme.textMuted }]}>
                  {compact(stats.totalPPEarned)} / {compact(LEGACY_UNLOCK_THRESHOLD)} PP
                  {stats.totalPPEarned >= LEGACY_UNLOCK_THRESHOLD && " · UNLOCKED"}
                </Text>
              </View>

              {/* Prestige Explanation */}
              <View style={[styles.prestigeExplanationSection, { borderTopColor: theme.border, backgroundColor: `${theme.prestige}08` }]}>
                <View style={styles.prestigeExplanationHeader}>
                  <Text style={[styles.prestigeExplanationTitle, { color: theme.prestige }]}>WHAT IS PRESTIGE?</Text>
                  <Pressable
                    onPress={() => {
                      sound.play("click");
                      triggerHaptic(() => Haptics.selectionAsync());
                      setShowPrestigeInfo(!showPrestigeInfo);
                    }}
                    hitSlop={8}
                    style={[styles.infoButton, { backgroundColor: `${theme.prestige}18` }]}
                  >
                    <Text style={[styles.infoButtonText, { color: theme.prestige }]}>ⓘ</Text>
                  </Pressable>
                </View>
                {showPrestigeInfo && (
                  <Text style={[styles.prestigeExplanationText, { color: theme.textMuted }]}>
                    Cash out your run to earn Prestige Points (PP). Each PP gives +{fmtPct(5)} permanent profit bonus.
                    Use PP to unlock skill tree nodes and prestige upgrades. Your balance resets but upgrades persist.
                  </Text>
                )}
              </View>

              {/* Prestige Upgrades */}
              <View style={[styles.upgradesSection, { borderTopColor: theme.border }]}>
                <Text style={[styles.upgradesSectionTitle, { color: theme.text }]}>PRESTIGE UPGRADES</Text>
                {PRESTIGE_UPGRADES.map((upgrade) => {
                  const owned = prestigeUpgrades[upgrade.id];
                  const canAfford = prestige >= upgrade.cost && !owned;
                  return (
                    <Pressable
                      key={upgrade.id}
                      onPress={() => {
                        if (canAfford) {
                          sound.play("upgrade");
                          triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
                          const newPrestigeUpgrades = { ...prestigeUpgrades, [upgrade.id]: true };
                          setPrestige((p) => p - upgrade.cost);
                          setPrestigeUpgrades(newPrestigeUpgrades);
                          saveState({ prestigeUpgrades: newPrestigeUpgrades });
                        }
                      }}
                      disabled={!canAfford}
                      style={({ pressed }) => [
                        styles.prestigeUpgradeCard,
                        { backgroundColor: theme.panel, borderColor: theme.border },
                        owned && [styles.prestigeUpgradeCardOwned, { backgroundColor: `${upgrade.tint}12` }],
                        !owned && { borderColor: upgrade.tint, backgroundColor: `${upgrade.tint}15` },
                        pressed && canAfford && { transform: [{ scale: 0.98 }] },
                      ]}
                      testID={`upgrade-${upgrade.id}`}
                    >
                      {owned && (
                        <View style={[styles.prestigeUpgradeOwnedBadge, { backgroundColor: upgrade.tint }]}>
                          <Text style={[styles.prestigeUpgradeOwnedIcon, { color: '#FFFFFF' }]}>✓</Text>
                        </View>
                      )}
                      <View style={styles.prestigeUpgradeCardLeft}>
                        <Text style={[styles.prestigeUpgradeCardName, { color: theme.text }, owned && { color: upgrade.tint }]}>
                          {upgrade.name}
                        </Text>
                        <Text style={[styles.prestigeUpgradeCardDesc, { color: theme.textMuted }]}>{upgrade.description}</Text>
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
              {settings.holdToPrestige ? (
                <HoldButton
                  onHoldComplete={doPrestige}
                  colors={["#A855F7", "#9333EA"]}
                  textColor={canPrestige ? "#001018" : theme.prestige}
                  progressColor="#FFFFFF"
                  disabled={!canPrestige}
                  style={[
                    styles.cashOutBtn,
                    { borderColor: theme.prestige, backgroundColor: `${theme.prestige}12` },
                    !canPrestige && [styles.cashOutBtnDim, { borderColor: theme.border, backgroundColor: theme.bgSoft }],
                    prestigeArmed && [styles.cashOutBtnArmed, { backgroundColor: theme.prestige, borderColor: theme.prestige }],
                    canPrestige && !prestigeArmed && { backgroundColor: theme.prestige },
                  ]}
                  testID="prestige-button"
                >
                  {!canPrestige
                    ? `Reach ${money(PRESTIGE_MIN_BALANCE)} to cash out`
                    : prestigeArmed
                    ? `TAP AGAIN — CONFIRM +${prestigeGainAvailable} PP`
                    : `CASH OUT · +${prestigeGainAvailable} PP`}
                </HoldButton>
              ) : (
                <Pressable
                  onPress={doPrestige}
                  disabled={!canPrestige}
                  style={({ pressed }) => [
                    styles.cashOutBtn,
                    styles.cashOutBtnInner,
                    { borderColor: theme.prestige, backgroundColor: `${theme.prestige}12` },
                    !canPrestige && [styles.cashOutBtnDim, { borderColor: theme.border, backgroundColor: theme.bgSoft }],
                    prestigeArmed && [styles.cashOutBtnArmed, { backgroundColor: theme.prestige, borderColor: theme.prestige }],
                    canPrestige && !prestigeArmed && { backgroundColor: theme.prestige },
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                  testID="prestige-button"
                >
                  <Text style={[styles.cashOutBtnText, { color: canPrestige ? "#001018" : theme.prestige }]}>
                    {!canPrestige
                      ? `Reach ${money(PRESTIGE_MIN_BALANCE)} to cash out`
                      : prestigeArmed
                      ? `TAP AGAIN — CONFIRM +${prestigeGainAvailable} PP`
                      : `CASH OUT · +${prestigeGainAvailable} PP`}
                  </Text>
                </Pressable>
              )}
            </LinearGradient>

            <View style={{ height: 20 }} />

            {/* Tree body: 3 columns */}
            <View style={styles.treeGridRow}>
              <TreeColumn
                title="AUTOMATION"
                subtitle="Idle strength"
                icon="A"
                tint="#EF4444"
                path="automation"
                skills={skills}
                prestige={prestige}
                rank={rank}
                prestigeUpgrades={prestigeUpgrades}
                onBuy={buySkill}
                theme={theme}
              />
              <TreeColumn
                title="BONUS"
                subtitle="Steady growth"
                icon="B"
                tint="#00C896"
                path="bonus"
                skills={skills}
                prestige={prestige}
                rank={rank}
                prestigeUpgrades={prestigeUpgrades}
                onBuy={buySkill}
                theme={theme}
              />
              <TreeColumn
                title="METHODS"
                subtitle="New income"
                icon="M"
                tint="#3B82F6"
                path="money"
                skills={skills}
                prestige={prestige}
                rank={rank}
                prestigeUpgrades={prestigeUpgrades}
                onBuy={buySkill}
                theme={theme}
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

      // Detect game completion when ultimate-investor is purchased
      if (upgrade.isFinal) {
        const compStats: CompletionStats = {
          balance,
          totalPrestiges: totalPrestiges,
          totalPPEarned: stats.totalPPEarned,
          investmentsCompleted: stats.investmentsCompleted,
          upgradesPurchased: stats.upgradesPurchased,
          accelerateUses: stats.accelerateUses,
          activePlayTimeMs: runTimeMs,
          highestBalance: stats.highestBalance,
          totalMoneyEarned: stats.totalMoneyEarned,
          legacyUpgradesOwned: Object.values(newLegacyUpgrades).filter(Boolean).length,
          completedAt: Date.now(),
        };
        setGameComplete(true);
        setEndingPending(true);
        setCompletionStats(compStats);
        sound.play("victory");
        triggerHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        saveState({
          legacyPoints: newLegacyPoints,
          legacyUpgrades: newLegacyUpgrades,
          gameComplete: true,
          endingPending: true,
          completionStats: compStats,
        });
      } else {
        saveState({ legacyPoints: newLegacyPoints, legacyUpgrades: newLegacyUpgrades });
      }
    };

    const isUltimateOwned = legacyUpgrades["ultimate-investor"];

    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} testID="legacy-screen">
        <LinearGradient
          colors={[theme.bg, theme.bgSoft, theme.panel]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[{ flex: 1 }, legacySlideStyle]}>
        <View style={[styles.legacyHeader, { borderBottomColor: theme.border }]}>
          <View style={styles.legacyHeaderRow}>
            <Pressable
              onPress={() => { sound.play("click"); triggerHaptic(() => Haptics.selectionAsync()); setShowLegacy(false); }}
              hitSlop={16}
              testID="legacy-back"
              style={styles.backBtn}
            >
              <Text style={[styles.backBtnText, { color: theme.upgrade }]}>← BACK</Text>
            </Pressable>
            <View style={styles.legacyHeaderCenter}>
              <Text style={[styles.legacyTitle, { color: theme.text }, isUltimateOwned && { color: theme.legacy }]}>
                {isUltimateOwned ? "THE ULTIMATE INVESTOR" : "LEGACY ENDGAME"}
              </Text>
            </View>
          </View>

          <View style={[styles.legacyStats, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <View style={styles.legacyStatCell}>
              <Text style={[styles.legacyStatLabel, { color: theme.textMuted }]}>LEGACY POINTS</Text>
              <Text style={[styles.legacyStatValue, { color: theme.legacy }]}>{compact(legacyPoints)}</Text>
            </View>
            <View style={[styles.legacyStatDivider, { backgroundColor: theme.border }]} />
            <View style={styles.legacyStatCell}>
              <Text style={[styles.legacyStatLabel, { color: theme.textMuted }]}>TOTAL PRESTIGES</Text>
              <Text style={[styles.legacyStatValue, { color: theme.text }]}>{compact(totalPrestiges)}</Text>
            </View>
            <View style={[styles.legacyStatDivider, { backgroundColor: theme.border }]} />
            <View style={styles.legacyStatCell}>
              <Text style={[styles.legacyStatLabel, { color: theme.textMuted }]}>UPGRADES OWNED</Text>
              <Text style={[styles.legacyStatValue, { color: theme.text }]}>
                {Object.values(legacyUpgrades).filter(Boolean).length}/{LEGACY_UPGRADES.length}
              </Text>
            </View>
          </View>

          {/* Legacy Explanation */}
          <View style={[styles.legacyExplanationSection, { borderTopColor: theme.border, backgroundColor: `${theme.legacy}08` }]}>
            <View style={styles.legacyExplanationHeader}>
              <Text style={[styles.legacyExplanationTitle, { color: theme.legacy }]}>WHAT ARE LEGACY POINTS?</Text>
              <Pressable
                onPress={() => {
                  sound.play("click");
                  triggerHaptic(() => Haptics.selectionAsync());
                  setShowLegacyInfo(!showLegacyInfo);
                }}
                hitSlop={8}
                style={[styles.infoButton, { backgroundColor: `${theme.legacy}18` }]}
              >
                <Text style={[styles.infoButtonText, { color: theme.legacy }]}>ⓘ</Text>
              </Pressable>
            </View>
            {showLegacyInfo && (
              <Text style={[styles.legacyExplanationText, { color: theme.textMuted }]}>
                Earn 1 Legacy Point per 250 Prestige Points gained after reaching 10,000 total PP.
                Each LP grants +10% cash generation. Spend LP on permanent endgame upgrades that dramatically boost your investment power.
              </Text>
            )}
          </View>

          {isUltimateOwned && (
            <View style={[styles.ultimateBanner, { borderColor: theme.legacy, backgroundColor: `${theme.legacy}12` }]}>
              <ExpoImage
                source={require("@/assets/images/trophy.png")}
                style={styles.ultimateTrophyIcon}
                contentFit="contain"
              />
              <Text style={[styles.ultimateBannerText, { color: theme.legacy }]}>GAME COMPLETE</Text>
              <Text style={[styles.ultimateBannerSub, { color: theme.text }]}>You have achieved the Ultimate Investor rank</Text>
              <Pressable
                onPress={() => {
                  // Take a fresh snapshot from current live stats
                  const comp: CompletionStats = {
                    balance,
                    totalPrestiges: totalPrestiges,
                    totalPPEarned: stats.totalPPEarned,
                    investmentsCompleted: stats.investmentsCompleted,
                    upgradesPurchased: stats.upgradesPurchased,
                    accelerateUses: stats.accelerateUses,
                    activePlayTimeMs: runTimeMs,
                    highestBalance: stats.highestBalance,
                    totalMoneyEarned: stats.totalMoneyEarned,
                    legacyUpgradesOwned: Object.values(legacyUpgrades).filter(Boolean).length,
                    completedAt: Date.now(),
                  };
                  setCompletionStats(comp);
                  setEndingPending(true);
                }}
                style={({ pressed }) => [
                  styles.viewEndingBtn,
                  { borderColor: theme.prestige, backgroundColor: `${theme.prestige}12` },
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                testID="view-ending-btn"
              >
                <Text style={[styles.viewEndingBtnText, { color: theme.legacy }]}>VIEW ENDING</Text>
              </Pressable>
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
                  { backgroundColor: theme.panel, borderColor: theme.border },
                  owned && [styles.legacyCardOwned, { backgroundColor: `${upgrade.tint}12` }],
                  upgrade.isFinal && [
                    styles.legacyCardFinal, 
                    { 
                      borderColor: theme.legacy, 
                      backgroundColor: `${theme.legacy}08`,
                      borderWidth: 2,
                      shadowColor: theme.legacy,
                      shadowOpacity: 0.4,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 4,
                    }
                  ],
                  !owned && { borderColor: upgrade.tint, backgroundColor: `${upgrade.tint}15` },
                  pressed && canAfford && { transform: [{ scale: 0.98 }] },
                ]}
                testID={`legacy-upgrade-${upgrade.id}`}
              >
                {owned && (
                  <View style={[styles.legacyOwnedBadge, { backgroundColor: upgrade.tint }]}>
                    <Text style={[styles.legacyOwnedIcon, { color: '#FFFFFF' }]}>✓</Text>
                  </View>
                )}
                <View style={styles.legacyCardLeft}>
                  <Text style={[styles.legacyCardName, { color: theme.text }, owned && { color: upgrade.tint }]}>
                    {upgrade.name}
                  </Text>
                  <Text style={[styles.legacyCardDesc, { color: theme.textMuted }]}>{upgrade.description}</Text>
                  <Text style={[styles.legacyCardEffect, { color: upgrade.tint }]}>{upgrade.effect}</Text>
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
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // Loading Screen
  // ============================================================
  if (!loadingComplete || showLoading) {
    return (
      <LoadingScreen onComplete={() => {
        if (showLoading) {
          setShowLoading(false);
        }
      }} />
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
      <SafeAreaView style={[styles.onboardingContainer, { backgroundColor: theme.bg }]} testID="onboarding-screen">
        <LinearGradient
          colors={legacyUpgrades["ultimate-investor"] ? ["#0B1220", "#11110a", "#0B1220"] : [theme.bg, theme.bgSoft, theme.bg]}
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
                  i <= onboardingStep && { backgroundColor: theme.upgrade },
                  i < onboardingStep && { backgroundColor: theme.upgrade },
                ]}
              />
            ))}
          </View>

          <Animated.View style={[styles.onboardingCard, { borderColor: theme.border }, slideStyle]}>
            <Text style={[styles.onboardingTitle, { color: theme.text }]}>{current.title}</Text>
            <Text style={[styles.onboardingDescription, { color: theme.textMuted }]}>{current.description}</Text>
            <View style={[styles.onboardingHighlight, { backgroundColor: `${theme.upgrade}12` }]}>
              <Text style={[styles.onboardingHighlightText, { color: theme.upgrade }]}>{current.highlight}</Text>
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
            <LinearGradient
              colors={[theme.upgrade, theme.upgrade]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.onboardingButtonGradient}
            >
              <Text style={styles.onboardingButtonText}>
                {onboardingStep === onboardingSteps.length - 1 ? "START INVESTING" : "NEXT"}
              </Text>
            </LinearGradient>
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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} testID="game-screen">
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.flashOverlay, flashStyle]}
      />

      {/* HEADER */}
      <LinearGradient
        colors={legacyUpgrades["ultimate-investor"] ? ["#1a1a0e", "#0B1220"] : [theme.bgSoft, theme.bg]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftGroup}>
            <ExpoImage
              source={require("@/assets/images/22.png")}
              style={styles.headerLogo}
              contentFit="contain"
            />
          </View>
          <View style={styles.headerRightRow}>
            <Pressable
              onPress={toggleMusic}
              hitSlop={12}
              style={[styles.iconChip, { borderColor: theme.border, backgroundColor: theme.bgSoft }]}
              testID="music-toggle"
            >
              <Text style={[styles.iconChipText, { color: theme.text }]}>
                {musicEnabled ? "MUSIC ON" : "MUSIC OFF"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { sound.play("click"); triggerHaptic(() => Haptics.selectionAsync()); setShowTree(true); }}
              hitSlop={12}
              style={[styles.iconChip, { borderColor: rankMeta.tint, backgroundColor: `${rankMeta.tint}18`, marginLeft: 6 }]}
              testID="open-tree"
            >
              <Text style={[styles.iconChipText, { color: rankMeta.tint }]}>
                {rankMeta.short.toUpperCase()} · TREE
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { sound.play("click"); triggerHaptic(() => Haptics.selectionAsync()); setShowSettings(true); }}
              hitSlop={12}
              style={[styles.iconChip, { borderColor: theme.border, backgroundColor: theme.bgSoft, marginLeft: 6 }]}
              testID="open-settings"
            >
              <Text style={[styles.iconChipText, { color: theme.text }]}>⚙</Text>
            </Pressable>
            <Pressable
              onPress={() => { sound.play("click"); triggerHaptic(() => Haptics.selectionAsync()); setShowLeaderboards(true); }}
              hitSlop={12}
              style={[styles.iconChip, { borderColor: theme.legacy, backgroundColor: `${theme.legacy}18`, marginLeft: 6 }]}
              testID="open-leaderboards"
            >
              <Text style={[styles.iconChipText, { color: theme.legacy }]}>🏆</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={handleSecretTap}
          hitSlop={8}
          testID="secret-tap-target"
          accessibilityLabel="Portfolio Balance"
          style={styles.balanceLabelRow}
        >
          <ExpoImage
            source={require("@/assets/images/banknote.png")}
            style={styles.balanceLabelIcon}
            contentFit="contain"
          />
          <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>PORTFOLIO BALANCE</Text>
        </Pressable>

        <Animated.View style={[styles.balanceRow, balanceStyle]}>
          <LinearGradient
            colors={[`${theme.upgrade}08`, `${theme.upgrade}04`, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.balance, { color: theme.text }]} testID="balance-value" numberOfLines={1}>{money(displayBalance)}</Text>
          <Animated.Text
            style={[styles.floatingProfit, floatStyle, { color: theme.gain }]}
            pointerEvents="none"
            testID="floating-profit"
          >
            {wasLucky ? "2×  " : ""}+{money(lastProfit)}
          </Animated.Text>
        </Animated.View>

        <View style={styles.pillRow}>
          <View style={[styles.slotPill, { borderColor: theme.upgrade, backgroundColor: `${theme.upgrade}08` }]} testID="slot-pill">
            <Text style={[styles.slotPillText, { color: theme.upgrade }]}>Slots {actives.length}/{slots}</Text>
          </View>
          {prestige > 0 && (
            <View style={[styles.pill, { borderColor: theme.prestige, backgroundColor: `${theme.prestige}22` }]} testID="prestige-pill">
              <Text style={[styles.pillText, { color: theme.prestige }]}>
                ★ {prestige} PP · +{fmtPct(currentBonusPct)}
              </Text>
            </View>
          )}
          {actives.length === 0 && (
            <View style={[styles.availPill, { borderColor: theme.info, backgroundColor: `${theme.info}08` }]}>
              <Text style={[styles.availText, { color: theme.info }]}>Available to invest</Text>
            </View>
          )}
          {computePassiveRate(levels.passive, treeEffects, legacyUpgrades) > 0 && (
            <View style={[styles.passivePill, { borderColor: theme.gain, backgroundColor: `${theme.gain}08` }]} testID="passive-pill">
              <Text style={[styles.passiveText, { color: theme.gain }]}>
                +${computePassiveRate(levels.passive, treeEffects, legacyUpgrades).toFixed(2)}/s
              </Text>
            </View>
          )}
          {treeEffects.savingsRatePerSec > 0 && (
            <View style={[styles.pill, { borderColor: theme.money, backgroundColor: `${theme.money}18` }]} testID="savings-pill">
              <Text style={[styles.pillText, { color: theme.money }]}>
                Savings +{fmtPct(treeEffects.savingsRatePerSec * 3600 * 100)}/h
              </Text>
            </View>
          )}
        </View>

        {offlineGain > 0.01 && (
          <View style={[styles.banner, { borderColor: theme.gain, backgroundColor: `${theme.gain}08` }]} testID="offline-banner">
            <Text style={[styles.bannerText, { color: theme.gain }]}>
              Welcome back — earned {money(offlineGain)} while away
            </Text>
            <Pressable onPress={() => setOfflineGain(0)} hitSlop={12}>
              <Text style={[styles.bannerDismiss, { color: theme.gain }]}>Dismiss</Text>
            </Pressable>
          </View>
        )}
        {bailoutNotice && (
          <View style={[styles.banner, { backgroundColor: `${theme.info}18`, borderColor: `${theme.info}55` }]} testID="bailout-banner">
            <Text style={[styles.bannerText, { color: theme.info }]}>
              Stimulus received — {money(treeEffects.bailoutAmount)} added
            </Text>
            <Pressable onPress={() => setBailoutNotice(false)} hitSlop={12}>
              <Text style={[styles.bannerDismiss, { color: theme.info }]}>Dismiss</Text>
            </Pressable>
          </View>
        )}
        {rankUpBanner && (
          <View style={[styles.banner, { backgroundColor: `${RANK_META[rankUpBanner].tint}22`, borderColor: RANK_META[rankUpBanner].tint }]} testID="rankup-banner">
            <Text style={[styles.bannerText, { color: RANK_META[rankUpBanner].tint }]}>
              Rank up! Welcome, {RANK_META[rankUpBanner].name}
            </Text>
            <Pressable onPress={() => setRankUpBanner(null)} hitSlop={12}>
              <Text style={[styles.bannerDismiss, { color: RANK_META[rankUpBanner].tint }]}>Dismiss</Text>
            </Pressable>
          </View>
        )}
        {prestigeCelebrate > 0 && (
          <View style={[styles.banner, { backgroundColor: `${theme.prestige}22`, borderColor: theme.prestige }]} testID="prestige-celebrate">
            <Text style={[styles.bannerText, { color: theme.prestige }]}>
              +{prestigeCelebrate} PP earned — run #{totalPrestiges}
            </Text>
          </View>
        )}
        {showMarketBanner && activeMarket && (() => {
          const event = MARKET_EVENTS.find(e => e.id === activeMarket.id);
          if (!event) return null;
          const remainingMs = Math.max(0, activeMarket.endsAt - Date.now());
          return (
            <View style={[styles.banner, { backgroundColor: `${event.tint}22`, borderColor: event.tint }]} testID="market-banner">
              <Text style={[styles.bannerText, { color: event.tint }]}>
                {event.name} — {event.tag} · {formatDuration(remainingMs)} remaining
              </Text>
              <Pressable onPress={() => setShowMarketBanner(false)} hitSlop={12}>
                <Text style={[styles.bannerDismiss, { color: event.tint }]}>Dismiss</Text>
              </Pressable>
            </View>
          );
        })()}

        {/* News Feed Ticker */}
        {currentNews && (
          <View style={[styles.newsTicker, { backgroundColor: `${theme.info}08`, borderColor: theme.info }]}>
            <Text style={[styles.newsIcon]}>{currentNews.icon}</Text>
            <Text style={[styles.newsText, { color: theme.textMuted }]}>{currentNews.headline}</Text>
          </View>
        )}

        {/* Next Goal */}
        <View style={[styles.nextGoalCard, { borderColor: nextGoal.color, backgroundColor: `${nextGoal.color}08` }]} testID="next-goal">
          <LinearGradient
            colors={[`${nextGoal.color}12`, `${nextGoal.color}04`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.nextGoalHeader}>
            <Text style={[styles.nextGoalTitle, { color: nextGoal.color }]}>NEXT GOAL</Text>
            <Text style={[styles.nextGoalProgress, { color: nextGoal.color }]}>{nextGoal.progress}</Text>
          </View>
          <Text style={[styles.nextGoalDescription, { color: theme.textMuted }]}>{nextGoal.description}</Text>
        </View>
      </LinearGradient>

      <Animated.View style={[{ flex: 1 }, mainScreenEntranceStyle]}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {actives.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>ACTIVE INVESTMENTS</Text>
              <View style={[styles.sectionBadge, { backgroundColor: `${theme.upgrade}18`, borderColor: theme.upgrade }]}>
                <ExpoImage
                  source={require("@/assets/images/banknote.png")}
                  style={styles.sectionBadgeIcon}
                  contentFit="contain"
                />
              </View>
            </View>
            {actives.map((a) => {
              const pkg = packages.find((p) => p.id === a.pkgId);
              if (!pkg) return null;
              const total = a.endsAt - a.startedAt;
              const remaining = Math.max(0, a.endsAt - now);
              const progress = total > 0 ? Math.min(1, 1 - remaining / total) : 1;
              const effPct = computeProfitPct(pkg, levels.yield, prestige, treeEffects, actives.length, null, prestigeUpgrades.foundation, legacyUpgrades);
              const projected = a.cost * effPct;
              return (
                <View key={a.runId} style={[styles.activeCard, { backgroundColor: theme.panel, borderColor: theme.border }]} testID={`active-${a.runId}`}>
                  <View style={styles.activeHeaderRow}>
                    <View style={[styles.activeIcon, { backgroundColor: `${pkg.tint}22`, borderColor: pkg.tint }]}>
                      <Text style={[styles.activeIconText, { color: pkg.tint }]}>
                        +{fmtPct(effPct * 100)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activeName, { color: theme.text }]}>{pkg.name}</Text>
                      <Text style={[styles.activeMeta, { color: theme.gain }]}>{money(a.cost)} → +{money(projected)}</Text>
                    </View>
                    <Text style={[styles.activeCountdown, { color: theme.info }]}>{fmtSecs(remaining)}</Text>
                  </View>
                  <View style={[styles.activeBarTrack, { backgroundColor: theme.bgSoft }]}>
                    <LinearGradient
                      colors={[theme.upgrade, theme.upgrade]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.activeBarFill, { width: (progress * 100).toFixed(0) + "%" as any }]}
                    />
                  </View>
                  <Pressable
                    onPress={() => accelerate(a.runId)}
                    style={({ pressed }) => [styles.accelerateBtn, { borderColor: theme.border }, pressed && { transform: [{ scale: 0.97 }] }]}
                    testID={`accelerate-${a.runId}`}
                  >
                    <Text style={[styles.accelerateText, { color: theme.text }]}>ACCELERATE</Text>
                    <Text style={[styles.accelerateHint, { color: theme.textMuted }]}>
                      {treeEffects.autoAccelStrength > 0 ? "Auto-tap active · manual for burst" : "Tap to shave time"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, actives.length > 0 && { marginTop: 20 }, { color: theme.textMuted }]}>
            INVESTMENT PACKAGES
          </Text>
          <View style={[styles.sectionBadge, { backgroundColor: `${theme.money}18`, borderColor: theme.money }]}>
            <ExpoImage
              source={require("@/assets/images/banknote.png")}
              style={styles.sectionBadgeIcon}
              contentFit="contain"
            />
          </View>
        </View>

        {CATEGORY_ORDER.map((category) => {
          const allPkgs = getAllPackages();
          const categoryPkgs = allPkgs.filter((p) => p.category === category);
          const hasUnlocked = categoryPkgs.some((p) => !p.unlocked || p.unlocked(treeEffects));
          
          if (!hasUnlocked && categoryPkgs.every((p) => p.unlocked)) {
            // Skip categories where all packages are locked and none are unlocked
            return null;
          }

          return (
            <View key={category} style={{ marginTop: category === "consumer" ? 0 : 24 }}>
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryTitle, { color: theme.text }]}>{CATEGORY_NAMES[category]}</Text>
              </View>
              {categoryPkgs.map((pkg) => {
                const isUnlocked = !pkg.unlocked || pkg.unlocked(treeEffects);
                const affordable = balance >= pkg.cost;
                const isSelected = pkg.id === selectedId;
                const disabled = !affordable || !isUnlocked;
                const effPct = computeProfitPct(pkg, levels.yield, prestige, treeEffects, Math.max(1, actives.length + 1), null, prestigeUpgrades.foundation, legacyUpgrades);
                const effDur = computeDuration(pkg, levels.turbo, treeEffects, null, prestigeUpgrades.foundation, legacyUpgrades);
                const projectedProfit = pkg.cost * effPct;
                const roi = `+${fmtPct(effPct * 100)}`;
                
                return (
                  <Animated.View key={pkg.id} style={isSelected ? selectedPulseStyle : undefined}>
                    <Pressable
                      disabled={disabled}
                      onPress={() => {
                        if (!isUnlocked) return;
                        kickMusicOnce();
                        sound.play("click");
                        triggerHaptic(() => Haptics.selectionAsync());
                        setSelectedId(pkg.id);
                      }}
                      style={({ pressed }) => [
                        styles.card,
                        { backgroundColor: theme.panel, borderColor: theme.border },
                        isSelected && [styles.cardSelected, { borderColor: theme.upgrade, shadowColor: theme.upgrade }],
                        !isUnlocked && styles.cardLocked,
                        isUnlocked && !affordable && styles.cardLocked,
                        pkg.isPremium && { borderColor: pkg.tint, borderWidth: 2 },
                        pressed && !disabled && { transform: [{ scale: 0.99 }] },
                      ]}
                      testID={`package-${pkg.id}`}
                    >
                      {isSelected && !disabled && (
                        <LinearGradient
                          colors={[`${theme.upgrade}14`, `${theme.upgrade}04`]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                          pointerEvents="none"
                        />
                      )}
                      {pkg.isPremium && (
                        <LinearGradient
                          colors={[`${pkg.tint}12`, `${pkg.tint}04`]}
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
                            <Text style={[styles.cardTitle, { color: theme.text }, pkg.isPremium && { color: pkg.tint }]}>{pkg.name}</Text>
                            {!isUnlocked ? (
                              <View style={[styles.badgeLoss, { borderColor: theme.loss, backgroundColor: `${theme.loss}08` }]}><Text style={[styles.badgeLossText, { color: theme.loss }]}>{pkg.unlockRequirement || "LOCKED"}</Text></View>
                            ) : !affordable ? (
                              <View style={[styles.badgeLoss, { borderColor: theme.loss, backgroundColor: `${theme.loss}08` }]}><Text style={[styles.badgeLossText, { color: theme.loss }]}>LOCKED</Text></View>
                            ) : (
                              <View style={[styles.badgeTag, { borderColor: theme.upgrade, backgroundColor: `${theme.upgrade}08` }]}><Text style={[styles.badgeTagText, { color: theme.upgrade }]}>{pkg.tag}</Text></View>
                            )}
                          </View>
                          <View style={styles.cardMetaRow}>
                            <View style={styles.metaCell}>
                              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Cost</Text>
                              <Text style={[styles.metaValue, { color: theme.text }]}>{money(pkg.cost)}</Text>
                            </View>
                            <View style={styles.metaCell}>
                              <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Duration</Text>
                              <Text style={[styles.metaValue, { color: theme.text }]}>{fmtDuration(effDur)}</Text>
                            </View>
                          </View>
                          {isUnlocked && (
                            <View style={[styles.cardProfitSection, { borderTopColor: theme.border }]}>
                              <View style={styles.cardProfitRow}>
                                <Text style={[styles.cardProfitLabel, { color: theme.textMuted }]}>Profit</Text>
                                <Text style={[styles.cardProfitValue, { color: theme.gain }]}>+{money(projectedProfit)}</Text>
                              </View>
                            </View>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          );
        })}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { marginTop: 24 }, { color: theme.textMuted }]}>UPGRADES</Text>
        </View>

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
                { backgroundColor: theme.panel, borderColor: theme.border },
                !affordable && !maxed && styles.upgradeCardDim,
                pressed && affordable && { transform: [{ scale: 0.99 }] },
                maxed && { borderColor: theme.upgrade, backgroundColor: theme.panelElevated },
              ]}
              testID={`upgrade-${u.id}`}
            >
              <View style={styles.upgradeRow}>
                <View style={[styles.upgradeBadge, { backgroundColor: `${u.tint}22`, borderColor: u.tint }]}>
                  <Text style={[styles.upgradeBadgeLevel, { color: u.tint }]}>Lv {level}</Text>
                </View>
                <View style={styles.upgradeMain}>
                  <Text style={[styles.upgradeName, { color: theme.text }]}>{u.name}</Text>
                  <Text style={[styles.upgradeDesc, { color: theme.textMuted }]}>{u.description}</Text>
                  <Text style={[styles.upgradeEffect, { color: u.tint }]}>Current: {u.effect(level)}</Text>
                </View>
                <View style={styles.upgradeCta}>
                  {maxed ? (
                    <View style={[styles.maxedPill, { borderColor: theme.upgrade, backgroundColor: `${theme.upgrade}08` }]}><Text style={[styles.maxedText, { color: theme.upgrade }]}>MAX</Text></View>
                  ) : (
                    <>
                      <Text style={[styles.upgradeCost, { color: theme.text }, !affordable && { color: theme.textMuted }]} testID={`upgrade-cost-${u.id}`}>{money(cost)}</Text>
                      <Text style={[styles.upgradeBuy, { color: theme.text }, !affordable && { color: theme.textMuted }]}>BUY</Text>
                    </>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        {/* Prestige summary */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }, { color: theme.textMuted }]}>PRESTIGE</Text>
        <Pressable
          onPress={() => { sound.play("click"); setShowTree(true); }}
          style={({ pressed }) => [styles.prestigeSummary, { backgroundColor: theme.panel, borderColor: theme.prestige }, pressed && { transform: [{ scale: 0.99 }] }]}
          testID="prestige-summary"
        >
          <LinearGradient
            colors={[`${theme.prestige}22`, `${theme.upgrade}18`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.prestigeSummaryRow}>
            <View style={[styles.rankBadge, { borderColor: rankMeta.tint, backgroundColor: `${rankMeta.tint}22` }]}>
              <Text style={[styles.rankBadgeIcon, { color: rankMeta.tint }]}>{rankMeta.icon}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.prestigeSummaryTitle, { color: theme.text }]}>{rankMeta.name}</Text>
              <Text style={[styles.prestigeSummarySub, { color: theme.textMuted }]} numberOfLines={2}>
                {prestige} PP · +{fmtPct(currentBonusPct)} profit · {totalPrestiges} cash-outs
              </Text>
              {canPrestige && (
                <Text style={[styles.prestigeSummarySub, { color: theme.prestige, marginTop: 4 }]}>
                  Ready to cash out for +{prestigeGainAvailable} PP
                </Text>
              )}
            </View>
            <Text style={[styles.prestigeSummaryChevron, { color: theme.prestige }]}>▶</Text>
          </View>
        </Pressable>

        {/* Legacy endgame button — visible when totalPPEarned >= threshold */}
        {stats.totalPPEarned >= LEGACY_UNLOCK_THRESHOLD && (
          <Pressable
            onPress={() => { sound.play("click"); setShowLegacy(true); }}
            style={({ pressed }) => [styles.prestigeSummary, { marginTop: 12, backgroundColor: theme.panel, borderColor: `${theme.legacy}55` }, pressed && { transform: [{ scale: 0.99 }] }]}
            testID="legacy-summary"
          >
            <LinearGradient
              colors={[`${theme.legacy}22`, `${theme.legacy}12`]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.prestigeSummaryRow}>
              <View style={[styles.rankBadge, { borderColor: theme.legacy, backgroundColor: "rgba(255,215,0,0.15)" }]}>
                <Text style={[styles.rankBadgeIcon, { color: theme.legacy }]}>★</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.prestigeSummaryTitle, { color: theme.legacy }]}>LEGACY</Text>
                <Text style={[styles.prestigeSummarySub, { color: theme.textMuted }]}>
                  {legacyPoints} LP · {Object.values(legacyUpgrades).filter(Boolean).length}/7 upgrades
                </Text>
              </View>
              <Text style={[styles.prestigeSummaryChevron, { color: theme.legacy }]}>▶</Text>
            </View>
          </Pressable>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <View style={[styles.ctaBar, { backgroundColor: theme.bgSoft, borderTopColor: theme.border }]}>
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
            {canInvest ? (
              <LinearGradient
                colors={[theme.upgrade, theme.upgradeDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.investBtnGradient}
              >
                <View style={styles.investContentRow}>
                  <ExpoImage
                    source={require("@/assets/images/banknote.png")}
                    style={styles.investBtnIcon}
                    contentFit="contain"
                  />
                  <View style={styles.investContent}>
                    <Text style={[styles.investLabel, { color: '#FFFFFF' }]} testID="invest-label">
                      {ctaLabel}
                    </Text>
                    <Text style={[styles.investSub, { color: 'rgba(255,255,255,0.8)' }]}>
                      {ctaSub}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.investBtnGradient, { backgroundColor: "rgba(0,0,0,0.3)" }]}>
                <View style={styles.investContentRow}>
                  <ExpoImage
                    source={require("@/assets/images/banknote.png")}
                    style={styles.investBtnIcon}
                    contentFit="contain"
                  />
                  <View style={styles.investContent}>
                    <Text style={[styles.investLabel, { color: theme.loss }]} testID="invest-label">
                      {ctaLabel}
                    </Text>
                    <Text style={[styles.investSub, { color: theme.textMuted }]}>
                      {ctaSub}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </Pressable>
        </Animated.View>
        
        {/* Footer Branding */}
        <View style={styles.footerBrandingRow}>
          <ExpoImage
            source={require("@/assets/images/22.png")}
            style={styles.footerBrandingLogo}
            contentFit="contain"
          />
          <Text style={styles.footerBranding}>p2p.com.mk</Text>
        </View>
      </View>
      </Animated.View>

      {/* Developer menu overlay (hidden gesture: 7 taps on "PORTFOLIO BALANCE" within 3s) */}
      {showDebug && (
        <View style={styles.debugOverlay} testID="debug-overlay">
          <View style={[styles.debugCard, { backgroundColor: theme.panel, borderColor: theme.upgrade }]}>
            <View style={[styles.debugHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.debugTitle, { color: theme.upgrade }]}>DEVELOPER MENU</Text>
              <Pressable
                onPress={closeDebug}
                hitSlop={12}
                testID="debug-close"
                style={[styles.debugCloseBtn, { backgroundColor: theme.bgSoft, borderColor: theme.border }]}
              >
                <Text style={[styles.debugCloseText, { color: theme.textMuted }]}>✕</Text>
              </Pressable>
            </View>

            {!debugAuthed ? (
              <View>
                <Text style={[styles.debugLabel, { color: theme.textMuted }]}>Password required</Text>
                <TextInput
                  value={debugPassword}
                  onChangeText={(v) => { setDebugPassword(v); setDebugPwError(false); }}
                  onSubmitEditing={submitDebugPassword}
                  placeholder="••••"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  keyboardType="numeric"
                  autoFocus
                  style={[styles.debugInput, { backgroundColor: theme.bgSoft, color: theme.text, borderColor: theme.border }, debugPwError && [styles.debugInputError, { borderColor: theme.loss }]]}
                  testID="debug-password-input"
                />
                {debugPwError && (
                  <Text style={[styles.debugErrorText, { color: theme.loss }]} testID="debug-password-error">
                    Incorrect password
                  </Text>
                )}
                <Pressable
                  onPress={submitDebugPassword}
                  style={({ pressed }) => [
                    styles.debugActionBtn,
                    { backgroundColor: theme.upgrade },
                    pressed && { opacity: 0.85 },
                  ]}
                  testID="debug-password-submit"
                >
                  <Text style={[styles.debugActionText, { color: '#001018' }]}>UNLOCK</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <View style={styles.debugSection}>
                  <Text style={[styles.debugLabel, { color: theme.textMuted }]}>Add money</Text>
                  <View style={styles.debugRow}>
                    <TextInput
                      value={debugMoneyInput}
                      onChangeText={setDebugMoneyInput}
                      placeholder="Amount"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                      style={[styles.debugInput, { backgroundColor: theme.bgSoft, color: theme.text, borderColor: theme.border, flex: 1, marginBottom: 0 }]}
                      testID="debug-money-input"
                    />
                    <Pressable
                      onPress={devAddMoney}
                      style={({ pressed }) => [
                        styles.debugActionBtn,
                        { backgroundColor: theme.upgrade },
                        { marginLeft: 8, marginTop: 0, flex: 0 },
                        pressed && { opacity: 0.85 },
                      ]}
                      testID="debug-add-money"
                    >
                      <Text style={[styles.debugActionText, { color: '#001018' }]}>ADD</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.debugSection}>
                  <Text style={[styles.debugLabel, { color: theme.textMuted }]}>Add prestige points</Text>
                  <View style={styles.debugRow}>
                    <TextInput
                      value={debugPPInput}
                      onChangeText={setDebugPPInput}
                      placeholder="Amount"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="numeric"
                      style={[styles.debugInput, { backgroundColor: theme.bgSoft, color: theme.text, borderColor: theme.border, flex: 1, marginBottom: 0 }]}
                      testID="debug-pp-input"
                    />
                    <Pressable
                      onPress={devAddPP}
                      style={({ pressed }) => [
                        styles.debugActionBtn,
                        { backgroundColor: theme.upgrade },
                        { marginLeft: 8, marginTop: 0, flex: 0 },
                        pressed && { opacity: 0.85 },
                      ]}
                      testID="debug-add-pp"
                    >
                      <Text style={[styles.debugActionText, { color: '#001018' }]}>ADD</Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  onPress={closeDebug}
                  style={({ pressed }) => [
                    styles.debugActionBtn,
                    { backgroundColor: theme.panel, borderColor: theme.border },
                    pressed && { opacity: 0.85 },
                  ]}
                  testID="debug-close-btn"
                >
                  <Text style={[styles.debugActionText, { color: theme.text }]}>CLOSE</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Settings Screen */}
      <SettingsScreen
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingChange={(key, value) => setSettings({ ...settings, [key]: value })}
      />

      {/* Leaderboards Screen */}
      {showLeaderboards && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.leaderboardPanel, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <View style={styles.leaderboardHeader}>
              <Text style={[styles.leaderboardTitle, { color: theme.text }]}>🏆 Global Leaderboards</Text>
              <Pressable onPress={() => setShowLeaderboards(false)} hitSlop={12}>
                <Text style={[styles.leaderboardClose, { color: theme.textMuted }]}>✕</Text>
              </Pressable>
            </View>
            
            {/* Category tabs */}
            <View style={styles.leaderboardTabs}>
              {LEADERBOARD_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setLeaderboardCategory(cat.id)}
                  style={({ pressed }) => [
                    styles.leaderboardTab,
                    { backgroundColor: leaderboardCategory === cat.id ? `${theme.legacy}18` : theme.bgSoft, borderColor: leaderboardCategory === cat.id ? theme.legacy : theme.border },
                    pressed && { opacity: 0.8 }
                  ]}
                >
                  <Text style={[styles.leaderboardTabText, { color: leaderboardCategory === cat.id ? theme.legacy : theme.textMuted }]}>
                    {cat.icon} {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            
            {/* Leaderboard content */}
            {leaderboardData && (
              <View style={styles.leaderboardContent}>
                <View style={styles.leaderboardPlayerRank}>
                  <Text style={[styles.leaderboardPlayerRankText, { color: theme.text }]}>
                    Your Rank: #{leaderboardData.playerRank}
                  </Text>
                </View>
                
                {leaderboardData.entries.map((entry) => (
                  <View key={entry.rank} style={[styles.leaderboardEntry, { backgroundColor: entry.isPlayer ? `${theme.legacy}12` : theme.bgSoft, borderColor: entry.isPlayer ? theme.legacy : theme.border }]}>
                    <Text style={[styles.leaderboardRank, { color: entry.isPlayer ? theme.legacy : theme.textMuted }]}>
                      #{entry.rank}
                    </Text>
                    <Text style={[styles.leaderboardName, { color: entry.isPlayer ? theme.legacy : theme.text, fontWeight: entry.isPlayer ? '700' : '400' }]}>
                      {entry.name}
                    </Text>
                    <Text style={[styles.leaderboardValue, { color: theme.text }]}>
                      {leaderboardCategory === 'money' ? formatCurrency(entry.value) :
                       leaderboardCategory === 'playtime' ? formatDuration(entry.value) :
                       formatNumber(entry.value)}
                    </Text>
                  </View>
                ))}
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
  title, subtitle, icon, tint, path, skills, prestige, rank, prestigeUpgrades, onBuy, theme,
}: {
  title: string; subtitle: string; icon: string; tint: string;
  path: SkillPath;
  skills: SkillLevels;
  prestige: number;
  rank: Rank;
  prestigeUpgrades: Record<PrestigeUpgradeId, boolean>;
  onBuy: (n: SkillNode) => void;
  theme: ThemeColors;
}) {
  const nodes = SKILLS.filter((s) => s.path === path).sort((a, b) => a.row - b.row);
  const hasFoundation = prestigeUpgrades.foundation;
  return (
    <View style={styles.treeCol}>
      <View style={[styles.treeColHeader, { borderColor: tint, backgroundColor: `${tint}18` }]}>
        <Text style={[styles.treeColIcon, { color: tint }]}>{icon}</Text>
        <Text style={[styles.treeColTitle, { color: tint }]}>{title}</Text>
        <Text style={[styles.treeColSub, { color: theme.textMuted }]}>{subtitle}</Text>
      </View>

      {nodes.map((n, i) => {
        const level = skills[n.id] ?? 0;
        const maxed = level >= n.maxLevel;
        const rankOk = rankMeetsRequirement(rank, n.requiredRank);
        const missing = missingPrereqs(n, skills);
        const nextCost = maxed ? 0 : skillCost(n, level);
        const affordable = hasFoundation && rankOk && missing.length === 0 && !maxed && prestige >= nextCost;
        const locked = !hasFoundation || !rankOk || missing.length > 0;
        const hasPrereq = n.prereqs.length > 0;
        return (
          <View key={n.id} style={{ width: "100%", alignItems: "center" }}>
            {i > 0 && (
              <View
                style={[
                  styles.treeConnector,
                  {
                    backgroundColor:
                      (level > 0 || !hasPrereq) ? `${tint}90` : `${theme.border}90`,
                  },
                ]}
              />
            )}
            <Pressable
              onPress={() => onBuy(n)}
              disabled={locked || maxed || !affordable}
              style={({ pressed }) => [
                styles.skillNode,
                { backgroundColor: theme.panel, borderColor: level > 0 ? tint : theme.border },
                level > 0 && { backgroundColor: `${tint}15` },
                maxed && { borderColor: tint, backgroundColor: `${tint}28` },
                locked && styles.skillNodeLocked,
                !affordable && !locked && !maxed && styles.skillNodeDim,
                pressed && affordable && { transform: [{ scale: 0.97 }] },
              ]}
              testID={`skill-${n.id}`}
            >
              <Text style={[styles.skillName, { color: level > 0 ? tint : theme.text }]}>
                {n.short}
              </Text>
              <Text style={[styles.skillLvl, { color: theme.textMuted }]}>
                {maxed ? "MAX" : `Lv ${level}/${n.maxLevel}`}
              </Text>
              <Text style={[styles.skillEffect, { color: level > 0 ? tint : theme.textMuted }]} numberOfLines={2}>
                {n.effect(level)}
              </Text>
              {locked ? (
                <View style={[styles.skillLockBox, { borderColor: theme.loss, backgroundColor: `${theme.loss}08` }]}>
                  <Text style={[styles.skillLockText, { color: theme.loss }]}>
                    {!hasFoundation ? "Prestige Foundation required" : !rankOk ? `${RANK_META[n.requiredRank].short} rank` : missing[0]}
                  </Text>
                </View>
              ) : maxed ? (
                <View style={[styles.skillCostBox, { borderColor: tint }]}>
                  <Text style={[styles.skillCostText, { color: tint }]}>OWNED</Text>
                </View>
              ) : (
                <View style={[styles.skillCostBox, { borderColor: affordable ? theme.prestige : theme.border }]}>
                  <Text style={[styles.skillCostText, { color: affordable ? theme.prestige : theme.textMuted }]} testID={`skill-cost-${n.id}`}>
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
  safe: { flex: 1 },
  flashOverlay: { zIndex: 1 },
  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderText: { fontSize: 14, fontWeight: "700" },

  header: {
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap", gap: 8 },
  headerLeftGroup: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  headerRightRow: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 6 },
  balanceLabelRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 6 },
  balanceLabelIcon: { width: 16, height: 16, opacity: 0.7 },
  balanceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  headerLogo: { width: 80, height: 40 },
  iconChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, flexShrink: 1,
    minWidth: 70,
  },
  iconChipText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },

  balanceRow: { position: "relative", marginTop: 6, flexDirection: "row", alignItems: "flex-start", flexWrap: "nowrap", paddingHorizontal: 4 },
  balance: { fontSize: 34, fontWeight: "700", letterSpacing: -0.8, flexShrink: 1, marginRight: 8 },
  floatingProfit: {
    position: "absolute", right: 0, top: 4,
    fontSize: 14, fontWeight: "700", maxWidth: 120,
  },
  pillRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 8, flexWrap: "wrap", paddingHorizontal: 4 },
  slotPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1,
  },
  slotPillText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  availPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1,
  },
  availText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  passivePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1,
  },
  passiveText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },

  banner: {
    marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1,
  },
  bannerText: { fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 16 },
  bannerDismiss: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5, marginLeft: 12 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 120 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 0, marginLeft: 2, textTransform: "uppercase" },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeIcon: { width: 18, height: 18 },

  activeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16, marginBottom: 14, overflow: "hidden",
    shadowOpacity: 0.08, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  activeHeaderRow: { flexDirection: "row", alignItems: "center" },
  activeIcon: {
    width: 48, height: 48, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginRight: 12,
    flexShrink: 0,
  },
  activeIconText: { fontSize: 12, fontWeight: "700", lineHeight: 14 },
  activeName: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  activeMeta: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  activeCountdown: { fontSize: 14, fontWeight: "700", letterSpacing: 0.2, flexShrink: 0, marginLeft: 10 },
  activeBarTrack: {
    height: 6, borderRadius: 3, marginTop: 10,
    overflow: "hidden", borderWidth: 0,
  },
  activeBarFill: { height: "100%", borderRadius: 3 },
  accelerateBtn: {
    marginTop: 10, height: 52, borderRadius: 12,
    borderWidth: 0, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20,
    shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  accelerateText: { fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },
  accelerateHint: { fontSize: 11, fontWeight: "600", marginTop: 2 },

  categoryHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18, marginBottom: 14, position: "relative", overflow: "hidden",
    shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardSelected: {
    borderWidth: 2,
    shadowOpacity: 0.25, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  cardLocked: { opacity: 0.6 },
  cardRow: { flexDirection: "row", alignItems: "flex-start" },
  cardIcon: {
    width: 56, height: 56, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginRight: 12,
    flexShrink: 0,
  },
  cardIconText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3, lineHeight: 15 },
  cardMain: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { fontSize: 14, fontWeight: "600", flexShrink: 1, marginRight: 8, lineHeight: 18 },
  badgeTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1, flexShrink: 0,
  },
  badgeTagText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
  badgeLoss: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1,
  },
  badgeLossText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
  cardMetaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  metaCell: { flex: 1, minWidth: 80, marginRight: 12, marginBottom: 4 },
  metaLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3, marginBottom: 2, textTransform: "uppercase" },
  metaValue: { fontSize: 12, fontWeight: "600" },
  metaGain: {},
  cardProfitSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  cardProfitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardProfitLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  cardProfitValue: {
    fontSize: 13,
    fontWeight: "700",
  },

  upgradeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18, marginBottom: 14,
    shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  upgradeCardDim: { opacity: 0.6 },
  upgradeRow: { flexDirection: "row", alignItems: "center" },
  upgradeBadge: {
    minWidth: 52, height: 52, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginRight: 12, paddingHorizontal: 6,
    flexShrink: 0,
  },
  upgradeBadgeLevel: { fontSize: 14, fontWeight: "700", letterSpacing: 0.3, lineHeight: 16 },
  upgradeMain: { flex: 1, minWidth: 0, marginRight: 10 },
  upgradeName: { fontSize: 14, fontWeight: "600", flexShrink: 1, lineHeight: 18 },
  upgradeDesc: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  upgradeEffect: { fontSize: 11, fontWeight: "600", marginTop: 4 },
  upgradeCta: { alignItems: "flex-end", flexShrink: 0, marginLeft: 8 },
  upgradeCost: { fontSize: 13, fontWeight: "700" },
  upgradeBuy: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginTop: 4 },
  maxedPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1,
  },
  maxedText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  prestigeSummary: {
    borderRadius: 16, borderWidth: 1,
    padding: 18, overflow: "hidden",
    shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  prestigeSummaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  prestigeSummaryTitle: { fontSize: 14, fontWeight: "700", flexShrink: 1, lineHeight: 18 },
  prestigeSummarySub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  prestigeSummaryChevron: { fontSize: 16, fontWeight: "600", marginLeft: 8, flexShrink: 0 },

  ctaBar: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18,
    borderTopWidth: 1,
  },
  footerBrandingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
  },
  footerBrandingLogo: {
    width: 48,
    height: 24,
    opacity: 0.6,
  },
  footerBranding: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  investBtn: {
    height: 60, width: "100%", borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    overflow: "hidden",
    borderWidth: 0,
    shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  investBtnGradient: {
    flex: 1,
    width: "100%",
    justifyContent: "center", alignItems: "center",
  },
  investBtnDisabled: {
    shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  investContentRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  investBtnIcon: { width: 28, height: 28, opacity: 0.95 },
  investContent: { alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  investLabel: { fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },
  investSub: { fontSize: 13, fontWeight: "600", marginTop: 2, opacity: 0.9 },

  // Prestige tree screen
  treeHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  treeHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14, gap: 8,
  },
  treeHeaderCenter: {
    flexDirection: "column",
    alignItems: "center",
  },
  backBtn: { paddingVertical: 4, paddingRight: 8, flexShrink: 0 },
  backBtnText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  treeTitle: { fontSize: 16, fontWeight: "700", letterSpacing: 0.5, flexShrink: 1, textAlign: "center" },

  rankCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16, padding: 18,
    borderWidth: 1,
    shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  rankBadge: {
    width: 52, height: 52, borderRadius: 12, borderWidth: 2,
    alignItems: "center", justifyContent: "center", marginRight: 12,
    flexShrink: 0,
  },
  rankBadgeIcon: { fontSize: 18, fontWeight: "700", letterSpacing: 0.5 },
  rankLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  rankName: { fontSize: 14, fontWeight: "600", letterSpacing: 0.3, marginTop: 2, flexShrink: 1 },
  rankBar: {
    height: 6, borderRadius: 3,
    marginTop: 8, overflow: "hidden", borderWidth: 0,
  },
  rankBarFill: { height: "100%", borderRadius: 3 },
  rankProgress: { fontSize: 11, fontWeight: "500", marginTop: 4 },

  treeStats: {
    flexDirection: "row", alignItems: "center",
    marginTop: 14, paddingTop: 14, paddingBottom: 14, borderTopWidth: 1,
  },
  treeStatCell: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 1 },
  treeStatDivider: { width: 1, height: 28, flexShrink: 0 },
  treeStatLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 0.1, textTransform: "uppercase", marginBottom: 2, textAlign: "center", lineHeight: 10 },
  treeStatValue: { fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 16 },

  legacyProgressSection: {
    marginTop: 16, paddingTop: 16, borderTopWidth: 1,
  },
  legacyProgressHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 8,
  },
  legacyProgressTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  legacyProgressSubtitle: { fontSize: 11, fontWeight: "500" },
  legacyProgressBar: {
    height: 8, borderRadius: 4,
    overflow: "hidden", borderWidth: 0,
  },
  legacyProgressBarFill: { height: "100%", borderRadius: 4 },
  legacyProgressText: { fontSize: 11, fontWeight: "500", marginTop: 4 },

  // News Feed Ticker
  newsTicker: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  newsIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  newsText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },

  // Leaderboards Panel
  leaderboardPanel: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    bottom: 60,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  leaderboardClose: {
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  leaderboardTabs: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  leaderboardTab: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  leaderboardTabText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  leaderboardContent: {
    flex: 1,
  },
  leaderboardPlayerRank: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  leaderboardPlayerRankText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  leaderboardEntry: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  leaderboardRank: {
    fontSize: 14,
    fontWeight: "700",
    width: 40,
  },
  leaderboardName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  leaderboardValue: {
    fontSize: 13,
    fontWeight: "700",
  },

  prestigeExplanationSection: {
    marginTop: 16, paddingTop: 16, borderTopWidth: 1,
    borderRadius: 12, padding: 12,
  },
  prestigeExplanationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  prestigeExplanationTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  prestigeExplanationText: { fontSize: 12, fontWeight: "500", lineHeight: 16, marginTop: 8 },
  infoButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },

  legacyExplanationSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  legacyExplanationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legacyExplanationTitle: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  legacyExplanationText: { fontSize: 12, fontWeight: "500", lineHeight: 16, marginTop: 8 },

  upgradesSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
  upgradesSectionTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginBottom: 10 },
  prestigeUpgradeCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18, marginBottom: 14,
    shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  prestigeUpgradeCardOwned: {},
  prestigeUpgradeCardLeft: { flex: 1, minWidth: 0 },
  prestigeUpgradeCardRight: { alignItems: "flex-end", flexShrink: 0, marginLeft: 10 },
  prestigeUpgradeCardName: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  prestigeUpgradeCardDesc: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  prestigeUpgradeCardStatus: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  prestigeUpgradeOwnedBadge: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  prestigeUpgradeOwnedIcon: { fontSize: 14, fontWeight: "700" },
  prestigeUpgradeCostBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1,
  },
  prestigeUpgradeCostText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },

  // Legacy Endgame screen
  legacyHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  legacyHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14, gap: 8,
  },
  legacyHeaderCenter: {
    flexDirection: "column",
    alignItems: "center",
  },
  legacyTitle: { fontSize: 16, fontWeight: "700", letterSpacing: 0.5, flexShrink: 1, textAlign: "center" },
  legacyStats: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 14, padding: 14,
    borderWidth: 1,
    shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  legacyStatCell: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4 },
  legacyStatDivider: { width: 1, height: 28, flexShrink: 0 },
  legacyStatLabel: { fontSize: 8, fontWeight: "700", letterSpacing: 0.2, textTransform: "uppercase", marginBottom: 2, textAlign: "center", lineHeight: 10 },
  legacyStatValue: { fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 16 },
  ultimateBanner: {
    marginTop: 14, padding: 16, borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  ultimateTrophyIcon: {
    width: 36,
    height: 36,
    marginBottom: 4,
  },
  ultimateBannerText: { fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  ultimateBannerSub: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  viewEndingBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 0,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 28, overflow: "hidden",
    shadowOpacity: 0.1, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  viewEndingBtnText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  legacyBody: { flex: 1 },
  legacyBodyContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 120 },
  legacyCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18, marginBottom: 14,
    shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  legacyCardOwned: {},
  legacyCardFinal: {
    borderWidth: 2,
  },
  legacyCardLeft: { flex: 1, minWidth: 0 },
  legacyCardRight: { alignItems: "flex-end", flexShrink: 0, marginLeft: 10 },
  legacyCardName: { fontSize: 14, fontWeight: "600", flexShrink: 1, lineHeight: 18 },
  legacyCardDesc: { fontSize: 12, fontWeight: "500", marginTop: 3 },
  legacyCardEffect: { fontSize: 11, fontWeight: "600", marginTop: 4 },
  legacyCardStatus: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  legacyOwnedBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginRight: 14,
  },
  legacyOwnedIcon: { fontSize: 16, fontWeight: "700" },
  legacyCostBadge: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1,
  },
  legacyCostText: { fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },

  // Loading screen
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogo: {
    marginBottom: 32,
  },
  loadingLogoInner: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  loadingLogoText: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 2,
  },
  loadingTextContainer: {
    alignItems: "center",
    marginBottom: 56,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  loadingSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.8,
    opacity: 0.9,
  },
  loadingSpinner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  spinnerDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },

  // Onboarding screen
  onboardingContainer: {
    flex: 1,
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
  },
  onboardingCard: {
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    width: "100%",
    marginBottom: 36,
    shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  onboardingTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 14,
  },
  onboardingDescription: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    marginBottom: 20,
  },
  onboardingHighlight: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  onboardingHighlightText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  onboardingButton: {
    borderRadius: 14,
    marginBottom: 16,
    overflow: "hidden",
  },
  onboardingButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  onboardingButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: "center",
  },
  onboardingButtonText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#FFFFFF",
  },
  onboardingSkip: {
    padding: 12,
  },
  onboardingSkipText: {
    fontSize: 14,
    fontWeight: "500",
  },

  // Next Goal card
  nextGoalCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  nextGoalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  nextGoalTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  nextGoalProgress: {
    fontSize: 11,
    fontWeight: "600",
  },
  nextGoalDescription: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },

  cashOutBtn: {
    marginTop: 14, height: 60, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    borderWidth: 0, overflow: "hidden",
    paddingHorizontal: 20,
    shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  cashOutBtnGradient: {
    position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
  },
  cashOutBtnDim: {},
  cashOutBtnArmed: {},
  cashOutBtnInner: { alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  cashOutBtnText: { fontSize: 15, fontWeight: "700", letterSpacing: 0.4 },
  cashOutBtnSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },

  treeBody: { flex: 1 },
  treeBodyContent: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 120 },
  treeGridRow: { flexDirection: "row", alignItems: "flex-start" },
  treeCol: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4 },
  treeColHeader: {
    width: "100%", paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1, marginBottom: 8,
    alignItems: "center",
  },
  treeColIcon: { fontSize: 14, fontWeight: "600" },
  treeColTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2, marginTop: 2, textAlign: "center" },
  treeColSub: { fontSize: 8, fontWeight: "500", letterSpacing: 0.2, marginTop: 1, textAlign: "center" },

  treeConnector: {
    width: 3, height: 18, borderRadius: 2,
  },

  skillNode: {
    width: "100%", minHeight: 116, borderRadius: 12, borderWidth: 1,
    padding: 8, alignItems: "center",
    shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  skillNodeLocked: { opacity: 0.6, borderStyle: "dashed" },
  skillNodeDim: { opacity: 0.75 },
  skillName: { fontSize: 10, fontWeight: "600", letterSpacing: 0.2, textAlign: "center" },
  skillLvl: { fontSize: 9, fontWeight: "500", letterSpacing: 0.3, marginTop: 2 },
  skillEffect: { fontSize: 10, fontWeight: "500", textAlign: "center", marginTop: 4, lineHeight: 13 },
  skillLockBox: {
    marginTop: "auto", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1,
  },
  skillLockText: { fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },
  skillCostBox: {
    marginTop: "auto", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1,
  },
  skillCostText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },

  // Developer menu
  debugOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center",
    padding: 24, zIndex: 100,
  },
  debugCard: {
    width: "100%", maxWidth: 380,
    borderRadius: 16, borderWidth: 1,
    padding: 24,
    shadowOpacity: 0.3, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  debugHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  debugTitle: {
    fontSize: 14, fontWeight: "600", letterSpacing: 0.5,
  },
  debugCloseBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  debugCloseText: { fontSize: 16, fontWeight: "600" },
  debugSection: { marginBottom: 14 },
  debugLabel: {
    fontSize: 10, fontWeight: "600",
    letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8,
  },
  debugRow: { flexDirection: "row", alignItems: "center" },
  debugInput: {
    fontSize: 15, fontWeight: "500",
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1,
    marginBottom: 8,
  },
  debugInputError: {},
  debugErrorText: {
    fontSize: 11, fontWeight: "600", marginBottom: 8,
  },
  debugActionBtn: {
    marginTop: 8, height: 44, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16,
  },
  debugActionPrimary: {},
  debugActionSecondary: {
    height: 40,
  },
  debugActionClose: {
    borderWidth: 1, marginTop: 4,
  },
  debugActionText: {
    fontSize: 12, fontWeight: "900", letterSpacing: 1,
  },
});
