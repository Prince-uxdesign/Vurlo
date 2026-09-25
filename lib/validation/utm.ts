/**
 * UTM rules for Vurlo: only utm_source, utm_medium and utm_campaign.
 *
 * Values are stored in their own columns (never baked into destination_url)
 * and added to the destination when the short link is opened, so owners can
 * see and edit them later. The client and server run the same functions.
 */
import type { UtmParams } from "@/lib/links/types";

export const UTM_KEYS = ["source", "medium", "campaign"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmValues = Record<UtmKey, string | null>;
export type UtmErrors = Partial<Record<UtmKey, string>>;
type UtmInput = Partial<UtmParams> | Partial<UtmValues>;

/** Matches the database CHECK (char_length between 1 and 100). */
export const MAX_UTM_LENGTH = 100;
/** Destination (max 2048) plus encoded UTM values; keeps the redirect's Location header sane. */
export const MAX_TRACKED_URL_LENGTH = 4096;

export const utmFields: ReadonlyArray<{
  key: UtmKey;
  param: `utm_${UtmKey}`;
  label: string;
  placeholder: string;
  help: string;
}> = [
  { key: "source", param: "utm_source", label: "Source", placeholder: "google", help: "Where the traffic comes from, like google or newsletter." },
  { key: "medium", param: "utm_medium", label: "Medium", placeholder: "cpc", help: "The kind of traffic, like cpc, email or social." },
  { key: "campaign", param: "utm_campaign", label: "Campaign", placeholder: "summer-launch", help: "The campaign or promotion name." },
];

const labelOf = (key: UtmKey) => utmFields.find((f) => f.key === key)!.label;

/**
 * Letters and numbers in any script, spaces and everyday punctuation.
 * Everything else is rejected with a message naming the character. Values
 * are percent-encoded when added to the URL, so `&` or `/` cannot break it.
 */
const ALLOWED = /^[\p{L}\p{M}\p{N} ._~+\-/:@!(),'&|*]+$/u;
const CONTROL = /[\p{Cc}\p{Cf}]/u;

type FieldCheck = { ok: true; value: string | null } | { ok: false; error: string };

export function validateUtmValue(raw: unknown): FieldCheck {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Enter text." };
  // Whitespace runs (tabs, non-breaking spaces from pasted text) become one space.
  const value = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!value) return { ok: true, value: null };

  if ([...value].length > MAX_UTM_LENGTH) {
    return { ok: false, error: `Use ${MAX_UTM_LENGTH} characters or fewer.` };
  }
  if (CONTROL.test(value)) {
    return { ok: false, error: "Remove hidden or control characters." };
  }
  if (/^utm_/i.test(value) || /[=?#]/.test(value)) {
    return { ok: false, error: "Enter just the value, like google, not utm_source=google." };
  }
  if (value.includes("%")) {
    return { ok: false, error: "Type the value as plain text. Vurlo encodes it for you." };
  }
  if (!ALLOWED.test(value)) {
    const bad = [...value].find((ch) => !ALLOWED.test(ch)) ?? "";
    return { ok: false, error: `“${bad}” can't be used here. Use letters, numbers, spaces and common punctuation.` };
  }
  return { ok: true, value };
}

export type UtmValidation =
  | { ok: true; value: UtmValues }
  | { ok: false; code: "invalid_utm"; error: string; fieldErrors: UtmErrors };

/** Validates all three fields. Empty fields become null. */
export function validateUtm(utm: UtmInput | undefined): UtmValidation {
  const value = {} as UtmValues;
  const fieldErrors: UtmErrors = {};
  for (const key of UTM_KEYS) {
    const check = validateUtmValue(utm?.[key]);
    if (check.ok) value[key] = check.value;
    else fieldErrors[key] = check.error;
  }
  const first = UTM_KEYS.find((key) => fieldErrors[key]);
  if (first) {
    return { ok: false, code: "invalid_utm", error: `${labelOf(first)}: ${fieldErrors[first]}`, fieldErrors };
  }
  return { ok: true, value };
}

const filled = (utm: UtmInput): Array<[`utm_${UtmKey}`, string]> =>
  UTM_KEYS.flatMap((key) => {
    const v = utm[key]?.trim();
    return v ? [[`utm_${key}`, v] as [`utm_${UtmKey}`, string]] : [];
  });

function paramName(pair: string): string {
  const raw = pair.split("=", 1)[0]!;
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

/**
 * The URL visitors are sent to. Deterministic rules:
 *  - a filled field replaces that utm_* parameter in place (duplicates of it
 *    are dropped), or is appended if the destination doesn't have it;
 *  - empty fields leave any existing utm_* parameter untouched;
 *  - every other parameter keeps its exact original spelling and order
 *    (the query is edited pair by pair, never re-serialized);
 *  - the fragment stays at the end; values are percent-encoded.
 * Throws only if `destination` isn't an absolute URL (callers validate first).
 */
export function buildTrackedUrl(destination: string, utm: UtmInput): string {
  const entries = filled(utm);
  if (entries.length === 0) return destination;

  const url = new URL(destination);
  const wanted = new Map<string, string>(entries);
  const written = new Set<string>();
  const encoded = (name: string) => `${name}=${encodeURIComponent(wanted.get(name)!)}`;
  const pairs: string[] = [];
  for (const pair of url.search.slice(1).split("&")) {
    if (!pair) continue;
    const name = paramName(pair);
    if (!wanted.has(name)) pairs.push(pair);
    else if (!written.has(name)) {
      // First occurrence is replaced in place; later duplicates are dropped.
      pairs.push(encoded(name));
      written.add(name);
    }
  }
  for (const name of wanted.keys()) if (!written.has(name)) pairs.push(encoded(name));
  url.search = `?${pairs.join("&")}`;
  return url.toString();
}

/** utm_* parameters (of the three supported) that filled fields will replace. */
export function findUtmConflicts(destination: string, utm: UtmInput): string[] {
  const existing = readUtm(destination);
  return filled(utm).map(([name]) => name).filter((name) => existing[name.slice(4) as UtmKey] !== undefined);
}

/** Supported utm_* values already written into a URL (first occurrence). */
export function readUtm(destination: string): Partial<Record<UtmKey, string>> {
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return {};
  }
  const found: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const v = url.searchParams.get(`utm_${key}`);
    if (v !== null) found[key] = v;
  }
  return found;
}

/** True when visitors will arrive with any supported UTM parameter. */
export function hasUtm(destination: string, utm: UtmInput): boolean {
  return filled(utm).length > 0 || Object.keys(readUtm(destination)).length > 0;
}

/** Error for the UTM section if the final URL would be too long, else undefined. */
export function trackedUrlTooLong(destination: string, utm: UtmInput): string | undefined {
  try {
    return buildTrackedUrl(destination, utm).length > MAX_TRACKED_URL_LENGTH
      ? "With these UTM values the final URL gets too long. Shorten the values or the destination."
      : undefined;
  } catch {
    return undefined;
  }
}
