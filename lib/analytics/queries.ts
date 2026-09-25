import "server-only";
import { logServerError } from "@/lib/links/log";
import {
  type AccountMetrics,
  type BreakdownDimension,
  type BreakdownRow,
  type LinkMetrics,
  type TimeseriesPoint,
  emptyAccountMetrics,
  isBreakdownDimension,
  toAccountMetrics,
  toLinkMetrics,
  toTimeseries,
  withPercentages,
} from "./metrics";
import {
  type AnalyticsPreset,
  bucketForPreset,
  parsePreset,
  resolvePresetRange,
} from "./presets";

/**
 * Phase 6B: secure query layer for analytics aggregates.
 *
 * Security: every query goes through an ownership-gated SECURITY DEFINER
 * function (`my_link_metrics`, `my_link_timeseries`, `my_link_breakdown`,
 * `my_account_metrics`). A link that isn't yours (unknown id, another user's
 * id, deleted) yields null -- never another user's numbers. No function
 * returns per-event rows or visitor hashes. All wrappers are fail-safe:
 * missing client, bad input, or a database error returns null (link scope)
 * or an intentional empty state (account scope), never an exception.
 *
 * Caching (§14): aggregates are cheap indexed queries, so the ONLY cache is
 * a small, deliberate in-process TTL cache (see `createAnalyticsCache`).
 * Documented staleness: up to `ttlMs` (default 60s). Analytics never needs
 * millisecond freshness, and caching NEVER touches the redirect hot path
 * (writes still go straight through `record_link_event`).
 */

export type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

function toIso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

async function rpc<T>(client: RpcClient, fn: string, args: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) return null;
    return data as T;
  } catch {
    return null;
  }
}

/** Link headline metrics for one preset window. Null = not yours / unavailable. */
export async function getLinkMetrics(
  linkId: string,
  presetInput: unknown,
  deps: { client: RpcClient | null; now?: Date },
): Promise<LinkMetrics | null> {
  if (!deps.client || !UUID_RE.test(linkId)) return null;
  const preset: AnalyticsPreset = parsePreset(presetInput);
  const { start, end } = resolvePresetRange(preset, deps.now);
  const data = await rpc<Array<Record<string, unknown>>>(deps.client, "my_link_metrics", {
    p_link_id: linkId,
    p_start: toIso(start),
    p_end: toIso(end),
  });
  const row = data?.[0];
  if (!row) return null; // not owned / deleted / unknown: indistinguishable by design
  return toLinkMetrics(row);
}

/** Gap-filled clicks-over-time for one preset window. Null = not yours / bad range / unavailable.
 *
 * Note: an owner always receives at least one bucket for a valid range
 * (gap-filled zeros), so an empty SQL result unambiguously means "not the
 * owner" (or an invalid range) and maps to null -- unlike breakdowns, where
 * empty legitimately means "no data".
 */
export async function getLinkTimeseries(
  linkId: string,
  presetInput: unknown,
  deps: { client: RpcClient | null; now?: Date },
): Promise<TimeseriesPoint[] | null> {
  if (!deps.client || !UUID_RE.test(linkId)) return null;
  const preset = parsePreset(presetInput);
  const { start, end } = resolvePresetRange(preset, deps.now);
  if (!start) {
    // 'all' is unbounded: chart the trailing 30d of daily buckets. Totals
    // (which still cover everything) come from getLinkMetrics.
    const fallback = resolvePresetRange("30d", deps.now);
    const data = await rpc<Array<Record<string, unknown>>>(deps.client, "my_link_timeseries", {
      p_link_id: linkId,
      p_start: toIso(fallback.start),
      p_end: toIso(fallback.end),
      p_bucket: "day",
    });
    if (!data || data.length === 0) return null;
    return toTimeseries(data);
  }
  const data = await rpc<Array<Record<string, unknown>>>(deps.client, "my_link_timeseries", {
    p_link_id: linkId,
    p_start: toIso(start),
    p_end: toIso(end),
    p_bucket: bucketForPreset(preset),
  });
  if (!data || data.length === 0) return null;
  return toTimeseries(data);
}

