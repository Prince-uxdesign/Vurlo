import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyBrowser,
  classifyDevice,
  classifyOs,
  classifyReferrer,
  classifyTraffic,
  countryFromHeaders,
  ipForHashing,
  normalizeCountry,
} from "@/lib/analytics/classify";
import { buildClickEvent } from "@/lib/analytics/record";
import { buildVisitorHash } from "@/lib/analytics/visitor";

const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0";
const EDGE_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

const headers = (init: Record<string, string> = {}) => new Headers(init);

describe("device detection (broad buckets only)", () => {
  it("buckets desktop, mobile, tablet and unknown", () => {
    assert.equal(classifyDevice(CHROME_WIN), "desktop");
    assert.equal(classifyDevice(SAFARI_IPHONE), "mobile");
    assert.equal(classifyDevice(ANDROID_CHROME), "mobile");
    assert.equal(classifyDevice(IPAD), "tablet");
    assert.equal(classifyDevice(""), "unknown");
    assert.equal(classifyDevice(null), "unknown");
    assert.equal(classifyDevice("SomeRandomAgent/1.0"), "unknown");
  });
});

describe("browser detection (broad families only)", () => {
  it("identifies the major families without version precision", () => {
    assert.equal(classifyBrowser(CHROME_WIN), "chrome");
    assert.equal(classifyBrowser(SAFARI_IPHONE), "safari");
    assert.equal(classifyBrowser(FIREFOX_MAC), "firefox");
    assert.equal(classifyBrowser(EDGE_WIN), "edge");
    assert.equal(classifyBrowser(""), "unknown");
    assert.equal(classifyBrowser(null), "unknown");
    assert.equal(classifyBrowser("curl/8.0"), "other");
  });
});

describe("OS detection (broad families only)", () => {
  it("identifies the major operating systems", () => {
    assert.equal(classifyOs(CHROME_WIN), "windows");
    assert.equal(classifyOs(SAFARI_IPHONE), "ios");
    assert.equal(classifyOs(IPAD), "ios");
    assert.equal(classifyOs(FIREFOX_MAC), "macos");
    assert.equal(classifyOs(ANDROID_CHROME), "android");
    assert.equal(
      classifyOs("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"),
      "linux",
    );
    assert.equal(classifyOs(""), "unknown");
    assert.equal(classifyOs("curl/8.0"), "other");
  });
});

describe("bot and scanner handling", () => {
  it("labels crawlers as bots, not humans and not threats", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "AhrefsBot/7.0 (+http://ahrefs.com/robot/)",
      "UptimeRobot/2.0",
    ]) {
      const r = classifyTraffic(ua);
      assert.equal(r.trafficClass, "bot", ua);
      assert.equal(r.isBot, true, ua);
    }
  });

  it("labels previews and security fetchers as scanners", () => {
    for (const ua of [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Twitterbot/1.0",
      "LinkedInBot/1.0 (compatible; Mozilla/5.0)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "Discordbot/2.0",
      "WhatsApp/2.0",
    ]) {
      const r = classifyTraffic(ua);
      assert.equal(r.trafficClass, "scanner", ua);
      assert.equal(r.isBot, true, ua);
    }
  });

  it("labels real browsers as humans", () => {
    for (const ua of [CHROME_WIN, SAFARI_IPHONE, FIREFOX_MAC, EDGE_WIN]) {
      const r = classifyTraffic(ua);
      assert.equal(r.trafficClass, "human", ua);
      assert.equal(r.isBot, false, ua);
    }
  });

  it("treats a missing user agent as unknown, never as malicious", () => {
    for (const ua of ["", "   ", null, undefined]) {
      const r = classifyTraffic(ua as unknown as string);
      assert.equal(r.trafficClass, "unknown");
      assert.equal(r.isBot, false);
    }
  });
});

describe("referrer (coarse source, never the raw URL)", () => {
  it("maps known sources and falls back honestly", () => {
    assert.equal(classifyReferrer("https://www.google.com/search?q=x"), "google");
    assert.equal(classifyReferrer("https://l.instagram.com/x"), "instagram");
    assert.equal(classifyReferrer("https://www.facebook.com/post"), "facebook");
    assert.equal(classifyReferrer("https://www.linkedin.com/feed"), "linkedin");
    assert.equal(classifyReferrer("https://example.com/page?a=b"), "other");
  });

  it("represents a missing referrer as direct, never fabricated", () => {
    assert.equal(classifyReferrer(null), "direct");
    assert.equal(classifyReferrer(""), "direct");
    assert.equal(classifyReferrer("not a url"), "direct");
  });
});

