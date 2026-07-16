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
  | "recession"
  | "investor_rush"
  | "business_expansion"
  | "economic_recovery"
  | "market_slowdown"
  | "economic_uncertainty";

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
  // Positive events (more common)
  { id: "bull",         name: "Bull Market 📈",       tag: "Global +25%",   description: "Optimism rules — every profit +25%.",         tint: "#00FF88", durationMs: 60000, weight: 18, profitMult: 1.25 },
  { id: "investor_rush", name: "Investor Rush 💰",     tag: "Speed +30%",    description: "Investor activity surges — investments complete 30% faster.", tint: "#FFD700", durationMs: 45000, weight: 16, durMult: 0.7 },
  { id: "tech_boom",    name: "Technology Boom 🚀",   tag: "Tech ×1.5",     description: "Technology investments surge +50%.",          tint: "#00E5FF", durationMs: 60000, weight: 15, pkgBoost: { "tech-venture": 0.5, "ai-infrastructure": 0.5 } },
  { id: "business_expansion", name: "Business Expansion 🏢", tag: "Business +40%", description: "Business financing opportunities expand.", tint: "#60A5FA", durationMs: 60000, weight: 14, pkgBoost: { "small-business": 0.4, "business-expansion": 0.4, "commercial-financing": 0.4 } },
  { id: "economic_recovery", name: "Economic Recovery 🌎", tag: "Global +15%",   description: "Global economy strengthens — all investments +15%.", tint: "#22C55E", durationMs: 90000, weight: 12, profitMult: 1.15 },
  
  // Existing positive events
  { id: "stimulus",     name: "Gov. Stimulus",     tag: "Cash Grant",    description: "A one-off cash injection lands in your account.", tint: "#FFD54F", durationMs: 30000, weight: 10, oneShotBalanceAdd: 250 },
  { id: "crypto_rally", name: "Crypto Rally",      tag: "Crypto ×2",     description: "Crypto rockets +100% profit.",                tint: "#B9F2FF", durationMs: 45000, weight: 8,  pkgBoost: { "crypto": 1.0 } },
  { id: "housing_boom", name: "Housing Boom",      tag: "Real Estate +80%", description: "Real Estate investments lead the pack.",  tint: "#FFB84D", durationMs: 60000, weight: 12, pkgBoost: { "mortgage-portfolio": 0.8, "commercial-property": 0.6, "real-estate-dev": 0.6 } },
  
  // Negative events (less common, never stop progression)
  { id: "market_slowdown", name: "Market Slowdown 📉", tag: "Efficiency -10%", description: "Market activity slows slightly — 10% less efficient.", tint: "#FF6B6B", durationMs: 45000, weight: 8, profitMult: 0.9 },
  { id: "economic_uncertainty", name: "Economic Uncertainty ⚠️", tag: "Risk -15%", description: "Uncertainty affects some investments — 15% reduced returns.", tint: "#FF8C42", durationMs: 60000, weight: 6, profitMult: 0.85 },
  
  // Existing negative events (reduced weight)
  { id: "bear",         name: "Bear Market",       tag: "Global -15%",   description: "Fear spreads — profits drop 15%.",            tint: "#FF4D4D", durationMs: 45000, weight: 5, profitMult: 0.85 },
  { id: "inflation",    name: "Inflation Spike",   tag: "Costs +15%",    description: "Everything costs 15% more.",                  tint: "#FF6EC7", durationMs: 60000, weight: 4, costMult: 1.15 },
  { id: "recession",    name: "Recession",         tag: "Slower +20%",   description: "Deals take 20% longer.",                      tint: "#FF4D4D", durationMs: 45000, weight: 3, durMult: 1.2 },
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
  totalPPEarned: number;
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
  totalPPEarned: 0,
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

// ==================== NEWS FEED ====================

export type NewsCategory = "early" | "mid" | "late" | "endgame" | "milestone";

export type NewsItem = {
  id: string;
  category: NewsCategory;
  headline: string;
  timestamp: number;
  icon: string;
};

