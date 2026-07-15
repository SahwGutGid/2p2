// Prestige Skill Tree — 3 paths (Automation / Bonus / Money Methods) × 6 ranks.
// Effects are resolved once via `deriveTreeEffects` and threaded into the
// existing game systems in `app/index.tsx`. No gameplay logic lives here.

import { formatCurrency, formatNumber, formatPercent } from "@/src/utils/format";

export type SkillPath = "automation" | "bonus" | "money";
export type Rank = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend";

// ---------- Prestige Upgrades ----------
// Separate from skill tree - these are one-time permanent upgrades bought with PP
export type PrestigeUpgradeId = "foundation";

export type PrestigeUpgrade = {
  id: PrestigeUpgradeId;
  name: string;
  description: string;
  cost: number;
  effect: string;
  tint: string;
};

export const PRESTIGE_UPGRADES: PrestigeUpgrade[] = [
  {
    id: "foundation",
    name: "Prestige Foundation",
    description: "2x investment profits · 1.5x investment speed · Unlocks prestige upgrade paths. Essential for long-term growth.",
    cost: 1,
    effect: "2x profit, 1.5x speed",
    tint: "#F59E0B",
  },
];

// ---------- Legacy Endgame System ----------
// Unlocks at 10,000 total Prestige Points. Final progression layer.
export const LEGACY_UNLOCK_THRESHOLD = 10000;

export type LegacyUpgradeId =
  | "investors-foundation"
  | "global-market"
  | "financial-automation"
  | "corporate-empire"
  | "market-dominance"
  | "global-network"
  | "ultimate-investor";

export type LegacyUpgrade = {
  id: LegacyUpgradeId;
  name: string;
  description: string;
  cost: number;
  effect: string;
  tint: string;
  isFinal: boolean;
};

export const LEGACY_UPGRADES: LegacyUpgrade[] = [
  {
    id: "investors-foundation",
    name: "Investor's Foundation",
    description: "+50% investment profits · +25% investment speed · Strong foundation for endgame progression",
    cost: 10,
    effect: "+50% profit, +25% speed",
    tint: "#F59E0B",
    isFinal: false,
  },
  {
    id: "global-market",
    name: "Global Market Access",
    description: "Unlocks elite investment opportunities · +30% market event rewards · Better rare package drops",
    cost: 50,
    effect: "Elite access, +30% market rewards",
    tint: "#14B8A6",
    isFinal: false,
  },
  {
    id: "financial-automation",
    name: "Financial Automation Network",
    description: "Auto-invest 2x faster · +100% offline earnings cap · Smart portfolio rebalancing",
    cost: 150,
    effect: "2x auto speed, +100% offline",
    tint: "#2563EB",
    isFinal: false,
  },
  {
    id: "corporate-empire",
    name: "Corporate Empire",
    description: `Generate ${formatCurrency(1000000)}/h passive income · +25% all profits · Unlock empire reputation bonuses`,
    cost: 400,
    effect: "+$1M/h passive, +25% profit",
    tint: "#7F1D1D",
    isFinal: false,
  },
  {
    id: "market-dominance",
    name: "Market Dominance",
    description: "Negative market events reduced by 75% · Positive events +50% stronger · You control the market",
    cost: 1000,
    effect: "-75% bad events, +50% good events",
    tint: "#134E4A",
    isFinal: false,
  },
  {
    id: "global-network",
    name: "Global Investment Network",
    description: "+100% all profits · +50% investment speed · Unlock ultimate business network bonuses",
    cost: 2500,
    effect: "+100% profit, +50% speed",
    tint: "#FBBF24",
    isFinal: false,
  },
  {
    id: "ultimate-investor",
    name: "The Ultimate Investor",
    description: "FINAL ACHIEVEMENT · +200% all profits · Legendary golden theme · Ultimate Investor title · Game completion celebration",
    cost: 10000,
    effect: "+200% profit, legendary theme, title",
    tint: "#E5E7EB",
    isFinal: true,
  },
];

export const RANKS: Rank[] = ["bronze", "silver", "gold", "platinum", "diamond", "legend"];

export const RANK_META: Record<
  Rank,
  { name: string; short: string; minPrestiges: number; tint: string; icon: string }
