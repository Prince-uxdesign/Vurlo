/**
 * Phase 6C: display labels for analytics dimensions.
 *
 * Client-safe (no `server-only`): the dashboard renders these directly.
 * Labels are honest by construction -- "Direct / Unknown" never claims a
 * typed URL, "Unknown" never fabricates a device, and unlisted codes fall
 * back to a readable form of the stored value (never blank, never invented).
 */

import type { BreakdownDimension } from "./metrics";

const REFERRER_LABELS: Record<string, string> = {
  direct: "Direct / Unknown",
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  yahoo: "Yahoo",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X (Twitter)",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  reddit: "Reddit",
  github: "GitHub",
  pinterest: "Pinterest",
  other: "Other",
};

/** Capitalized stored value for anything not in the known map. */
function fallback(key: string): string {
  if (!key) return "Unknown";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function referrerLabel(key: string): string {
  return REFERRER_LABELS[key] ?? fallback(key);
}

const SIMPLE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  windows: "Windows",
  macos: "macOS",
  ios: "iOS",
  android: "Android",
  linux: "Linux",
  other: "Other",
  unknown: "Unknown",
  human: "Human",
  bot: "Bot",
  scanner: "Scanner",
  direct: "Direct / Unknown",
};

export function dimensionLabel(dimension: BreakdownDimension, key: string): string {
  if (dimension === "referrer") return referrerLabel(key);
  if (dimension === "country") return countryLabel(key);
  return SIMPLE_LABELS[key] ?? fallback(key);
}

let regionNames: Intl.DisplayNames | null | undefined;
/** "US" -> "United States". Unknown/invalid codes stay as the stored code. */
export function countryLabel(code: string): string {
  if (code === "unknown" || !/^[A-Z]{2}$/.test(code)) return "Unknown";
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    // DisplayNames returns the code unchanged (no throw) for unassigned
    // codes like "XX" -- treat that as unknown rather than showing "XX".
    const name = regionNames.of(code);
    return name && name !== code ? name : "Unknown";
  } catch {
    return code;
  }
}

export const DIMENSION_TITLES: Record<BreakdownDimension, { title: string; hint: string }> = {
  device: { title: "Devices", hint: "Phone, computer, or tablet used for the visit." },
  browser: { title: "Browsers", hint: "App used to open the link." },
  os: { title: "Operating systems", hint: "System the visit came from." },
  country: { title: "Countries", hint: "Approximate, from network data. VPNs blur this." },
  referrer: {
    title: "Referrers",
    hint: "Where visits came from. “Direct / Unknown” includes typed links and apps that hide it.",
  },
};

/** Compact counts: 1,240 not 1240; 1.2M for the far future. */
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

export function formatCount(n: number): string {
  return n < 1000 ? full.format(n) : compact.format(n);
}

/** "12:00" for hourly buckets, "25 Sep" for daily ones (UTC, stable server/client). */
export function formatBucketTick(iso: string, bucket: "hour" | "day"): string {
  const d = new Date(iso);
  if (bucket === "hour") return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
  return `${d.getUTCDate()} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`;
}

/** "25 Sep, 14:00" -- used in tooltips and accessible descriptions. */
export function formatBucketFull(iso: string, bucket: "hour" | "day"): string {
  const d = new Date(iso);
  const day = `${d.getUTCDate()} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })}`;
  return bucket === "hour"
    ? `${day}, ${String(d.getUTCHours()).padStart(2, "0")}:00`
    : day;
}
