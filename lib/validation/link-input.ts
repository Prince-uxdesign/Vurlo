/**
 * Link input rules shared by the marketing shortener and the server-side
 * create-link service. Client checks are for UX only: the server runs the
 * same functions again and the database constraints are the last line.
 */
import { siteConfig } from "@/config/site";
import { isReservedSlug } from "@/lib/links/reserved-slugs";
import type {
  AliasValidation,
  DestinationValidation,
  ExpirationOption,
  Validation,
} from "@/lib/links/types";

export type { ExpirationOption, UtmParams } from "@/lib/links/types";
export {
  MAX_UTM_LENGTH,
  buildTrackedUrl,
  buildTrackedUrl as applyUtm,
  findUtmConflicts,
  validateUtm,
} from "./utm";

export const expirationOptions: ReadonlyArray<{
  value: ExpirationOption;
  label: string;
}> = [
  { value: "never", label: "Never expires" },
  { value: "1d", label: "In 24 hours" },
  { value: "7d", label: "In 7 days" },
  { value: "30d", label: "In 30 days" },
];

/** MVP rule: links made without an account expire in 30 days at most. */
export const DEFAULT_EXPIRATION: ExpirationOption = "30d";
export const anonymousExpirationOptions = expirationOptions.filter(
  (option) => option.value !== "never",
);
/** Signed-in users may also keep a link forever. "Never" goes last. */
export const accountExpirationOptions = [
  ...anonymousExpirationOptions,
  ...expirationOptions.filter((option) => option.value === "never"),
];

export const MAX_DESTINATION_LENGTH = 2048;
/** Lowercase only: slugs are case-insensitive by construction. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;

const EXPIRATION_MS: Record<Exclude<ExpirationOption, "never">, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Special-use names that only resolve inside someone's own network (or
 * never): a public short link has no business sending visitors there.
 */
const PRIVATE_SUFFIXES = ["localhost", "local", "internal", "localdomain", "home.arpa", "intranet", "lan", "test", "invalid"];

/** True for IPv4 ranges that aren't publicly routable (RFC 1918, loopback, link-local, CGNAT, multicast…). */
function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && Number(m[3]) === 0) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function ownHostname(): string | null {
  try {
    return new URL(siteConfig.url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Why a parsed http(s) URL can't be a destination, or null if it can.
 * Runs on the WHATWG-normalized hostname, so `0x7f.1`, `2130706433` and
 * `127.1` have already become `127.0.0.1`, and IDNs are punycode.
 *  - Our own host (and subdomains): a short link to a short link makes
 *    loops, and chains hide the real destination from link scanners.
 *  - Private / loopback / special-use hosts: only reachable from inside a
 *    visitor's network (routers, intranets), so only useful for attacks.
 */
export function blockedDestinationReason(url: URL, own: string | null = ownHostname()): string | null {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (own && (host === own || host.endsWith(`.${own}`))) {
    return "Links can't point to another Vurlo link. Use the final destination instead.";
  }
  if (isPrivateIpv4(host) || PRIVATE_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) {
    return "That address is on a private network, so it can't be shortened.";
  }
  return null;
}

const invalidUrl = (error: string): DestinationValidation => ({
  ok: false,
  code: "invalid_destination",
  error,
});

/**
 * Accepts `example.com/page` (assumes https). Only http(s) is allowed, so
 * javascript:, data:, file:, vbscript: and similar schemes are rejected.
 * Credentials in the URL, control characters and hostnames without a dot
 * are rejected too (blocks `http://localhost`, bare hosts and phishing-style
 * `https://google.com@evil.com`).
 */
export function normalizeDestination(raw: string): DestinationValidation {
  if (typeof raw !== "string") return invalidUrl("Paste a URL to shorten.");
  const trimmed = raw.trim();
  if (!trimmed) return invalidUrl("Paste a URL to shorten.");
  if (trimmed.length > MAX_DESTINATION_LENGTH) {
    return invalidUrl(`That URL is too long. The limit is ${MAX_DESTINATION_LENGTH} characters.`);
  }
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) {
    return invalidUrl("URLs can't contain spaces or control characters.");
  }

  // Protocol-relative (`//host`), path-like (`/x`) and backslash forms are
  // ambiguous in browsers, so they are rejected rather than "fixed".
  if (trimmed.startsWith("/") || trimmed.includes("\\")) {
    return invalidUrl(
      "That doesn't look like a valid web address. Try https://example.com/page.",
    );
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const hasWebScheme = /^https?:\/\//i.test(trimmed);
  // `javascript:alert(1)` and `data:...` have a scheme but no `//`.
  // `example.com:8080/x` also matches the scheme regex; treat it as a host.
  const looksLikeHostPort = /^[a-z0-9.-]+:\d+(\/|$)/i.test(trimmed);
  if (hasScheme && !hasWebScheme && !looksLikeHostPort) {
    return invalidUrl("Only http:// and https:// links can be shortened.");
  }

  const candidate = hasWebScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return invalidUrl(
      "That doesn't look like a valid web address. Try https://example.com/page.",
    );
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return invalidUrl("Only http:// and https:// links can be shortened.");
  }
  if (url.username || url.password) {
    return invalidUrl("URLs with a username or password can't be shortened.");
  }
  // At least two non-empty labels ("example.com"; a trailing root dot is fine).
  // Rejects bare hosts, ".", "..example" and "example..com".
  if (!/^[^.]+(\.[^.]+)+\.?$/.test(url.hostname)) {
    return invalidUrl(
      "That doesn't look like a valid web address. Try https://example.com/page.",
    );
  }
  const blocked = blockedDestinationReason(url);
  if (blocked) return invalidUrl(blocked);
  return { ok: true, value: url.toString() };
}

/** Rules that apply to every slug, generated or custom. */
export function validateSlugFormat(slug: string): Validation<string> {
  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      code: "invalid_alias",
      error: "Use 3–32 lowercase letters, numbers, hyphens or underscores.",
    };
  }
  if (isReservedSlug(slug)) {
    return {
      ok: false,
      code: "reserved_alias",
      error: "That alias is reserved. Try a different one.",
    };
  }
  return { ok: true, value: slug };
}

