export type ThemeMode = 'light' | 'dark' | 'system';

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
  text: string;
  textMuted: string;
  border: string;
}

export const lightTheme: ThemeColors = {
  bg: "#FFFFFF",
  bgSoft: "#F7F8FA",
  panel: "#FFFFFF",
  panelElevated: "#FFFFFF",
  accent: "#006B5E",
  accentDeep: "#005A4E",
  gold: "#F59E0B",
  gain: "#00A67E",
  loss: "#DC2626",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
};

export const darkTheme: ThemeColors = {
  bg: "#0F172A",
  bgSoft: "#1E293B",
  panel: "#1E293B",
  panelElevated: "#334155",
  accent: "#006B5E",
  accentDeep: "#005A4E",
  gold: "#F59E0B",
  gain: "#00A67E",
  loss: "#DC2626",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#334155",
};

export const getTheme = (mode: ThemeMode): ThemeColors => {
  if (mode === 'dark') return darkTheme;
  return lightTheme; // Default to light for now, can add system detection later
};
