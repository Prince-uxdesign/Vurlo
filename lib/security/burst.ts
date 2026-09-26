/**
 * In-memory burst limiter: the first, cheapest layer of rate limiting.
 *
 * Machine-speed floods (dozens of requests a second) are refused here, per
 * server instance, before any database work. That keeps an attack from
 * turning into one `rate_limits` write per request. The database limiter
 * behind it (lib/links/rate-limit.ts) is the durable, cross-instance cap for
 * slower sustained abuse; an edge rule (Vercel Firewall) can sit in front of
 * both. On serverless each instance counts on its own, which is fine for a
 * burst guard: its job is "not at machine speed", not an exact quota.
 *
 * Memory is bounded: keys expire with their window and the map is capped,
 * evicting the oldest keys first.
 */

export interface BurstRule {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

export interface BurstResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const MAX_KEYS = 10_000;

export function createBurstLimiter(now: () => number = Date.now) {
  const hits = new Map<string, number[]>();

  function prune(key: string, cutoff: number): number[] {
    const list = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length === 0) hits.delete(key);
    return list;
  }

  return {
    /** Counts one request for `key` and says whether it may proceed. */
    hit(key: string, rule: BurstRule): BurstResult {
      const t = now();
      const list = prune(key, t - rule.windowMs);
      if (list.length >= rule.limit) {
        const retry = Math.ceil((list[0]! + rule.windowMs - t) / 1000);
        hits.set(key, list);
        return { allowed: false, retryAfterSeconds: Math.max(1, retry) };
      }
      list.push(t);
      hits.delete(key); // re-insert so Map order tracks recency
      hits.set(key, list);
      if (hits.size > MAX_KEYS) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },
    size: () => hits.size,
    reset: () => hits.clear(),
  };
}

/** One limiter per server process, shared by every route. */
export const burst = createBurstLimiter();

/**
 * Burst rules. Generous enough that no person clicking and typing hits them;
 * a script firing in a loop does within a second or two.
 */
export const BURST = {
  createAnonymous: { limit: 5, windowMs: 10_000 },
  createSignedIn: { limit: 10, windowMs: 10_000 },
  aliasCheck: { limit: 10, windowMs: 10_000 },
  authAttempt: { limit: 10, windowMs: 60_000 },
  manage: { limit: 20, windowMs: 10_000 },
  analytics: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, BurstRule>;
