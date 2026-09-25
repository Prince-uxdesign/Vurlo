import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NO_CLICKS_MESSAGE,
  emptyAccountMetrics,
  emptyLinkMetrics,
  isBreakdownDimension,
  toAccountMetrics,
  toLinkMetrics,
  toTimeseries,
  withPercentages,
} from "@/lib/analytics/metrics";
import {
  bucketForPreset,
  isAnalyticsPreset,
  parseBucket,
  parsePreset,
  resolvePresetRange,
} from "@/lib/analytics/presets";
import { createAnalyticsCache } from "@/lib/analytics/queries";

describe("presets (24h / 7d / 30d / all, nothing arbitrary)", () => {
  const now = new Date("2026-04-01T12:00:00Z");

  it("resolves short and long ranges with half-open bounds", () => {
    const day = resolvePresetRange("24h", now);
    assert.equal(day.end.toISOString(), "2026-04-01T12:00:00.000Z");
    assert.equal(day.start!.toISOString(), "2026-03-31T12:00:00.000Z");
    const week = resolvePresetRange("7d", now);
    assert.equal(week.start!.toISOString(), "2026-03-25T12:00:00.000Z");
    const month = resolvePresetRange("30d", now);
    assert.equal(month.start!.toISOString(), "2026-03-02T12:00:00.000Z");
    const all = resolvePresetRange("all", now);
    assert.equal(all.start, null);
    assert.equal(all.end.toISOString(), "2026-04-01T12:00:00.000Z");
  });

  it("sizes buckets so series stay chart-compact", () => {
    assert.equal(bucketForPreset("24h"), "hour");
    assert.equal(bucketForPreset("7d"), "day");
    assert.equal(bucketForPreset("30d"), "day");
    assert.equal(bucketForPreset("all"), "day");
  });

  it("folds junk input to safe defaults instead of failing", () => {
    assert.equal(parsePreset("24h"), "24h");
    assert.equal(parsePreset("90d"), "30d");
    assert.equal(parsePreset(null), "30d");
    assert.equal(parsePreset(undefined), "30d");
    assert.equal(isAnalyticsPreset("all"), true);
    assert.equal(isAnalyticsPreset("ytd"), false);
    assert.equal(parseBucket("hour"), "hour");
    assert.equal(parseBucket("minute"), "day");
    assert.equal(parseBucket(null), "day");
  });
});

describe("metric shaping (definitions, empty states)", () => {
  it("maps a metrics row with clicks = likely-human traffic", () => {
    const m = toLinkMetrics({
      total_requests: 10,
      human_clicks: 6,
      bots: 2,
      scanners: 1,
      unknown_traffic: 1,
      approx_uniques: 5,
      approx_human_uniques: 4,
      last_clicked_at: "2026-04-01T00:00:00.000Z",
    });
    assert.equal(m.clicks, 6);
    assert.equal(m.totalRequests, 10);
    assert.equal(m.bots + m.scanners + m.unknownTraffic, 4);
    assert.equal(m.hasData, true);
  });

  it("returns an intentional empty state, never bare zeros", () => {
    assert.deepEqual(toLinkMetrics(null), emptyLinkMetrics());
    assert.deepEqual(toAccountMetrics(null), emptyAccountMetrics());
    assert.equal(emptyLinkMetrics().hasData, false);
    assert.equal(NO_CLICKS_MESSAGE, "No clicks yet.");
    const zeroRow = toLinkMetrics({ total_requests: 0 });
    assert.equal(zeroRow.hasData, false);
    assert.equal(zeroRow.lastClickedAt, null);
  });

  it("passes through only well-formed timeseries points", () => {
    assert.deepEqual(toTimeseries(null), []);
    assert.deepEqual(
      toTimeseries([
        { bucket_start: "2026-04-01T00:00:00.000Z", total: 3, human: 2 },
        { bucket_start: null, total: 99, human: 99 },
      ]),
      [{ bucketStart: "2026-04-01T00:00:00.000Z", total: 3, human: 2 }],
    );
  });

  it("accepts Date timestamps (drivers) as well as ISO strings (PostgREST)", () => {
    assert.deepEqual(
      toTimeseries([{ bucket_start: new Date("2026-04-01T00:00:00.000Z"), total: "3", human: "2" }]),
      [{ bucketStart: "2026-04-01T00:00:00.000Z", total: 3, human: 2 }],
    );
    assert.equal(
      toLinkMetrics({ total_requests: 1, last_clicked_at: new Date("2026-04-01T00:00:00.000Z") }).lastClickedAt,
      "2026-04-01T00:00:00.000Z",
    );
  });

  it("rejects unknown breakdown dimensions", () => {
    assert.equal(isBreakdownDimension("device"), true);
    assert.equal(isBreakdownDimension("country"), true);
    assert.equal(isBreakdownDimension("ip"), false);
    assert.equal(isBreakdownDimension("hour"), false);
  });
});

describe("percentages (from real data, share of human clicks)", () => {
  it("sums to ~100 and rounds to 1 decimal", () => {
    const rows = withPercentages([
      { key: "mobile", total: 5, human: 4 },
      { key: "desktop", total: 3, human: 2 },
      { key: "tablet", total: 1, human: 1 },
    ]);
    assert.deepEqual(rows.map((r) => r.key), ["mobile", "desktop", "tablet"]);
    const sum = rows.reduce((s, r) => s + r.pct, 0);
    assert.ok(Math.abs(sum - 100) <= 0.5, `sum=${sum}`);
    assert.ok(rows.every((r) => r.pct === Math.round(r.pct * 10) / 10));
  });

  it("returns zeros (not NaN) when there are no human clicks", () => {
    const rows = withPercentages([{ key: "direct", total: 3, human: 0 }]);
    assert.equal(rows[0]!.pct, 0);
    assert.deepEqual(withPercentages([]), []);
    assert.deepEqual(withPercentages(null), []);
  });
});

describe("analytics cache (deliberate, documented staleness)", () => {
  it("serves cached values until TTL expiry", async () => {
    const cache = createAnalyticsCache(30);
    let calls = 0;
    const fetch = async () => ++calls;
    assert.equal(await cache.wrap("k", fetch), 1);
    assert.equal(await cache.wrap("k", fetch), 1);
    assert.equal(calls, 1);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(await cache.wrap("k", fetch), 2);
    assert.equal(calls, 2);
  });

  it("isolates keys and supports invalidation", async () => {
    const cache = createAnalyticsCache(60_000);
    let calls = 0;
    const fetch = async () => ++calls;
    await cache.wrap("a", fetch);
    await cache.wrap("b", fetch);
    assert.equal(calls, 2);
    cache.invalidate("a");
    await cache.wrap("a", fetch);
    assert.equal(calls, 3);
    cache.clear();
    await cache.wrap("b", fetch);
    assert.equal(calls, 4);
  });
});
