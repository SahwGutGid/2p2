// Prestige Skill Tree — 3 paths (Automation / Bonus / Money Methods) × 6 ranks.
// Effects are resolved once via `deriveTreeEffects` and threaded into the
// existing game systems in `app/index.tsx`. No gameplay logic lives here.

export type SkillPath = "automation" | "bonus" | "money";
export type Rank = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend";

export const RANKS: Rank[] = ["bronze", "silver", "gold", "platinum", "diamond", "legend"];

export const RANK_META: Record<
  Rank,
  { name: string; short: string; minPrestiges: number; tint: string; icon: string }
> = {
  bronze:   { name: "Bronze Investor",   short: "Bronze",   minPrestiges: 0,   tint: "#CD7F32", icon: "III" },
  silver:   { name: "Silver Investor",   short: "Silver",   minPrestiges: 3,   tint: "#C0C0C0", icon: "IV" },
  gold:     { name: "Gold Investor",     short: "Gold",     minPrestiges: 8,   tint: "#FFD54F", icon: "V" },
  platinum: { name: "Platinum Investor", short: "Platinum", minPrestiges: 20,  tint: "#E5E4E2", icon: "VI" },
  diamond:  { name: "Diamond Investor",  short: "Diamond",  minPrestiges: 50,  tint: "#B9F2FF", icon: "VII" },
  legend:   { name: "Legend Investor",   short: "Legend",   minPrestiges: 120, tint: "#FF6EC7", icon: "VIII" },
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
  // ─── AUTOMATION (5 nodes) ─────────────────────────────────────
  {
    id: "auto-reinvest",
    name: "Auto-Reinvest",
    short: "Auto-Reinvest",
    description: "When a slot completes, automatically invest the selected package again if affordable.",
    effect: () => "Auto-invest freed slot",
    path: "automation", row: 0,
    baseCost: 5, costGrowth: 1, maxLevel: 1,
    prereqs: [], requiredRank: "bronze", tint: "#00E5FF",
  },
  {
    id: "auto-fill",
    name: "Slot Autofill",
    short: "Autofill",
    description: "On resume, fill every empty portfolio slot with the selected package.",
    effect: () => "Fill all empty slots",
    path: "automation", row: 1,
    baseCost: 15, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "auto-reinvest", level: 1 }], requiredRank: "silver", tint: "#00E5FF",
  },
  {
    id: "auto-accel",
    name: "Auto-Accelerate",
    short: "Auto-Accel",
    description: "Every 400 ms, automatically tap Accelerate at reduced strength.",
    effect: (l) => `${[33, 66, 100][l - 1] ?? 0}% of manual power`,
    path: "automation", row: 2,
    baseCost: 12, costGrowth: 1.75, maxLevel: 3,
    prereqs: [{ id: "auto-reinvest", level: 1 }], requiredRank: "silver", tint: "#00E5FF",
  },
  {
    id: "offline-loop",
    name: "Offline Trading Desk",
    short: "Offline Loop",
    description: "Auto-reinvest continues while the app is closed (capped at 8 hours).",
    effect: () => "Offline auto-reinvest",
    path: "automation", row: 3,
    baseCost: 40, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "auto-fill", level: 1 }], requiredRank: "gold", tint: "#00E5FF",
  },
  {
    id: "smart-select",
    name: "Smart Broker",
    short: "Smart Broker",
    description: "Auto-invest picks the highest-tier affordable package for each empty slot.",
    effect: () => "Best pkg selected",
    path: "automation", row: 4,
    baseCost: 60, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "auto-fill", level: 1 }], requiredRank: "platinum", tint: "#00E5FF",
  },

  // ─── BONUS (6 nodes) ──────────────────────────────────────────
  {
    id: "profit-boost",
    name: "Compound Yield",
    short: "Compound Yield",
    description: "+5% permanent profit multiplier per level.",
    effect: (l) => `+${l * 5}% profit`,
    path: "bonus", row: 0,
    baseCost: 2, costGrowth: 1.35, maxLevel: 10,
    prereqs: [], requiredRank: "bronze", tint: "#00FF88",
  },
  {
    id: "time-cut",
    name: "Fast-Track Fund",
    short: "Fast-Track",
    description: "-3% package duration per level (multiplicative with Turbo Trades).",
    effect: (l) => `-${l * 3}% time`,
    path: "bonus", row: 1,
    baseCost: 3, costGrowth: 1.4, maxLevel: 8,
    prereqs: [], requiredRank: "bronze", tint: "#00FF88",
  },
  {
    id: "starting-cash",
    name: "Legacy Capital",
    short: "Legacy Capital",
    description: "Start each new run with more cash after prestige.",
    effect: (l) => {
      const values = [100, 500, 2000, 10000, 50000];
      return `Start with +$${(values[l - 1] ?? 0).toLocaleString()}`;
    },
    path: "bonus", row: 2,
    baseCost: 3, costGrowth: 1.9, maxLevel: 5,
    prereqs: [], requiredRank: "bronze", tint: "#00FF88",
  },
  {
    id: "accel-boost",
    name: "Turbo Accelerator",
    short: "Turbo Accel",
    description: "Accelerate strength doubles / triples / quadruples per tap.",
    effect: (l) => `${l + 1}× accel power`,
    path: "bonus", row: 3,
    baseCost: 15, costGrowth: 1.8, maxLevel: 3,
    prereqs: [{ id: "time-cut", level: 3 }], requiredRank: "silver", tint: "#00FF88",
  },
  {
    id: "passive-mult",
    name: "Passive Amplifier",
    short: "Passive Amp",
    description: "Passive Yield output +15% per level.",
    effect: (l) => `+${l * 15}% passive`,
    path: "bonus", row: 4,
    baseCost: 10, costGrowth: 1.55, maxLevel: 6,
    prereqs: [{ id: "profit-boost", level: 5 }], requiredRank: "silver", tint: "#00FF88",
  },
  {
    id: "slot-power",
    name: "Portfolio Synergy",
    short: "Synergy",
    description: "+4% profit per additional slot currently invested.",
    effect: (l) => `+${l * 4}% per filled slot`,
    path: "bonus", row: 5,
    baseCost: 25, costGrowth: 1.6, maxLevel: 5,
    prereqs: [{ id: "passive-mult", level: 3 }], requiredRank: "gold", tint: "#00FF88",
  },

  // ─── MONEY METHODS (7 nodes) ──────────────────────────────────
  {
    id: "savings",
    name: "Savings Account",
    short: "Savings",
    description: "Idle balance earns interest continuously.",
    effect: (l) => `+${(l * 0.2).toFixed(1)}%/hr on cash`,
    path: "money", row: 0,
    baseCost: 4, costGrowth: 1.5, maxLevel: 5,
    prereqs: [], requiredRank: "bronze", tint: "#FFD54F",
  },
  {
    id: "grants",
    name: "Gov. Grants",
    short: "Grants",
    description: "Bankruptcy stimulus payout is dramatically increased.",
    effect: (l) => {
      const values = [50, 200, 1000];
      return `$${(values[l - 1] ?? 15)} bailout`;
    },
    path: "money", row: 1,
    baseCost: 4, costGrowth: 2, maxLevel: 3,
    prereqs: [], requiredRank: "bronze", tint: "#FFD54F",
  },
  {
    id: "dividends",
    name: "Dividend Reserve",
    short: "Dividends",
    description: "Each completion pays an extra dividend tip on top of profit.",
    effect: (l) => `+${l * 3}% dividend tip`,
    path: "money", row: 2,
    baseCost: 10, costGrowth: 1.5, maxLevel: 5,
    prereqs: [{ id: "savings", level: 3 }], requiredRank: "silver", tint: "#FFD54F",
  },
  {
    id: "contracts",
    name: "Long-Term Contract",
    short: "Contract",
    description: "Unlock the Contract package — $10K stake, 5 min, +400% profit.",
    effect: () => "New package: Contract",
    path: "money", row: 3,
    baseCost: 50, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "dividends", level: 3 }], requiredRank: "gold", tint: "#FFD54F",
  },
  {
    id: "super-contract",
    name: "Legendary Contract",
    short: "Legendary",
    description: "Unlock the Legendary Contract — $100K stake, 15 min, +900% profit.",
    effect: () => "New package: Legendary",
    path: "money", row: 4,
    baseCost: 100, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "contracts", level: 1 }], requiredRank: "platinum", tint: "#FFD54F",
  },
  {
    id: "whale-mult",
    name: "Whale Handler",
    short: "Whale +50%",
    description: "Whale Vault base profit +50% (stacks with other bonuses).",
    effect: () => "Whale Vault +50%",
    path: "money", row: 5,
    baseCost: 80, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "contracts", level: 1 }], requiredRank: "diamond", tint: "#FFD54F",
  },
  {
    id: "legend-bonus",
    name: "Legendary Mastery",
    short: "Legend Master",
    description: "Legendary Contract profit doubled.",
    effect: () => "Legendary +100%",
    path: "money", row: 6,
    baseCost: 200, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "super-contract", level: 1 }], requiredRank: "legend", tint: "#FFD54F",
  },

  // ─── ENDGAME (Legend-only chain in the Money column) ──────────
  {
    id: "endgame-profit",
    name: "Ascended Trader",
    short: "Ascendant",
    description: "All investment profits tripled — the market bends to your will.",
    effect: () => "All profits ×3",
    path: "money", row: 7,
    baseCost: 800, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "legend-bonus", level: 1 }], requiredRank: "legend", tint: "#FF6EC7",
  },
  {
    id: "endgame-costs",
    name: "Financial Enlightenment",
    short: "Enlightened",
    description: "Every investment costs 50% less.",
    effect: () => "Pkg costs −50%",
    path: "money", row: 8,
    baseCost: 1200, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "endgame-profit", level: 1 }], requiredRank: "legend", tint: "#FF6EC7",
  },
  {
    id: "endgame-passive",
    name: "Infinite Yield",
    short: "Infinite Yield",
    description: "Passive income and savings interest quintupled.",
    effect: () => "Passive ×5",
    path: "money", row: 9,
    baseCost: 1500, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "endgame-costs", level: 1 }], requiredRank: "legend", tint: "#FF6EC7",
  },
  {
    id: "endgame-capstone",
    name: "The Ascendant",
    short: "The Ascendant",
    description: "All upgrade costs reduced by 75%. You have beaten the market.",
    effect: () => "Upgrade costs −75%",
    path: "money", row: 10,
    baseCost: 3000, costGrowth: 1, maxLevel: 1,
    prereqs: [{ id: "endgame-passive", level: 1 }], requiredRank: "legend", tint: "#FF6EC7",
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
      const src = SKILLS.find((s) => s.id === p.id);
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
