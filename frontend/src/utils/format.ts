// Centralized number formatting utilities

const UNITS = [
  { v: 1e18, s: "E" },  // Exa
  { v: 1e15, s: "Qa" }, // Quintillion
  { v: 1e12, s: "T" },  // Trillion
  { v: 1e9, s: "B" },   // Billion
  { v: 1e6, s: "M" },   // Million
  { v: 1e3, s: "K" },   // Thousand
];

/**
 * Format a number with K/M/B/T suffixes for readability
 * Examples: 1500 → "1.5K", 1500000 → "1.5M", 1500000000 → "1.5B"
 */
export function formatNumber(n: number): string {
  if (!isFinite(n)) return "∞";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  for (const u of UNITS) {
    if (abs >= u.v) {
      const value = abs / u.v;
      const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
      return `${sign}${value.toFixed(decimals)}${u.s}`;
    }
  }
  return `${sign}${Math.floor(abs)}`;
}

/**
 * Format currency with $ prefix and K/M/B/T suffixes
 * Examples: 1500 → "$1.5K", 1500000 → "$1.5M"
 */
export function formatCurrency(n: number): string {
  if (!isFinite(n)) return "$∞";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  for (const u of UNITS) {
    if (abs >= u.v) {
      const value = abs / u.v;
      const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
      return `${sign}$${value.toFixed(decimals)}${u.s}`;
    }
  }
  return `${sign}$${Math.floor(abs)}`;
}

/**
 * Format percentage with K/M/B/T suffixes for large values
 * Examples: 150 → "150%", 15000 → "15K%", 15000000 → "15M%"
 */
export function formatPercent(n: number): string {
  if (!isFinite(n)) return "∞%";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  
  // For normal percentages, just format without suffix
  if (abs < 1000) {
    return `${sign}${abs.toFixed(abs >= 100 ? 0 : 1)}%`;
  }
  
  // For large percentages, use suffixes
  for (const u of UNITS) {
    if (abs >= u.v) {
      const value = abs / u.v;
      const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
      return `${sign}${value.toFixed(decimals)}${u.s}%`;
    }
  }
  return `${sign}${Math.floor(abs)}%`;
}

/**
 * Format duration in milliseconds to human-readable time
 * Examples: 5000 → "5s", 65000 → "1m 5s", 3600000 → "1h"
 */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r === 0 ? `${m}m` : `${m}m ${r}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h}h` : `${h}h ${rm}m`;
}

/**
 * Format time in milliseconds to detailed time string
 * Examples: 5000 → "5s", 65000 → "1m 5s", 3665000 → "1h 1m 5s"
 */
export function formatTimeDetailed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/**
 * Format seconds with decimal precision for short durations
 * Examples: 500 → "0.5s", 5000 → "5s", 65000 → "1m 5s"
 */
export function formatSeconds(ms: number): string {
  if (ms >= 60000) return formatDuration(ms);
  return `${(ms / 1000).toFixed(1)}s`;
}
