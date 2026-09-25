/**
 * Phase 6B: MVP time-range presets for analytics.
 *
 * The dashboard will eventually offer 24 hours / 7 days / 30 days / all
 * time. This module maps those presets onto concrete (start, end) bounds for
 * the SQL aggregation functions. No arbitrary date-range complexity: four
 * presets, two bucket sizes.
 *
 * Bucket policy (keeps payloads chart-sized at every viewport, 320px phones
 * included -- see §17):
 *   24h -> hourly (24 buckets)
 *   7d  -> daily  (7 buckets)
 *   30d -> daily  (30 buckets)
 *   all -> daily  (capped at 370 buckets by SQL; older history still counts
 *          in the totals, only the series is windowed)
 *
 * Ranges are half-open [start, end): an event exactly at `end` belongs to
 * the next window. `end` defaults to `now`.
 */

export const ANALYTICS_PRESETS = ["24h", "7d", "30d", "all"] as const;
export type AnalyticsPreset = (typeof ANALYTICS_PRESETS)[number];

export type TimeseriesBucket = "hour" | "day";

export interface PresetRange {
  /** Null start = unbounded ("all time"). */
  start: Date | null;
  end: Date;
}

const PRESET_MS: Record<Exclude<AnalyticsPreset, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function isAnalyticsPreset(value: unknown): value is AnalyticsPreset {
  return (
    typeof value === "string" && (ANALYTICS_PRESETS as readonly string[]).includes(value)
  );
}

/** Unknown/junk preset input folds to '30d' (a safe, bounded default). */
export function parsePreset(value: unknown): AnalyticsPreset {
  return isAnalyticsPreset(value) ? value : "30d";
}

export function resolvePresetRange(preset: AnalyticsPreset, now: Date = new Date()): PresetRange {
  const end = new Date(now.getTime());
  if (preset === "all") return { start: null, end };
  return { start: new Date(end.getTime() - PRESET_MS[preset]), end };
}

/** Bucket sized for the preset so series stay compact (≤ ~30 points). */
export function bucketForPreset(preset: AnalyticsPreset): TimeseriesBucket {
  return preset === "24h" ? "hour" : "day";
}

/** 'hour' only for short ranges; anything else folds to 'day' (matches SQL). */
export function parseBucket(value: unknown): TimeseriesBucket {
  return value === "hour" ? "hour" : "day";
}