> = {
  bronze:   { name: "Bronze Investor",   short: "Bronze",   minPrestiges: 0,   tint: "#CD7F32", icon: "III" },
  silver:   { name: "Silver Investor",   short: "Silver",   minPrestiges: 3,   tint: "#C0C0C0", icon: "IV" },
  gold:     { name: "Gold Investor",     short: "Gold",     minPrestiges: 8,   tint: "#F59E0B", icon: "V" },
  platinum: { name: "Platinum Investor", short: "Platinum", minPrestiges: 20,  tint: "#E5E7EB", icon: "VI" },
  diamond:  { name: "Diamond Investor",  short: "Diamond",  minPrestiges: 50,  tint: "#67E8F9", icon: "VII" },
  legend:   { name: "Legend Investor",   short: "Legend",   minPrestiges: 120, tint: "#A855F7", icon: "VIII" },
};

export const computeRank = (totalPrestiges: number): Rank => {
  let r: Rank = "bronze";
  for (const rk of RANKS) {
    if (totalPrestiges >= RANK_META[rk].minPrestiges) r = rk;
  }
  return r;
};

export const nextRank = (r: Rank): Rank | null => {
  const idx = RANKS.indexOf(r);
  return idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
};

export const rankMeetsRequirement = (current: Rank, required: Rank): boolean =>
  RANKS.indexOf(current) >= RANKS.indexOf(required);

export type SkillNode = {
  id: string;
  name: string;
  short: string;
  description: string;
  effect: (level: number) => string;
  path: SkillPath;
  row: number;          // vertical position within path column
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  prereqs: { id: string; level: number }[];
  requiredRank: Rank;
  tint: string;
};

