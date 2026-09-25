/**
 * Link input rules shared by the marketing shortener and the server-side
 * create-link service. Client checks are for UX only: the server runs the
 * same functions again and the database constraints are the last line.
 */
import { isReservedSlug } from "@/lib/links/reserved-slugs";
import type {
  AliasValidation,
  DestinationValidation,
  ExpirationOption,
  UtmParams,
  Validation,
} from "@/lib/links/types";

export type { ExpirationOption, UtmParams } from "@/lib/links/types";

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
export const MAX_UTM_LENGTH = 100;
/** Lowercase only: slugs are case-insensitive by construction. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;
const UTM_VALUE_PATTERN = /^[A-Za-z0-9._~+\-\s]+$/;

const EXPIRATION_MS: Record<Exclude<ExpirationOption, "never">, number> = {
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

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
  if (!url.hostname.includes(".")) {
    return invalidUrl(
      "That doesn't look like a valid web address. Try https://example.com/page.",
    );
  }
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
 * only absolute http(s) URLs without embedded credentials are followed.
 */
export function isSafeRedirectUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      url.hostname.length > 0
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

/** Trims each value; empty becomes null. Rejects over-long or unusual values. */
export function validateUtm(
  utm: Partial<UtmParams> | undefined,
): Validation<{ source: string | null; medium: string | null; campaign: string | null }> {
  const clean = (value: unknown): string | null | undefined => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > MAX_UTM_LENGTH || !UTM_VALUE_PATTERN.test(trimmed)) {
      return undefined;
    }
    return trimmed;
  };

  const source = clean(utm?.source);
  const medium = clean(utm?.medium);
  const campaign = clean(utm?.campaign);
  if (source === undefined || medium === undefined || campaign === undefined) {
    return {
      ok: false,
      code: "invalid_utm",
      error: `UTM values can use letters, numbers, spaces and . _ ~ + - (max ${MAX_UTM_LENGTH} characters).`,
    };
  }
  return { ok: true, value: { source, medium, campaign } };
}

/** True when the user typed a host without a scheme, so we will add https://. */
export function isSchemeless(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed !== "" && !/^https?:\/\//i.test(trimmed);
}

/**
 * UTM behavior, deliberately: a filled form field replaces the same
 * `utm_*` parameter already in the destination; every other query parameter
 * (including other existing utm_* params) is left untouched. Returns the
 * names that will be replaced so the UI can say so before submitting.
 */
export function findUtmConflicts(
  destination: string,
  utm: Partial<UtmParams>,
): string[] {
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return [];
  }
  return (["source", "medium", "campaign"] as const)
    .filter((key) => utm[key]?.trim() && url.searchParams.has(`utm_${key}`))
    .map((key) => `utm_${key}`);
}

/** Appends any filled UTM fields to the destination. Returns it unchanged if none. */
export function applyUtm(
  destination: string,
  utm: Partial<UtmParams> | { source: string | null; medium: string | null; campaign: string | null },
): string {
  const entries = Object.entries({
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
  }).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
  if (entries.length === 0) return destination;

  const url = new URL(destination);
  for (const [key, value] of entries) url.searchParams.set(key, value.trim());
  return url.toString();
}