describe("country (approximate, never fabricated)", () => {
  it("accepts valid infra codes and rejects everything else", () => {
    assert.equal(normalizeCountry("us"), "US");
    assert.equal(normalizeCountry(" DE "), "DE");
    assert.equal(normalizeCountry(null), "unknown");
    assert.equal(normalizeCountry(""), "unknown");
    assert.equal(normalizeCountry("ZZ"), "unknown");
    assert.equal(normalizeCountry("USA"), "unknown");
    assert.equal(normalizeCountry("12"), "unknown");
  });

  it("reads CDN headers with Vercel preferred, missing means unknown", () => {
    assert.equal(countryFromHeaders(headers({ "x-vercel-ip-country": "fr" })), "FR");
    assert.equal(countryFromHeaders(headers({ "cf-ipcountry": "jp" })), "JP");
    assert.equal(countryFromHeaders(headers()), "unknown");
  });

  it("extracts the client IP for hashing only", () => {
    assert.equal(
      ipForHashing(headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })),
      "203.0.113.7",
    );
    assert.equal(ipForHashing(headers({ "x-real-ip": "198.51.100.9" })), "198.51.100.9");
    assert.equal(ipForHashing(headers()), null);
  });
});

describe("visitor hash (approximate uniques, privacy-preserving)", () => {
  const day = new Date("2026-03-01T12:00:00Z");
  const nextDay = new Date("2026-03-02T12:00:00Z");

  it("is stable for repeated clicks on the same day (repeated visitors)", () => {
    const a = buildVisitorHash({ ip: "203.0.113.7", userAgent: CHROME_WIN, salt: "s", now: day });
    const b = buildVisitorHash({ ip: "203.0.113.7", userAgent: CHROME_WIN, salt: "s", now: day });
    assert.ok(a && b && a === b && /^[0-9a-f]{64}$/.test(a));
  });

  it("rotates daily by design (no permanent cross-day profile)", () => {
    const a = buildVisitorHash({ ip: "203.0.113.7", userAgent: CHROME_WIN, salt: "s", now: day });
    const b = buildVisitorHash({ ip: "203.0.113.7", userAgent: CHROME_WIN, salt: "s", now: nextDay });
    assert.ok(a && b && a !== b);
  });

  it("separates distinct visitors and returns null with no signal", () => {
    const a = buildVisitorHash({ ip: "203.0.113.7", userAgent: CHROME_WIN, salt: "s", now: day });
    const b = buildVisitorHash({ ip: "203.0.113.8", userAgent: CHROME_WIN, salt: "s", now: day });
    assert.ok(a !== b);
    assert.equal(buildVisitorHash({ ip: null, userAgent: "", salt: "s", now: day }), null);
  });
});

describe("buildClickEvent (normal click assembly)", () => {
  it("assembles a lean event with no raw PII", () => {
    const event = buildClickEvent(
      headers({
        "user-agent": CHROME_WIN,
        referer: "https://www.google.com/search?q=x",
        "x-vercel-ip-country": "us",
        "x-forwarded-for": "203.0.113.7",
      }),
      { salt: "s", now: new Date("2026-03-01T12:00:00Z") },
    );
    assert.deepEqual(
      { ...event, visitor_hash: typeof event.visitor_hash },
      {
        device_type: "desktop",
        browser: "chrome",
        operating_system: "windows",
        country_code: "US",
        referrer_source: "google",
        traffic_class: "human",
        is_bot: false,
        visitor_hash: "string",
      },
    );
    assert.ok(/^[0-9a-f]{64}$/.test(event.visitor_hash!));
    assert.equal("user_agent" in event || "userAgent" in event, false);
    assert.equal("ip" in event, false);
  });

  it("degrades a fully anonymous request to unknown/direct/null", () => {
    const event = buildClickEvent(headers(), { salt: "s" });
    assert.equal(event.device_type, "unknown");
    assert.equal(event.browser, "unknown");
    assert.equal(event.country_code, "unknown");
    assert.equal(event.referrer_source, "direct");
    assert.equal(event.traffic_class, "unknown");
    assert.equal(event.visitor_hash, null);
  });
});