// ---------- SKILLS ----------
// Balancing rationale (see notes below list):
//  - Bronze tier costs 2-8 PP → affordable in first 3-5 prestiges.
//  - Silver/Gold tiers pull heavier PP so mid-late runs stay meaningful.
//  - No node is a "must-have"; each path independently valuable.
export const SKILLS: SkillNode[] = [
  // ─── AUTOMATION (10 nodes) ─────────────────────────────────────
  {
    id: "auto-reinvest",
    name: "Auto-Reinvest",
    short: "Auto-Reinvest",
    description: "When a slot completes, automatically invest the selected package again if affordable.",
    effect: () => "Auto-invest freed slot",
    path: "automation", row: 0,
    baseCost: 5, costGrowth: 1, maxLevel: 1,
    prereqs: [], requiredRank: "bronze", tint: "#EF4444",
  },
  {
    id: "auto-fill",
    name: "Slot Autofill",
    short: "Autofill",
    description: "On resume, fill every empty portfolio slot with the selected package.",
    effect: () => "Fill all empty slots",
    path: "automation", row: 1,
    baseCost: 15, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "auto-reinvest", level: 1 }], requiredRank: "silver", tint: "#DC2626",
  },
  {
    id: "auto-accel",
    name: "Auto-Accelerate",
    short: "Auto-Accel",
    description: "Every 400 ms, automatically tap Accelerate at reduced strength.",
    effect: (l) => `${formatPercent([33, 66, 100][l - 1] ?? 0)} of manual power`,
    path: "automation", row: 2,
    baseCost: 12, costGrowth: 1.75, maxLevel: 3,
    prereqs: [{ id: "auto-reinvest", level: 1 }], requiredRank: "silver", tint: "#DC2626",
  },
  {
    id: "offline-loop",
    name: "Offline Trading Desk",
    short: "Offline Loop",
    description: "Auto-reinvest continues while the app is closed (capped at 8 hours).",
    effect: () => "Offline auto-reinvest",
    path: "automation", row: 3,
    baseCost: 40, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "auto-fill", level: 1 }], requiredRank: "gold", tint: "#EF4444",
  },
  {
    id: "smart-select",
    name: "Smart Broker",
    short: "Smart Broker",
    description: "Auto-invest picks the highest-tier affordable package for each empty slot.",
    effect: () => "Best pkg selected",
    path: "automation", row: 4,
    baseCost: 60, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "auto-fill", level: 1 }], requiredRank: "platinum", tint: "#F87171",
  },
  {
    id: "auto-upgrade",
    name: "Automated Upgrades",
    short: "Auto-Upgrades",
    description: "Automatically purchase the next affordable skill tree upgrade when PP is available.",
    effect: () => "Auto-buy skills",
    path: "automation", row: 5,
    baseCost: 80, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "smart-select", level: 1 }], requiredRank: "platinum", tint: "#F87171",
  },
  {
    id: "batch-processor",
    name: "Batch Processing",
    short: "Batch Process",
    description: "Investment completions process 25% faster, reducing queue delays.",
    effect: () => "25% faster completions",
    path: "automation", row: 6,
    baseCost: 100, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "offline-loop", level: 1 }], requiredRank: "diamond", tint: "#EF4444",
  },
  {
    id: "algorithmic-trading",
    name: "Algorithmic Trading",
    short: "Algo Trading",
    description: "Auto-invest selects optimal packages 15% more efficiently.",
    effect: () => "15% better selection",
    path: "automation", row: 7,
    baseCost: 150, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "auto-upgrade", level: 1 }], requiredRank: "diamond", tint: "#DC2626",
  },
  {
    id: "quantum-automation",
    name: "Quantum Automation",
    short: "Quantum",
    description: "All automation systems operate 20% faster.",
    effect: () => "20% faster automation",
    path: "automation", row: 8,
    baseCost: 250, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "batch-processor", level: 1 }], requiredRank: "legend", tint: "#F87171",
  },
  {
    id: "autonomous-portfolio",
    name: "Autonomous Portfolio",
    short: "Autonomous",
    description: "Auto-invest triggers 30% more frequently when slots are available.",
    effect: () => "30% more frequent",
    path: "automation", row: 9,
    baseCost: 400, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "algorithmic-trading", level: 1 }], requiredRank: "legend", tint: "#EF4444",
  },

  // ─── BONUS (10 nodes) ──────────────────────────────────────────
  {
    id: "profit-boost",
    name: "Compound Yield",
    short: "Compound Yield",
    description: "+5% permanent profit multiplier per level.",
    effect: (l) => `+${formatPercent(l * 5)} profit`,
    path: "bonus", row: 0,
    baseCost: 2, costGrowth: 1.35, maxLevel: 10,
    prereqs: [], requiredRank: "bronze", tint: "#00C896",
  },
  {
    id: "time-cut",
    name: "Fast-Track Fund",
    short: "Fast-Track",
    description: "-3% package duration per level (multiplicative with Turbo Trades).",
    effect: (l) => `-${formatPercent(l * 3)} time`,
    path: "bonus", row: 1,
    baseCost: 3, costGrowth: 1.4, maxLevel: 8,
    prereqs: [], requiredRank: "bronze", tint: "#00C896",
  },
  {
    id: "starting-cash",
    name: "Legacy Capital",
    short: "Legacy Capital",
    description: "Start each new run with more cash after prestige.",
    effect: (l) => {
      const values = [100, 500, 2000, 10000, 50000];
      return `Start with +${formatCurrency(values[l - 1] ?? 0)}`;
    },
    path: "bonus", row: 2,
    baseCost: 3, costGrowth: 1.9, maxLevel: 5,
    prereqs: [], requiredRank: "bronze", tint: "#00C896",
  },
  {
    id: "accel-boost",
    name: "Turbo Accelerator",
    short: "Turbo Accel",
    description: "Accelerate strength doubles / triples / quadruples per tap.",
    effect: (l) => `${l + 1}× accel power`,
    path: "bonus", row: 3,
    baseCost: 15, costGrowth: 1.8, maxLevel: 3,
    prereqs: [{ id: "time-cut", level: 3 }], requiredRank: "silver", tint: "#22C55E",
  },
  {
    id: "passive-mult",
    name: "Passive Amplifier",
    short: "Passive Amp",
    description: "Passive Yield output +15% per level.",
    effect: (l) => `+${formatPercent(l * 15)} passive`,
    path: "bonus", row: 4,
    baseCost: 10, costGrowth: 1.55, maxLevel: 6,
    prereqs: [{ id: "profit-boost", level: 5 }], requiredRank: "silver", tint: "#22C55E",
  },
  {
    id: "slot-power",
    name: "Portfolio Synergy",
    short: "Synergy",
    description: "+4% profit per additional slot currently invested.",
    effect: (l) => `+${formatPercent(l * 4)} per filled slot`,
    path: "bonus", row: 5,
    baseCost: 25, costGrowth: 1.6, maxLevel: 5,
    prereqs: [{ id: "passive-mult", level: 3 }], requiredRank: "gold", tint: "#22C55E",
  },
  {
    id: "market-insight",
    name: "Market Insight",
    short: "Market Insight",
    description: "Market event rewards increased by 25% and negative events reduced by 20%.",
    effect: () => "25% better events",
    path: "bonus", row: 6,
    baseCost: 40, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "slot-power", level: 3 }], requiredRank: "gold", tint: "#00C896",
  },
  {
    id: "compound-interest",
    name: "Compound Interest",
    short: "Compound Interest",
    description: "Savings account interest compounds 50% more frequently.",
    effect: () => "50% faster compounding",
    path: "bonus", row: 7,
    baseCost: 60, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "starting-cash", level: 3 }], requiredRank: "platinum", tint: "#22C55E",
  },
  {
    id: "wealth-multiplier",
    name: "Wealth Multiplier",
    short: "Wealth Mult",
    description: "All profit bonuses multiplied by 1.5x.",
    effect: () => "1.5× all bonuses",
    path: "bonus", row: 8,
    baseCost: 120, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "market-insight", level: 1 }], requiredRank: "diamond", tint: "#00C896",
  },
  {
    id: "fortune-favor",
    name: "Fortune's Favor",
    short: "Fortune",
    description: "10% chance to double profits on investment completions.",
    effect: () => "10% chance 2× profit",
    path: "bonus", row: 9,
    baseCost: 200, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "compound-interest", level: 1 }], requiredRank: "legend", tint: "#22C55E",
  },

  // ─── MONEY METHODS (10 nodes) ──────────────────────────────────
  {
    id: "savings",
    name: "Savings Account",
    short: "Savings",
    description: "Idle balance earns interest continuously.",
    effect: (l) => `+${formatPercent(l * 0.2)}/hr on cash`,
    path: "money", row: 0,
    baseCost: 4, costGrowth: 1.5, maxLevel: 5,
    prereqs: [], requiredRank: "bronze", tint: "#3B82F6",
  },
  {
    id: "grants",
    name: "Gov. Grants",
    short: "Grants",
    description: "Bankruptcy stimulus payout is dramatically increased.",
    effect: (l) => {
      const values = [50, 200, 1000];
      return `${formatCurrency(values[l - 1] ?? 15)} bailout`;
    },
    path: "money", row: 1,
    baseCost: 4, costGrowth: 2, maxLevel: 3,
    prereqs: [], requiredRank: "bronze", tint: "#3B82F6",
  },
  {
    id: "dividends",
    name: "Dividend Reserve",
    short: "Dividends",
    description: "Each completion pays an extra dividend tip on top of profit.",
    effect: (l) => `+${formatPercent(l * 3)} dividend tip`,
    path: "money", row: 2,
    baseCost: 10, costGrowth: 1.5, maxLevel: 5,
    prereqs: [{ id: "savings", level: 3 }], requiredRank: "silver", tint: "#60A5FA",
  },
  {
    id: "contracts",
    name: "Long-Term Contract",
    short: "Contract",
    description: `Unlock the Contract package — ${formatCurrency(10000)} stake, 5 min, +${formatPercent(400)} profit.`,
    effect: () => "New package: Contract",
    path: "money", row: 3,
    baseCost: 50, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "dividends", level: 3 }], requiredRank: "gold", tint: "#60A5FA",
  },
  {
    id: "super-contract",
    name: "Legendary Contract",
    short: "Legendary",
    description: `Unlock the Legendary Contract — ${formatCurrency(100000)} stake, 15 min, +${formatPercent(900)} profit.`,
    effect: () => "New package: Legendary",
    path: "money", row: 4,
    baseCost: 100, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "contracts", level: 1 }], requiredRank: "platinum", tint: "#60A5FA",
  },
  {
    id: "whale-mult",
    name: "Whale Handler",
    short: "Whale +50%",
    description: "Whale Vault base profit +50% (stacks with other bonuses).",
    effect: () => `Whale Vault +${formatPercent(50)}`,
    path: "money", row: 5,
    baseCost: 80, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "contracts", level: 1 }], requiredRank: "diamond", tint: "#60A5FA",
  },
  {
    id: "legend-bonus",
    name: "Legendary Mastery",
    short: "Legend Master",
    description: "Legendary Contract profit doubled.",
    effect: () => `Legendary +${formatPercent(100)}`,
    path: "money", row: 6,
    baseCost: 200, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "super-contract", level: 1 }], requiredRank: "legend", tint: "#3B82F6",
  },
  {
    id: "banking-network",
    name: "Global Banking Network",
    short: "Banking Net",
    description: "Investment costs reduced by 10%.",
    effect: () => "10% cheaper investments",
    path: "money", row: 7,
    baseCost: 150, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "whale-mult", level: 1 }], requiredRank: "diamond", tint: "#60A5FA",
  },
  {
    id: "investment-fund",
    name: "Hedge Fund Strategy",
    short: "Hedge Fund",
    description: "Passive income increased by 25%.",
    effect: () => "25% more passive",
    path: "money", row: 8,
    baseCost: 250, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "banking-network", level: 1 }], requiredRank: "legend", tint: "#3B82F6",
  },
  {
    id: "capital-mastery",
    name: "Capital Mastery",
    short: "Capital Mastery",
    description: "All profits increased by 15%.",
    effect: () => "15% more profit",
    path: "money", row: 9,
    baseCost: 350, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "investment-fund", level: 1 }], requiredRank: "legend", tint: "#60A5FA",
  },

  // ─── ENDGAME (Legend-only chain in the Money column) ──────────
  {
    id: "endgame-profit",
    name: "Ascended Trader",
    short: "Ascendant",
    description: "All investment profits tripled — the market bends to your will.",
    effect: () => "All profits ×3",
    path: "money", row: 10,
    baseCost: 800, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "capital-mastery", level: 1 }], requiredRank: "legend", tint: "#7C3AED",
  },
  {
    id: "endgame-costs",
    name: "Financial Enlightenment",
    short: "Enlightened",
    description: "Every investment costs 50% less.",
    effect: () => "Pkg costs −50%",
    path: "money", row: 11,
    baseCost: 1200, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "endgame-profit", level: 1 }], requiredRank: "legend", tint: "#A855F7",
  },
  {
    id: "endgame-passive",
    name: "Infinite Yield",
    short: "Infinite Yield",
    description: "Passive income and savings interest quintupled.",
    effect: () => "Passive ×5",
    path: "money", row: 12,
    baseCost: 1500, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "endgame-costs", level: 1 }], requiredRank: "legend", tint: "#C084FC",
  },
  {
    id: "endgame-capstone",
    name: "Market Dominance",
    short: "Market Dom",
    description: "All upgrade costs reduced by 75%. You have beaten the market.",
    effect: () => "Upgrade costs −75%",
    path: "money", row: 13,
    baseCost: 3000, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "endgame-passive", level: 1 }], requiredRank: "legend", tint: "#7C3AED",
  },
];

