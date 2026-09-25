/**
 * Phase 6A: coarse, honest request classification for click analytics.
 *
 * Design rules:
 * - Broad categories only. No hardware fingerprinting, no browser-version
 *   tracking, no raw user-agent or referrer-URL storage.
 * - Missing data is 'unknown' (or 'direct' for referrer). We never fabricate
 *   a device, country or source.
 * - Bot handling distinguishes likely-human / likely-bot / likely-scanner
 *   (previews, AV sandboxes, unfurlers). Scanners are automated but NOT
 *   treated as malicious -- they are labelled, not discarded.
 * - Privacy tools, VPNs, prefetchers and stripped headers all degrade
 *   gracefully to 'unknown' rather than a wrong confident answer.
 */

export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export type BrowserFamily = "chrome" | "safari" | "firefox" | "edge" | "other" | "unknown";
export type OperatingSystem =
  | "windows"
  | "macos"
  | "ios"
  | "android"
  | "linux"
  | "other"
  | "unknown";
export type TrafficClass = "human" | "bot" | "scanner" | "unknown";

/** Broad device bucket. Modern iPadOS reports "Macintosh ... Mobile". */
export function classifyDevice(userAgent: string | null | undefined): DeviceType {
  if (!userAgent || !userAgent.trim()) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad")) return "tablet";
  if (
    ua.includes("mobi") ||
    ua.includes("iphone") ||
    ua.includes("ipod") ||
    ua.includes("phone") ||
    /android.*mobile/.test(ua)
  ) {
    return "mobile";
  }
  if (
    ua.includes("tablet") ||
    ua.includes("kindle") ||
    ua.includes("silk") ||
    ua.includes("playbook") ||
    (ua.includes("android") && !ua.includes("mobile"))
  ) {
    return "tablet";
  }
  if (
    ua.includes("windows") ||
    ua.includes("macintosh") ||
    ua.includes("cros") ||
    ua.includes("linux") ||
    ua.includes("x11")
  ) {
    return "desktop";
  }
  return "unknown";
}

/** Broad browser family. Order matters: Edge and Chrome UAs contain "safari". */
export function classifyBrowser(userAgent: string | null | undefined): BrowserFamily {
  if (!userAgent || !userAgent.trim()) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/") || ua.includes("edga/") || ua.includes("edgios/") || ua.includes("edge/")) {
    return "edge";
  }
  if (ua.includes("firefox/") || ua.includes("fxios/")) return "firefox";
  if (ua.includes("chrome/") || ua.includes("crios/") || ua.includes("chromium/")) return "chrome";
  if (ua.includes("safari/")) return "safari";
  return "other";
}

/** Broad OS bucket. iPadOS 13+ desktop-mode ("Macintosh" + "Mobile") => iOS. */
export function classifyOs(userAgent: string | null | undefined): OperatingSystem {
  if (!userAgent || !userAgent.trim()) return "unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  if (ua.includes("android")) return "android";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("macintosh") || ua.includes("mac os")) {
    return ua.includes("mobile") ? "ios" : "macos";
  }
  if (ua.includes("cros") || ua.includes("linux") || ua.includes("x11")) return "linux";
  return "other";
}

// Link-preview / unfurler / messaging-preview fetchers. Automated, but
// legitimate: a shared link SHOULD trigger these. Labelled 'scanner'.
const SCANNER_SIGNALS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "skypeuripreview",
  "viber",
  "line-",
  "imessage",
  "pinterestbot",
  "redditbot",
  "embedly",
  "iframely",
  "unfurl",
  "preview",
];

// Crawlers, security scanners, monitors, AI fetchers. Labelled 'bot'.
const BOT_SIGNALS = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "mediapartners-google",
  "baidu",
  "yandex",
  "sogou",
  "exabot",
  "semrush",
  "ahrefs",
  "mj12",
  "dotbot",
  "petal",
  "bytespider",
  "gptbot",
  "ccbot",
  "anthropic",
  "applebot",
  "archive",
  "monitor",
  "uptime",
  "pingdom",
  "newrelic",
  "datadog",
  "statuscake",
  "healthcheck",
  "headless",
  "phantomjs",
  "selenium",
  "webdriver",
  "prerender",
  "prefetch",
];

