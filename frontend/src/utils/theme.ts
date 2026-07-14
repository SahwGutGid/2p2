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
  bg: "#071426",
  bgSoft: "#12243D",
  panel: "#183152",
  panelElevated: "#1E3A5F",
  border: "rgba(255, 255, 255, 0.08)",
  
  // Text
  text: "#FFFFFF",
  textSecondary: "#B8C7D9",
  textMuted: "#718096",
  
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
  
  // Legacy
  legacy: "#F59E0B",
  legacyLight: "#FBBF24",
  legacyDark: "#FFD700",
  
  // Status
  gain: "#00C896",
  loss: "#EF4444",
  info: "#3B82F6",
  
  // Scroll indicators
  scrollbar: "#334155",
  scrollbarActive: "#3B82F6",
  scrollbarPrestige: "#A855F7",
  scrollbarLegacy: "#FBBF24",
  
  // Late game tiers
  billionaireBg: "#0A192F",
  billionaireGold: "#FFD700",
  corporateBg: "#7F1D1D",
  corporateDark: "#991B1B",
  marketBg: "#134E4A",
  marketTeal: "#14B8A6",
  ultimateBg: "#09090B",
  ultimatePlatinum: "#E5E7EB",
};

export const getTheme = (): ThemeColors => {
  return darkTheme;
};