/** Empty alias is fine (a slug is generated). Input is trimmed and lowercased. */
export function validateAlias(raw: string | undefined): AliasValidation {
  const alias = (raw ?? "").trim().toLowerCase();
  if (!alias) return { ok: true, value: undefined };
  return validateSlugFormat(alias);
}

const isExpirationOption = (value: unknown): value is ExpirationOption =>
  value === "never" || value === "1d" || value === "7d" || value === "30d";

interface ExpirationContext {
  now?: Date;
  /** Only owned links may have no expiry. Anonymous links never can. */
  allowNever?: boolean;
}

/**
 * Resolves a preset to an absolute timestamp, or null for "never".
 * Omitted input means the default: 30 days, or never for owned links.
 */
export function resolveExpiration(
  option: ExpirationOption | undefined,
  { now = new Date(), allowNever = false }: ExpirationContext = {},
): Validation<string | null> {
  const chosen = option ?? (allowNever ? "never" : DEFAULT_EXPIRATION);
  if (!isExpirationOption(chosen)) {
    return {
      ok: false,
      code: "invalid_expiration",
      error: "Choose a valid expiry option.",
    };
  }
  if (chosen === "never") {
    return allowNever
      ? { ok: true, value: null }
      : {
          ok: false,
          code: "invalid_expiration",
          error: "Links created without an account expire within 30 days.",
        };
  }
  return {
    ok: true,
    value: new Date(now.getTime() + EXPIRATION_MS[chosen]).toISOString(),
  };
}

/**
 * Last check before a redirect. Stored destinations were validated on the
 * way in and are constrained by the database, but redirects trust nothing:
 * only absolute http(s) URLs without embedded credentials are followed, and
 * never to ourselves or a private network (an owner can edit their row
 * directly through the API, which skips the app-level checks above).
 */
export function isSafeRedirectUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      url.hostname.length > 0 &&
      blockedDestinationReason(url) === null
    );
  } catch {
    return false;
  }
}

/** Validates an explicit expiry date (future, within a year). */
export function validateExpiresAt(
  raw: string,
  now: Date = new Date(),
): Validation<string> {
  const time = Date.parse(raw);
  if (Number.isNaN(time)) {
    return { ok: false, code: "invalid_expiration", error: "That expiry date isn't valid." };
  }
  if (time <= now.getTime()) {
    return { ok: false, code: "invalid_expiration", error: "The expiry date must be in the future." };
  }
  if (time > now.getTime() + 366 * 24 * 60 * 60 * 1000) {
    return { ok: false, code: "invalid_expiration", error: "Expiry can be at most one year away." };
  }
  return { ok: true, value: new Date(time).toISOString() };
}

/** True when the user typed a host without a scheme, so we will add https://. */
export function isSchemeless(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed !== "" && !/^https?:\/\//i.test(trimmed);
}
