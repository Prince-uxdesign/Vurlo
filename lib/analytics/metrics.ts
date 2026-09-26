/**
 * Phase 6B: metric definitions + shaping helpers for Vurlo analytics.
 *
 * THE DEFINITIONS (kept in sync with supabase/migrations/20260925190000_link_analytics.sql):
 *
 * | Metric (display label)      | Definition                                            |
 * | --------------------------- | ----------------------------------------------------- |
 * | Clicks (primary)            | `human_clicks`: events with traffic_class =   |
 * |                             | 'human' (recognizable interactive browser,   |
 * |                             | no automation signal). Unclassifiable traffic|
 * |                             | (missing UA) counts toward total_requests,   |
 * |                             | never toward headline clicks.                 |
 * | Total requests              | Every recorded redirect event in range, bots incl.    |
 * | Bots / Scanners / Unknown   | traffic_class slices of total. Scanners are previews/ |
 * |                             | AV sandboxes (legitimate automation, not attacks).    |
 * | Approx. unique visitors     | count(distinct visitor_hash), nulls excluded.         |
 * |                             | APPROXIMATE -- see visitor.ts limits.                   |
 * | Breakdown %                 | Each key's share of HUMAN clicks, from real data.     |
 * | Time series                 | Per-bucket (total, human); per-bucket uniques are     |
 * |                             | deliberately NOT offered (cost + identifiability).      |
 *
 * Filtering methodology (states it plainly, per §2): the product's headline
 * "Clicks" counts likely-human traffic (is_bot = false). Bot and scanner
 * volume is reported alongside -- never silently mixed in, never silently
 * dropped. "Direct" referrer means missing/stripped referrer as often as a
 * typed URL (browsers + privacy tools strip it routinely).
 *
 * Client-safe (no `server-only`): components import the types and the
 * percentage math directly.
 */

export interface LinkMetrics {
  totalRequests: number;
  /** Primary headline number: likely-human clicks (is_bot = false). */
  clicks: number;
  bots: number;
  scanners: number;
  unknownTraffic: number;
  approxUniques: number;
  approxHumanUniques: number;
  lastClickedAt: string | null;
  /** False when there is nothing to show -- UI renders "No clicks yet." */
  hasData: boolean;
}

export interface TimeseriesPoint {
  bucketStart: string;
  total: number;
  human: number;
}

export interface BreakdownRow {
  key: string;
  total: number;
  human: number;
  /** Share of HUMAN clicks, 0-100 rounded to 1 decimal. 0 when no humans. */
  pct: number;
}

export type BreakdownDimension = "device" | "browser" | "os" | "country" | "referrer";

export const BREAKDOWN_DIMENSIONS: readonly BreakdownDimension[] = [
  "device",
  "browser",
  "os",
  "country",
  "referrer",
];

export function isBreakdownDimension(value: unknown): value is BreakdownDimension {
  return (
    typeof value === "string" &&
    (BREAKDOWN_DIMENSIONS as readonly string[]).includes(value)
  );
}

export function emptyLinkMetrics(): LinkMetrics {
  return {
    totalRequests: 0,
    clicks: 0,
    bots: 0,
    scanners: 0,
    unknownTraffic: 0,
    approxUniques: 0,
    approxHumanUniques: 0,
    lastClickedAt: null,
    hasData: false,
  };
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Timestamps arrive as ISO strings from PostgREST but as Date objects from
 * some Postgres drivers (PGlite included). Accept both; anything else is
 * treated as missing rather than fabricated.
 */
function toIsoString(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}

/** Shapes a `my_link_metrics` row. Null row = no data (not owned / empty). */
export function toLinkMetrics(row: Record<string, unknown> | null | undefined): LinkMetrics {
  if (!row) return emptyLinkMetrics();
  const totalRequests = toNumber(row.total_requests);
  const clicks = toNumber(row.human_clicks);
  return {
    totalRequests,
    clicks,
    bots: toNumber(row.bots),
    scanners: toNumber(row.scanners),
    unknownTraffic: toNumber(row.unknown_traffic),
    approxUniques: toNumber(row.approx_uniques),
    approxHumanUniques: toNumber(row.approx_human_uniques),
    lastClickedAt: toIsoString(row.last_clicked_at),
    hasData: totalRequests > 0,
  };
}

export function toTimeseries(
  rows: Array<Record<string, unknown>> | null | undefined,
): TimeseriesPoint[] {
  if (!rows) return [];
  const points: TimeseriesPoint[] = [];
  for (const r of rows) {
    const bucketStart = toIsoString(r.bucket_start);
    if (!bucketStart) continue;
    points.push({ bucketStart, total: toNumber(r.total), human: toNumber(r.human) });
  }
  return points;
}

/**
 * Attaches percentages (share of HUMAN clicks) to breakdown counts.
 * Percentages come from real data: sum(pct) ≈ 100 whenever humans > 0;
 * every row is 0 when there are no human clicks. Sorted by human desc
 * (matches SQL order) so the UI can slice a top-N + tail if a dimension
 * ever grows a long tail.
 */
export function withPercentages(
  rows: Array<{ key: string; total: number; human: number }> | null | undefined,
): BreakdownRow[] {
  if (!rows || rows.length === 0) return [];
  const base = rows.reduce((sum, r) => sum + Math.max(0, r.human), 0);
  return [...rows]
    .sort((a, b) => b.human - a.human || (a.key < b.key ? -1 : 1))
    .map((r) => ({
      key: r.key,
      total: Math.max(0, r.total),
      human: Math.max(0, r.human),
      pct: base > 0 ? Math.round((Math.max(0, r.human) / base) * 1000) / 10 : 0,
    }));
}