export const NEWS_ITEMS: NewsItem[] = [
  // Early game news
  { id: "early-1", category: "early", headline: "New investors are entering the market as consumer lending continues growing.", icon: "📈", timestamp: 0 },
  { id: "early-2", category: "early", headline: "Small businesses are looking for new funding opportunities.", icon: "🏢", timestamp: 0 },
  { id: "early-3", category: "early", headline: "Beginner investors are discovering the power of diversified portfolios.", icon: "💼", timestamp: 0 },
  { id: "early-4", category: "early", headline: "Consumer credit markets show steady growth in early trading.", icon: "💳", timestamp: 0 },
  { id: "early-5", category: "early", headline: "Financial advisors recommend starting with micro-loans for new investors.", icon: "🎯", timestamp: 0 },
  
  // Mid game news
  { id: "mid-1", category: "mid", headline: "Business financing reaches record levels as companies expand.", icon: "📊", timestamp: 0 },
  { id: "mid-2", category: "mid", headline: "Real estate investments become increasingly popular among mid-tier investors.", icon: "🏠", timestamp: 0 },
  { id: "mid-3", category: "mid", headline: "Credit portfolios are attracting institutional attention.", icon: "🏦", timestamp: 0 },
  { id: "mid-4", category: "mid", headline: "Diversified loan portfolios show strong quarterly performance.", icon: "📈", timestamp: 0 },
  { id: "mid-5", category: "mid", headline: "International credit markets open new opportunities for investors.", icon: "🌍", timestamp: 0 },
  
  // Late game news
  { id: "late-1", category: "late", headline: "Global investment firms are entering new markets.", icon: "🌐", timestamp: 0 },
  { id: "late-2", category: "late", headline: "Technology and infrastructure funds reach historic highs.", icon: "🚀", timestamp: 0 },
  { id: "late-3", category: "late", headline: "Major institutions are partnering with advanced investors.", icon: "🤝", timestamp: 0 },
  { id: "late-4", category: "late", headline: "Healthcare growth funds outperform market expectations.", icon: "🏥", timestamp: 0 },
  { id: "late-5", category: "late", headline: "AI infrastructure investments drive sector-wide growth.", icon: "🤖", timestamp: 0 },
  
  // Endgame news
  { id: "endgame-1", category: "endgame", headline: "Your investment company has become a major global financial player.", icon: "🏆", timestamp: 0 },
  { id: "endgame-2", category: "endgame", headline: "Legacy investors are shaping the future of the financial world.", icon: "👑", timestamp: 0 },
  { id: "endgame-3", category: "endgame", headline: "The next generation of investors follows your success.", icon: "🌟", timestamp: 0 },
  { id: "endgame-4", category: "endgame", headline: "Global investment networks recognize your market dominance.", icon: "🌎", timestamp: 0 },
  { id: "endgame-5", category: "endgame", headline: "Premium P2P investments set new industry standards.", icon: "💎", timestamp: 0 },
  
  // Milestone news
  { id: "milestone-1", category: "milestone", headline: "First prestige achieved! Welcome to the silver tier.", icon: "⭐", timestamp: 0 },
  { id: "milestone-2", category: "milestone", headline: "Business financing unlocked! New opportunities await.", icon: "🔓", timestamp: 0 },
  { id: "milestone-3", category: "milestone", headline: "Legacy system unlocked! Endgame progression begins.", icon: "🎖️", timestamp: 0 },
  { id: "milestone-4", category: "milestone", headline: "Premium P2P access granted! Ultimate investments available.", icon: "💰", timestamp: 0 },
];

export const getNewsForProgression = (totalPrestiges: number, unlockedCategories: string[], hasLegacy: boolean): NewsItem[] => {
  const news: NewsItem[] = [];
  
  // Determine progression stage
  let stage: NewsCategory = "early";
  if (totalPrestiges >= 50) stage = "late";
  else if (totalPrestiges >= 8) stage = "mid";
  else if (hasLegacy) stage = "endgame";
  
  // Add news based on stage
  news.push(...NEWS_ITEMS.filter(n => n.category === stage));
  
  // Add milestone news based on unlocks
  if (unlockedCategories.includes("business")) {
    news.push(NEWS_ITEMS.find(n => n.id === "milestone-2")!);
  }
  if (hasLegacy) {
    news.push(NEWS_ITEMS.find(n => n.id === "milestone-3")!);
  }
  if (unlockedCategories.includes("premium")) {
    news.push(NEWS_ITEMS.find(n => n.id === "milestone-4")!);
  }
  
  // Add timestamps
  return news.map(n => ({ ...n, timestamp: Date.now() }));
};

export const NEWS_ROTATION_INTERVAL_MS = 8000; // Rotate news every 8 seconds

// ==================== LEADERBOARDS ====================

export type LeaderboardCategory = "money" | "playtime" | "prestige" | "legacy";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  value: number;
  isPlayer: boolean;
};

export type LeaderboardData = {
  category: LeaderboardCategory;
  entries: LeaderboardEntry[];
  playerRank: number;
  lastUpdated: number;
};

// Real leaderboard structure (in production, this would come from a backend)
// For now, returns empty leaderboard ready for real player data
export const getLeaderboard = (category: LeaderboardCategory, playerValue: number): LeaderboardData => {
  // In production, this would fetch real data from a backend
  // For now, return empty leaderboard with player's position
  return {
    category,
    entries: [], // No fake players - will populate with real data when backend is connected
    playerRank: 1, // Player is rank 1 when no other players exist
    lastUpdated: Date.now(),
  };
};

export const LEADERBOARD_CATEGORIES: { id: LeaderboardCategory; name: string; icon: string }[] = [
  { id: "money", name: "Total Money", icon: "💰" },
  { id: "playtime", name: "Play Time", icon: "⏱️" },
  { id: "prestige", name: "Prestige Points", icon: "⭐" },
  { id: "legacy", name: "Legacy Points", icon: "🏆" },
];

export const LEADERBOARD_REFRESH_INTERVAL_MS = 30000; // Refresh every 30 seconds