/**
 * Single-dimension breakdown with human-share percentages. Returns null only
 * for bad input / unavailable client / database error. An empty array means
 * "no data in range" OR "not yours" (both are zero SQL rows by design, so
 * nothing leaks); call getLinkMetrics first when the UI must tell those
 * apart -- it returns null for non-owners and a row for owners.
 */
export async function getLinkBreakdown(
  linkId: string,
  dimensionInput: unknown,
  presetInput: unknown,
  deps: { client: RpcClient | null; now?: Date },
): Promise<BreakdownRow[] | null> {
  if (!deps.client || !UUID_RE.test(linkId)) return null;
  if (!isBreakdownDimension(dimensionInput)) return null;
  const dimension: BreakdownDimension = dimensionInput;
  const { start, end } = resolvePresetRange(parsePreset(presetInput), deps.now);
  const data = await rpc<Array<Record<string, unknown>>>(deps.client, "my_link_breakdown", {
    p_link_id: linkId,
    p_dimension: dimension,
    p_start: toIso(start),
    p_end: toIso(end),
  });
  if (!data) return null;
  return withPercentages(
    data
      .filter((r) => typeof r.key === "string")
      .map((r) => ({
        key: r.key as string,
        total: Number(r.total ?? 0),
        human: Number(r.human ?? 0),
      })),
  );
}

/**
 * Account totals (User -> Links -> Events) for one preset window. Always
 * returns a state object -- empty when there is nothing or when unavailable
 * -- so the future dashboard has no null-branching at this level.
 */
export async function getAccountMetrics(
  presetInput: unknown,
  deps: { client: RpcClient | null; now?: Date },
): Promise<AccountMetrics> {
  if (!deps.client) {
    logServerError("account_metrics_unavailable", "analytics client not configured");
    return emptyAccountMetrics();
  }
  const { start, end } = resolvePresetRange(parsePreset(presetInput), deps.now);
  const data = await rpc<Array<Record<string, unknown>>>(deps.client, "my_account_metrics", {
    p_start: toIso(start),
    p_end: toIso(end),
  });
  const row = data?.[0];
  if (!row) return emptyAccountMetrics();
  return toAccountMetrics(row);
}

// ---------------------------------------------------------------------------
// Deliberate TTL cache. In-process Map (per server instance), keyed on
// (scope, user-agnostic params...). NOTE: callers must include the user id in
// the key -- this cache is shared across users in one process and must never
// serve one user's aggregates to another. `cachedAccountMetrics` style
// helpers below do this correctly; use them (or key carefully) rather than
// calling `cache.wrap` with a user-blind key.
// Default TTL 60s: dashboard numbers may lag up to a minute behind reality.
// ---------------------------------------------------------------------------

export interface AnalyticsCache {
  wrap<T>(key: string, fetch: () => Promise<T>): Promise<T>;
  invalidate(key: string): void;
  clear(): void;
  readonly ttlMs: number;
}

export function createAnalyticsCache(ttlMs = 60_000): AnalyticsCache {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    ttlMs,
    async wrap<T>(key: string, fetch: () => Promise<T>): Promise<T> {
      const hit = store.get(key);
      if (hit && hit.expiresAt > Date.now()) return hit.value as T;
      const value = await fetch();
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    },
    invalidate(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

export function linkMetricsCacheKey(
  userId: string,
  linkId: string,
  preset: AnalyticsPreset,
): string {
  return `link:${userId}:${linkId}:${preset}:metrics`;
}

/** Cached headline metrics. Pass the caller's user id -- never a shared key. */
export async function getCachedLinkMetrics(
  userId: string,
  linkId: string,
  presetInput: unknown,
  deps: { client: RpcClient | null; now?: Date; cache: AnalyticsCache },
): Promise<LinkMetrics | null> {
  const preset = parsePreset(presetInput);
  return deps.cache.wrap(linkMetricsCacheKey(userId, linkId, preset), () =>
    getLinkMetrics(linkId, preset, deps),
  );
}
