import "server-only";
import type { TimeseriesPoint } from "@/lib/analytics/metrics";
import { toTimeseries } from "@/lib/analytics/metrics";
import type { RpcClient } from "@/lib/analytics/queries";
import { logServerError } from "@/lib/links/log";
import type { ActivityItem, LinkClicks, TopLink } from "./shape";
import { toActivity, toClickMap, toTopLinks, trendWindow } from "./shape";

/**
 * Phase 7: dashboard reads. Each wraps one ownership-gated aggregate function
 * (20260926100000_dashboard_aggregates.sql) and is fail-safe: a missing
 * client or a database error returns null, and the section that asked for it
 * says "couldn't load" (or leaves the number out) instead of showing a
 * made-up zero.
 */

type Rows = Array<Record<string, unknown>>;

async function call(client: RpcClient | null, fn: string, args: Record<string, unknown>): Promise<Rows | null> {
  if (!client) return null;
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      logServerError("dashboard_query_failed", error.message, { fn });
      return null;
    }
    return (data as Rows | null) ?? [];
  } catch (error) {
    logServerError("dashboard_query_failed", error, { fn });
    return null;
  }
}

/** All-time human clicks per link, for one page of rows (max 100 ids). */
export async function getLinksClicks(client: RpcClient | null, linkIds: string[]): Promise<Map<string, LinkClicks> | null> {
  const ids = linkIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
  if (ids.length === 0) return new Map();
  const rows = await call(client, "my_links_clicks", { p_link_ids: ids });
  return rows ? toClickMap(rows) : null;
}

/** Daily clicks across the account for the last TREND_DAYS days (today included). */
export async function getAccountTrend(client: RpcClient | null, now: Date = new Date()): Promise<TimeseriesPoint[] | null> {
  const { start, end } = trendWindow(now);
  const rows = await call(client, "my_account_timeseries", { p_start: start.toISOString(), p_end: end.toISOString() });
  return rows ? toTimeseries(rows) : null;
}

/** Most-clicked links over the same window as the trend. */
export async function getTopLinks(client: RpcClient | null, now: Date = new Date(), limit = 3): Promise<TopLink[] | null> {
  const { start, end } = trendWindow(now);
  const rows = await call(client, "my_top_links", { p_start: start.toISOString(), p_end: end.toISOString(), p_limit: limit });
  return rows ? toTopLinks(rows) : null;
}

export async function getRecentActivity(client: RpcClient | null, limit = 6): Promise<ActivityItem[] | null> {
  const rows = await call(client, "my_recent_activity", { p_limit: limit });
  return rows ? toActivity(rows) : null;
}

/** All-time human clicks across the account. Null when unknown (never a false 0). */
export async function getAccountClicks(client: RpcClient | null): Promise<number | null> {
  const rows = await call(client, "my_account_metrics", { p_start: null, p_end: null });
  const row = rows?.[0];
  if (!row) return null;
  const n = Number(row.human_clicks ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
