import "server-only";
import { logSecurityEvent } from "@/lib/links/log";
import { BURST, burst } from "@/lib/security/burst";

/**
 * Analytics protection: a small per-user cache in front of the aggregate
 * queries, and a throttle on the loads that actually reach the database.
 *
 * - Repeated views (refreshing, switching back and forth) are served from
 *   memory for `ttlMs`, so hammering a page doesn't re-run the all-time
 *   account scan each time. Staleness is bounded and stated in the UI
 *   ("can take up to a minute to catch up").
 * - Only cache misses count toward BURST.analytics per user. Past it, a load
 *   gets the cached copy if there is one, otherwise `throttled` and the
 *   section says to try again shortly. Nothing else on the page is affected.
 * - Failures (null) are never cached, so a blip doesn't stick.
 * - Keys always start with the user id: one user's numbers can never be
 *   served to another. Memory is bounded (oldest entries evicted).
 */

export type Guarded<T> = { data: T; throttled: false } | { data: null; throttled: boolean };

const MAX_ENTRIES = 5_000;

export function createAnalyticsGuard(now: () => number = Date.now, limiter = burst) {
  const store = new Map<string, { value: unknown; expiresAt: number }>();

  return {
    async load<T>(userId: string, key: string, ttlMs: number, fetch: () => Promise<T | null>): Promise<Guarded<T>> {
      const k = `${userId}:${key}`;
      const hit = store.get(k);
      if (hit && hit.expiresAt > now()) return { data: hit.value as T, throttled: false };

      if (!limiter.hit(`analytics:${userId}`, BURST.analytics).allowed) {
        logSecurityEvent("rate_limited", { scope: "analytics", signedIn: true });
        // Serve the last good copy past its TTL rather than nothing.
        return hit ? { data: hit.value as T, throttled: false } : { data: null, throttled: true };
      }

      const value = await fetch();
      if (value === null) return { data: null, throttled: false };
      store.delete(k);
      store.set(k, { value, expiresAt: now() + ttlMs });
      if (store.size > MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      return { data: value, throttled: false };
    },
    size: () => store.size,
  };
}

export const analyticsGuard = createAnalyticsGuard();

export const ANALYTICS_TTL = {
  account: 60_000,
  link: 30_000,
} as const;