export const skillCost = (node: SkillNode, level: number) =>
  Math.floor(node.baseCost * Math.pow(node.costGrowth, level));

// Returns list of unmet prerequisite short-labels; empty = unlocked.
export const missingPrereqs = (
  node: SkillNode,
  levels: SkillLevels
): string[] => {
  const missing: string[] = [];
  for (const p of node.prereqs) {
    const cur = levels[p.id] ?? 0;
    if (cur < p.level) {
      const src = SKILLS.find((s: SkillNode) => s.id === p.id);
      if (src) missing.push(`${src.short} Lv${p.level}`);
    }
  }
  return missing;
};

export type SkillLevels = Record<string, number>;

// ---------- Derived effects ----------
export type TreeEffects = {
  profitMult: number;         // multiplicative bonus applied on top of yield+prestige
  durationMult: number;       // multiplied into base duration (before turbo)
  passiveMult: number;
  accelStrengthMult: number;
  startingCashBonus: number;
  bailoutAmount: number;
  slotSynergyPct: number;
  savingsRatePerSec: number;  // fraction of balance per second
  dividendPct: number;
  // Automation flags
  autoReinvest: boolean;
  autoFill: boolean;
  autoAccelStrength: number;  // 0 disabled, 0.33/0.66/1 else
  offlineLoop: boolean;
  smartSelect: boolean;
  autoUpgrade: boolean;
  batchProcessor: boolean;
  algoTrading: boolean;
  quantumAutomation: boolean;
  autonomousPortfolio: boolean;
  // Bonus effects
  marketInsight: boolean;
  compoundInterest: boolean;
  wealthMultiplier: boolean;
  fortuneFavor: boolean;
  // Money effects
  bankingNetwork: boolean;
  investmentFund: boolean;
  capitalMastery: boolean;
  // Content unlocks
  contractsUnlocked: boolean;
  legendaryUnlocked: boolean;
  whaleBonus: number;         // additive %, e.g. 0.5
  legendaryBonus: number;
  // Endgame
  endgameProfitMult: number;      // ×3 from Ascended Trader
  endgameCostMult: number;        // ×0.5 from Financial Enlightenment
  endgamePassiveMult: number;     // ×5 from Infinite Yield
  endgameUpgradeCostMult: number; // ×0.25 from The Ascendant
  endgameComplete: boolean;
};

