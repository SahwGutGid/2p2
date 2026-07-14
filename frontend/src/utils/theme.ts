export interface ThemeColors {
  // Foundation
  bg: string;
  bgSoft: string;
  panel: string;
  panelElevated: string;
  border: string;
  
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Money / Investments
  money: string;
  moneyLight: string;
  moneyDark: string;
  
  // Upgrades / Technology
  upgrade: string;
  upgradeLight: string;
  upgradeDark: string;
  
  // Prestige
  prestige: string;
  prestigeLight: string;
  prestigeDark: string;
  
  // Legacy
  legacy: string;
  legacyLight: string;
  legacyDark: string;
  
  // Status
  gain: string;
  loss: string;
  info: string;
  
  // Scroll indicators
  scrollbar: string;
  scrollbarActive: string;
  scrollbarPrestige: string;
  scrollbarLegacy: string;
  
  // Late game tiers
  billionaireBg: string;
  billionaireGold: string;
  corporateBg: string;
  corporateDark: string;
  marketBg: string;
  marketTeal: string;
  ultimateBg: string;
  ultimatePlatinum: string;
}

export const darkTheme: ThemeColors = {
  // Foundation
  bg: "#070B14",
  bgSoft: "#0F141F",
  panel: "#1A1F2E",
  panelElevated: "#242938",
  border: "rgba(255, 215, 0, 0.15)",
  
  // Text
  text: "#F8F9FA",
  textSecondary: "#D4D5D7",
  textMuted: "#9CA3AF",
  
  // Money / Investments
  money: "#00C896",
  moneyLight: "#00E6A8",
  moneyDark: "#00A878",
  
  // Upgrades / Technology
  upgrade: "#EF4444",
  upgradeLight: "#F87171",
  upgradeDark: "#DC2626",
  
  // Prestige
  prestige: "#A855F7",
  prestigeLight: "#C084FC",
  prestigeDark: "#9333EA",
  
  // Legacy - Luxury Gold Theme
  legacy: "#E6B84A",
  legacyLight: "#FFD700",
  legacyDark: "#B8860B",
  
  // Status
  gain: "#00C896",
  loss: "#EF4444",
  info: "#3B82F6",
  
  // Scroll indicators
  scrollbar: "#1F2937",
  scrollbarActive: "#E6B84A",
  scrollbarPrestige: "#A855F7",
  scrollbarLegacy: "#FFD700",
  
  // Late game tiers - Luxury Theme
  billionaireBg: "#0A0E18",
  billionaireGold: "#FFD700",
  corporateBg: "#1A1F2E",
  corporateDark: "#242938",
  marketBg: "#0F141F",
  marketTeal: "#14B8A6",
  ultimateBg: "#050508",
  ultimatePlatinum: "#E5E7EB",
};

export const getTheme = (): ThemeColors => {
  return darkTheme;
};
