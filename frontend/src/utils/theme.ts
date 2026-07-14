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
  bg: "#0A0E17",
  bgSoft: "#121929",
  panel: "#182234",
  panelElevated: "#222D42",
  accent: "#00E5C2",
  accentDeep: "#00B89F",
  gold: "#FFC94D",
  gain: "#00FF85",
  loss: "#FF4D4D",
  info: "#5DD0F9",
  text: "#FFFFFF",
  textMuted: "#A0AAB8",
  border: "#2A3548",
};

export const getTheme = (): ThemeColors => {
  return darkTheme;
};
