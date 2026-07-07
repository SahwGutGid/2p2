// Market events, achievements, and statistics scaffolding.
// Definitions only — integration lives in app/index.tsx.

// ==================== MARKET EVENTS ====================

export type MarketEventId =
  | "bull"
  | "bear"
  | "tech_boom"
  | "housing_boom"
  | "stimulus"
  | "inflation"
  | "crypto_rally"
  | "recession";

export type MarketEvent = {
  id: MarketEventId;
  name: string;
  tag: string;
  description: string;
  tint: string;
  durationMs: number;
  weight: number; // roll weight
  // effect selectors — applied at pkg level or globally
  profitMult?: number;       // global profit multiplier
  costMult?: number;         // global cost multiplier
  durMult?: number;          // global duration multiplier
  pkgBoost?: Partial<Record<string, number>>; // per-pkg extra multiplier
  oneShotBalanceAdd?: number; // e.g. Stimulus grant on start
};

export const MARKET_EVENTS: MarketEvent[] = [
  { id: "bull",         name: "Bull Market",       tag: "Global +25%",   description: "Optimism rules — every profit +25%.",         tint: "#00FF88", durationMs: 60000, weight: 20, profitMult: 1.25 },
  { id: "bear",         name: "Bear Market",       tag: "Global -15%",   description: "Fear spreads — profits drop 15%.",            tint: "#FF4D4D", durationMs: 45000, weight: 15, profitMult: 0.85 },
  { id: "tech_boom",    name: "Tech Boom",         tag: "Growth ×1.6",   description: "Growth Fund and Crypto surge +60%.",          tint: "#00E5FF", durationMs: 60000, weight: 14, pkgBoost: { growth: 0.6, crypto: 0.6 } },
  { id: "housing_boom", name: "Housing Boom",      tag: "Real Estate +80%", description: "Real Estate and Momentum lead the pack.",  tint: "#FFB84D", durationMs: 60000, weight: 14, pkgBoost: { realestate: 0.8, momentum: 0.5 } },
  { id: "stimulus",     name: "Gov. Stimulus",     tag: "Cash Grant",    description: "A one-off cash injection lands in your account.", tint: "#FFD54F", durationMs: 30000, weight: 12, oneShotBalanceAdd: 250 },
  { id: "inflation",    name: "Inflation Spike",   tag: "Costs +15%",    description: "Everything costs 15% more.",                  tint: "#FF6EC7", durationMs: 60000, weight: 10, costMult: 1.15 },
  { id: "crypto_rally", name: "Crypto Rally",      tag: "Crypto ×2",     description: "Crypto rockets +100% profit.",                tint: "#B9F2FF", durationMs: 45000, weight: 8,  pkgBoost: { crypto: 1.0 } },
  { id: "recession",    name: "Recession",         tag: "Slower +20%",   description: "Deals take 20% longer.",                      tint: "#FF4D4D", durationMs: 45000, weight: 7,  durMult: 1.2 },
];

const TOTAL_WEIGHT = MARKET_EVENTS.reduce((a, e) => a + e.weight, 0);

export const rollMarketEvent = (): MarketEvent => {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const e of MARKET_EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return MARKET_EVENTS[0];
};

export type ActiveMarketEvent = {
  id: MarketEventId;
  startedAt: number;
  endsAt: number;
};

export const MARKET_ROLL_INTERVAL_MS = 60000; // roll every ~60s
export const MARKET_ROLL_CHANCE = 0.5;        // 50% chance per roll

// ==================== STATISTICS ====================

export type Stats = {
  totalMoneyEarned: number;
  highestBalance: number;
  investmentsCompleted: number;
  biggestSingleProfit: number;
  activePlayTimeMs: number;
  offlineEarnings: number;
  totalPrestiges: number;
  upgradesPurchased: number;
  marketEventsSeen: number;
  accelerateUses: number;
};

export const defaultStats = (): Stats => ({
  totalMoneyEarned: 0,
  highestBalance: 100,
  investmentsCompleted: 0,
  biggestSingleProfit: 0,
  activePlayTimeMs: 0,
  offlineEarnings: 0,
  totalPrestiges: 0,
  upgradesPurchased: 0,
  marketEventsSeen: 0,
  accelerateUses: 0,
});

// ==================== ACHIEVEMENTS ====================

export type AchievementId =
  | "first_step" | "growth_spurt" | "portfolio_hero" | "millionaire" | "billionaire"
  | "first_prestige" | "silver_star" | "gold_star" | "diamond_star"
  | "twenty_upgrades" | "hundred_upgrades"
  | "hundred_invests" | "thousand_invests"
  | "veteran"
  | "market_watcher" | "market_master"
  | "speed_demon" | "accelerator"
  | "secret_bankrun" | "secret_speedrun";

