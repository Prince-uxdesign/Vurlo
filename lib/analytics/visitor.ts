import { createHash } from "node:crypto";
import { serverSalt } from "@/lib/utils/secrets";

/**
 * Phase 6A: privacy-preserving, APPROXIMATE unique-visitor signal.
 *
 * What it is:
 *   visitor_hash = SHA-256( salt | client-ip | normalized-UA | utc-day )
 *   stored as 64 lowercase hex characters, or null when the request carried
 *   nothing usable (no IP and no UA).
 *
 * Why this shape:
 * - Data minimization: the raw IP is mixed into the hash and then dropped.
 *   No table ever holds it, so a database leak cannot expose who clicked what.
 * - Day bucketing: the same visitor produces a DIFFERENT hash tomorrow. This
 *   deliberately prevents building a permanent cross-day profile of a person
 *   from analytics data. "Uniques" are meaningful only inside a short window.
 * - Salted: rainbow tables over (ip, ua, day) don't work without the server
 *   secret (ANALYTICS_SALT, falling back to RATE_LIMIT_SALT).
 *
 * What it is NOT (document these limits wherever uniques are shown):
 * - NOT "exactly N individual people". VPNs, CGNAT, office egress IPs and
 *   iCloud Private Relay make many people share one IP; one person with a
 *   phone + laptop + work VPN looks like three visitors.
 * - NOT stable across days, by design (see above).
 * - NOT resistant to bot farms: many bots share datacenter IPs and identical
 *   UAs, so they can collapse into one hash OR spray thousands of them.
 *   Always pair uniques with the traffic_class breakdown.
 * - NOT a tracking cookie: no persistent identifier is set on the visitor,
 *   no fingerprint beyond (IP, UA-day) is attempted, and there is nothing to
 *   opt out of because nothing follows the user.
 */

export function visitorDayBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // UTC yyyy-mm-dd
}

/** Lowercase + collapsed whitespace so trivial UA variations don't split uniques. */
export function normalizeUaForHash(userAgent: string | null | undefined): string {
  return (userAgent ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 512);
}

interface VisitorHashInput {
  ip: string | null | undefined;
  userAgent: string | null | undefined;
  salt: string;
  now?: Date;
}

/**
 * Returns 64-char hex, or null when there is no usable signal at all.
 * Pure + synchronous so it is trivially unit-testable.
 */
export function buildVisitorHash({ ip, userAgent, salt, now = new Date() }: VisitorHashInput): string | null {
  const cleanIp = (ip ?? "").trim();
  const ua = normalizeUaForHash(userAgent);
  if (!cleanIp && !ua) return null;
  return createHash("sha256")
    .update(`${salt}|${cleanIp}|${ua}|${visitorDayBucket(now)}`, "utf8")
    .digest("hex");
}

/**
 * Server-only salt. A distinct analytics salt is preferred; the rate-limit
 * salt works as a fallback. Never a public value in production (see
 * lib/utils/secrets.ts).
 */
export function getAnalyticsSalt(): string {
  return serverSalt("ANALYTICS_SALT", process.env.RATE_LIMIT_SALT);
}