const lvl = (levels: SkillLevels, id: string) => levels[id] ?? 0;

export const deriveTreeEffects = (levels: SkillLevels): TreeEffects => {
  const startCashTable = [0, 100, 500, 2000, 10000, 50000];
  const bailoutTable = [15, 50, 200, 1000];
  const autoAccelStr = [0, 0.33, 0.66, 1];
  return {
    profitMult:       1 + 0.05 * lvl(levels, "profit-boost"),
    durationMult:     1 - 0.03 * lvl(levels, "time-cut"),
    passiveMult:      1 + 0.15 * lvl(levels, "passive-mult"),
    accelStrengthMult: 1 + lvl(levels, "accel-boost"), // Lv0=1, Lv1=2×, Lv2=3×, Lv3=4×
    startingCashBonus: startCashTable[lvl(levels, "starting-cash")] ?? 0,
    bailoutAmount:     bailoutTable[lvl(levels, "grants")] ?? 15,
    slotSynergyPct:   0.04 * lvl(levels, "slot-power"),
    savingsRatePerSec: (0.002 * lvl(levels, "savings")) / 3600, // 0.2%/hr per level
    dividendPct:      0.03 * lvl(levels, "dividends"),
    autoReinvest:     lvl(levels, "auto-reinvest") >= 1,
    autoFill:         lvl(levels, "auto-fill") >= 1,
    autoAccelStrength: autoAccelStr[lvl(levels, "auto-accel")] ?? 0,
    offlineLoop:      lvl(levels, "offline-loop") >= 1,
    smartSelect:      lvl(levels, "smart-select") >= 1,
    autoUpgrade:      lvl(levels, "auto-upgrade") >= 1,
    batchProcessor:   lvl(levels, "batch-processor") >= 1,
    algoTrading:      lvl(levels, "algorithmic-trading") >= 1,
    quantumAutomation: lvl(levels, "quantum-automation") >= 1,
    autonomousPortfolio: lvl(levels, "autonomous-portfolio") >= 1,
    marketInsight:    lvl(levels, "market-insight") >= 1,
    compoundInterest: lvl(levels, "compound-interest") >= 1,
    wealthMultiplier: lvl(levels, "wealth-multiplier") >= 1,
    fortuneFavor:     lvl(levels, "fortune-favor") >= 1,
    bankingNetwork:   lvl(levels, "banking-network") >= 1,
    investmentFund:   lvl(levels, "investment-fund") >= 1,
    capitalMastery:   lvl(levels, "capital-mastery") >= 1,
    contractsUnlocked: lvl(levels, "contracts") >= 1,
    legendaryUnlocked: lvl(levels, "super-contract") >= 1,
    whaleBonus:       lvl(levels, "whale-mult") >= 1 ? 0.5 : 0,
    legendaryBonus:   lvl(levels, "legend-bonus") >= 1 ? 1.0 : 0,
    endgameProfitMult:      lvl(levels, "endgame-profit") >= 1 ? 3 : 1,
    endgameCostMult:        lvl(levels, "endgame-costs") >= 1 ? 0.5 : 1,
    endgamePassiveMult:     lvl(levels, "endgame-passive") >= 1 ? 5 : 1,
    endgameUpgradeCostMult: lvl(levels, "endgame-capstone") >= 1 ? 0.25 : 1,
    endgameComplete:
      lvl(levels, "endgame-profit") >= 1 &&
      lvl(levels, "endgame-costs") >= 1 &&
      lvl(levels, "endgame-passive") >= 1 &&
      lvl(levels, "endgame-capstone") >= 1,
  };
};

// Total PP spent (for stats/UI display).
export const totalSpentPP = (levels: SkillLevels): number => {
  let total = 0;
  for (const n of SKILLS) {
    const lv = lvl(levels, n.id);
    for (let i = 0; i < lv; i++) total += skillCost(n, i);
  }
  return total;
};