export type Achievement = {
  id: AchievementId;
  name: string;
  description: string;
  hidden?: boolean;
  reward: { type: "money" | "pp" | "none"; amount: number };
  test: (stats: Stats, ctx: { balance: number; totalPrestiges: number; prestige: number }) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_step",      name: "First Step",       description: "Complete your first investment.",           reward: { type: "money", amount: 20 },    test: (s) => s.investmentsCompleted >= 1 },
  { id: "growth_spurt",    name: "Growth Spurt",     description: "Reach $1,000 balance.",                     reward: { type: "money", amount: 100 },   test: (_, c) => c.balance >= 1000 },
  { id: "portfolio_hero",  name: "Portfolio Hero",   description: "Reach $10,000 balance.",                    reward: { type: "money", amount: 500 },   test: (_, c) => c.balance >= 10000 },
  { id: "millionaire",     name: "Millionaire",      description: "Reach $1M balance.",                        reward: { type: "pp", amount: 5 },        test: (_, c) => c.balance >= 1e6 },
  { id: "billionaire",     name: "Billionaire",      description: "Reach $1B balance.",                        reward: { type: "pp", amount: 25 },       test: (_, c) => c.balance >= 1e9 },
  { id: "first_prestige",  name: "First Prestige",   description: "Cash out for the first time.",             reward: { type: "money", amount: 500 },   test: (_, c) => c.totalPrestiges >= 1 },
  { id: "silver_star",     name: "Silver Star",      description: "Reach Silver rank.",                        reward: { type: "pp", amount: 3 },        test: (_, c) => c.totalPrestiges >= 3 },
  { id: "gold_star",       name: "Gold Star",        description: "Reach Gold rank.",                          reward: { type: "pp", amount: 10 },       test: (_, c) => c.totalPrestiges >= 8 },
  { id: "diamond_star",    name: "Diamond Star",     description: "Reach Diamond rank.",                       reward: { type: "pp", amount: 50 },       test: (_, c) => c.totalPrestiges >= 50 },
  { id: "twenty_upgrades", name: "Serial Investor",  description: "Purchase 20 upgrades total.",              reward: { type: "money", amount: 200 },   test: (s) => s.upgradesPurchased >= 20 },
  { id: "hundred_upgrades",name: "Upgrade Addict",   description: "Purchase 100 upgrades total.",             reward: { type: "pp", amount: 8 },        test: (s) => s.upgradesPurchased >= 100 },
  { id: "hundred_invests", name: "Deal Maker",       description: "Complete 100 investments.",                 reward: { type: "money", amount: 500 },   test: (s) => s.investmentsCompleted >= 100 },
  { id: "thousand_invests",name: "Deal Legend",      description: "Complete 1,000 investments.",              reward: { type: "pp", amount: 10 },       test: (s) => s.investmentsCompleted >= 1000 },
  { id: "veteran",         name: "Veteran Trader",   description: "Play for 1 hour of active time.",           reward: { type: "pp", amount: 5 },        test: (s) => s.activePlayTimeMs >= 3600000 },
  { id: "market_watcher",  name: "Market Watcher",   description: "Experience 10 market events.",              reward: { type: "money", amount: 250 },   test: (s) => s.marketEventsSeen >= 10 },
  { id: "market_master",   name: "Market Master",    description: "Experience 100 market events.",             reward: { type: "pp", amount: 8 },        test: (s) => s.marketEventsSeen >= 100 },
  { id: "speed_demon",     name: "Speed Demon",      description: "Use Accelerate 100 times.",                 reward: { type: "money", amount: 250 },   test: (s) => s.accelerateUses >= 100 },
  { id: "accelerator",     name: "Accelerator",      description: "Use Accelerate 1,000 times.",              reward: { type: "pp", amount: 5 },        test: (s) => s.accelerateUses >= 1000 },
  { id: "secret_bankrun",  name: "Bank Run",         description: "Trigger the stimulus bailout.",             hidden: true, reward: { type: "money", amount: 50 }, test: () => false }, // manually granted
  { id: "secret_speedrun", name: "Speed Prestige",   description: "First prestige within 5 minutes.",         hidden: true, reward: { type: "pp", amount: 5 },     test: () => false }, // manually granted
];

export const achievementById = (id: AchievementId) => ACHIEVEMENTS.find((a) => a.id === id);
