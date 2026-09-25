/**
 * Link input rules shared by the marketing shortener and (later) the real
 * create-link flow. The server must re-validate — these checks are for UX.
 */

export type ExpirationOption = "never" | "1d" | "7d" | "30d";

export const expirationOptions: ReadonlyArray<{
  value: ExpirationOption;
  label: string;
}> = [
  { value: "never", label: "Never expires" },
  { value: "1d", label: "In 24 hours" },
  { value: "7d", label: "In 7 days" },
  { value: "30d", label: "In 30 days" },
];

export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
}

export const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

/** Accepts `example.com/page` and assumes https; only http(s) is allowed. */
export function normalizeDestination(raw: string): Validation<string> {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Paste a URL to shorten." };

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    const isWeb = url.protocol === "http:" || url.protocol === "https:";
    if (!isWeb || !url.hostname.includes(".")) throw new Error("invalid");
    return { ok: true, value: url.toString() };
  } catch {
    return {
      ok: false,
      error: "That doesn't look like a valid web address. Try https://example.com/page.",
    };
  }
}

export function validateAlias(raw: string): Validation<string | undefined> {
  const alias = raw.trim();
  if (!alias) return { ok: true, value: undefined };
  if (!ALIAS_PATTERN.test(alias)) {
    return {
      ok: false,
      error: "Use 3–32 letters, numbers, hyphens or underscores.",
    };
  }
  return { ok: true, value: alias };
}

/** Appends any filled UTM fields to the destination. Returns it unchanged if none. */
export function applyUtm(destination: string, utm: UtmParams): string {
  const entries = Object.entries({
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
  }).filter(([, value]) => value.trim());
  if (entries.length === 0) return destination;

  const url = new URL(destination);
  for (const [key, value] of entries) url.searchParams.set(key, value.trim());
  return url.toString();
}