/**
 * Automated-traffic classification.
 *
 * - 'scanner': social/messaging previews, unfurlers, AV sandboxes. Expected
 *   side effect of sharing a link; never treated as an attack.
 * - 'bot': crawlers, monitors, AI fetchers, headless automation.
 * - 'human': a recognizable interactive browser UA with no automation signal.
 * - 'unknown': missing or unrecognizable UA. NOT assumed malicious.
 *
 * `isBot` is true for BOTH bot and scanner traffic so "likely humans" is a
 * single cheap predicate (`is_bot = false`, matching the partial index).
 */
export function classifyTraffic(
  userAgent: string | null | undefined,
): { trafficClass: TrafficClass; isBot: boolean } {
  if (!userAgent || !userAgent.trim()) return { trafficClass: "unknown", isBot: false };
  const ua = userAgent.toLowerCase();
  if (SCANNER_SIGNALS.some((s) => ua.includes(s))) return { trafficClass: "scanner", isBot: true };
  if (BOT_SIGNALS.some((s) => ua.includes(s))) return { trafficClass: "bot", isBot: true };
  const browser = classifyBrowser(userAgent);
  if (browser === "chrome" || browser === "safari" || browser === "firefox" || browser === "edge") {
    return { trafficClass: "human", isBot: false };
  }
  return { trafficClass: "unknown", isBot: false };
}

const REFERRER_MAP: Array<[RegExp, string]> = [
  [/google\./, "google"],
  [/bing\./, "bing"],
  [/duckduckgo\./, "duckduckgo"],
  [/yahoo\./, "yahoo"],
  [/(^|\.)facebook\.|^fb\./, "facebook"],
  [/instagram\./, "instagram"],
  [/tiktok\./, "tiktok"],
  [/twitter\.|x\.com/, "twitter"],
  [/linkedin\./, "linkedin"],
  [/youtube\.|youtu\.be/, "youtube"],
  [/reddit\./, "reddit"],
  [/github\./, "github"],
  [/pinterest\./, "pinterest"],
];

/**
 * Coarse acquisition source. The raw Referer URL is NEVER stored (it can
 * carry query-string PII and is routinely stripped by browsers / privacy
 * tools). Missing, empty or unparseable referrer => 'direct', which display
 * layers should render as "Direct / Unknown".
 */
export function classifyReferrer(referrer: string | null | undefined): string {
  if (!referrer || !referrer.trim()) return "direct";
  let host = "";
  try {
    host = new URL(referrer.trim()).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (!host) return "direct";
  for (const [pattern, source] of REFERRER_MAP) {
    if (pattern.test(host)) return source;
  }
  return "other";
}

/**
 * Approximate country from infrastructure metadata (e.g. Vercel
 * `x-vercel-ip-country`, Cloudflare `cf-ipcountry`). Accepts an already-
 * extracted header value. Anything absent or malformed => 'unknown'.
 * 'ZZ' (the "unknown" placeholder some CDNs emit) folds to 'unknown'.
 * Never geolocate from a stored IP: raw IPs are never retained.
 */
export function normalizeCountry(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const code = raw.trim().toUpperCase();
  if (code === "ZZ") return "unknown";
  return /^[A-Z]{2}$/.test(code) ? code : "unknown";
}

/** Country lookup across the headers CDNs actually set. First hit wins. */
export function countryFromHeaders(headers: Headers): string {
  const candidates = [
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
    headers.get("x-country-code"),
  ];
  for (const c of candidates) {
    if (c && c.trim()) return normalizeCountry(c);
  }
  return "unknown";
}

/**
 * Client IP for hashing ONLY. Takes the leftmost entry of X-Forwarded-For,
 * falling back to X-Real-IP. The value is never stored -- it is mixed into
 * the day-bucketed visitor hash and then dropped (see visitor.ts).
 */
export function ipForHashing(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  return null;
}
