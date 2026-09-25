/**
 * Date formatting for server-rendered workspace text. Dates are shown in UTC
 * with an explicit format so server and client never disagree (no hydration
 * mismatch) and the same instant always reads the same.
 */
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago", "in 2 hours", "just now". */
export function formatRelative(iso: string, now: Date): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (abs >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(Math.round(seconds / 60), "minute");
}

/** Human expiry line: "No expiry", "Expires 25 Oct 2026 (in 29 days)", "Expired 3 days ago". */
export function describeExpiry(expiresAt: string | null, now: Date): { text: string; soon: boolean; past: boolean } {
  if (!expiresAt) return { text: "No expiry", soon: false, past: false };
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return { text: `Expired ${formatRelative(expiresAt, now)}`, soon: false, past: true };
  return {
    text: `Expires ${formatDate(expiresAt)} (${formatRelative(expiresAt, now)})`,
    soon: ms <= 7 * 86400_000,
    past: false,
  };
}
