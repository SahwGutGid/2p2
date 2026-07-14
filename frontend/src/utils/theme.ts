export interface ThemeColors {
  bg: string;
  bgSoft: string;
  panel: string;
  panelElevated: string;
  accent: string;
  accentDeep: string;
  gold: string;
  gain: string;
  loss: string;
  info: string;
  text: string;
  textMuted: string;
  border: string;
}

export const darkTheme: ThemeColors = {
  bg: "#0B0F19",
  bgSoft: "#151B2B",
  panel: "#1A2332",
  panelElevated: "#242F42",
  accent: "#00D4AA",
  accentDeep: "#00A885",
  gold: "#FFB84D",
  gain: "#00E676",
  loss: "#FF5252",
  info: "#4FC3F7",
  text: "#FFFFFF",
  textMuted: "#9CA3AF",
  border: "#2D3748",
};

export const getTheme = (): ThemeColors => {
  return darkTheme;
};
