import React from "react";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PGlite } from "@electric-sql/pglite";
import { AnalyticsSummary } from "@/components/analytics/analytics-summary";
import { BreakdownList } from "@/components/analytics/breakdown-list";
import { LinkAnalytics } from "@/components/analytics/link-analytics";
import { PresetSwitcher } from "@/components/analytics/preset-switcher";
import { TrendChart, niceTop } from "@/components/analytics/trend-chart";
import {
  type BreakdownDimension,
  type BreakdownRow,
  type LinkMetrics,
  type TimeseriesPoint,
  BREAKDOWN_DIMENSIONS,
  emptyLinkMetrics,
  toLinkMetrics,
  toTimeseries,
  withPercentages,
} from "@/lib/analytics/metrics";
import { createTestDb } from "./helpers/pglite-client";

/**
 * Phase 6C acceptance at the markup level (runs under plain `tsx`, since
 * `react-dom/server` is unavailable under the react-server test condition;
 * see `npm run test:ui`).
 *
 * Strategy: seed real events in PGlite, read them back through the SAME
 * ownership-gated SQL functions the page uses, shape with the production
 * helpers, render the production components, and assert the visible numbers
 * equal the database aggregates. No demo data anywhere: every asserted
 * digit traces to a seeded row.
 */

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const H = (c: string) => c.repeat(64);

let db: PGlite;
let linkMain = "";
let linkEmpty = "";
let linkBig = "";

async function asOwner<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${USER_A}', false)`);
  await db.exec(`set role authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function seed(
  slug: string,
  events: Array<[age: string, device: string, browser: string, os: string, country: string, referrer: string, traffic: string, isBot: boolean, hash: string | null]>,
) {
  for (const [age, device, browser, os, country, referrer, traffic, isBot, hash] of events) {
    await db.exec(
      `insert into public.link_events
         (link_id, occurred_at, device_type, browser, operating_system, country_code,
          referrer_source, traffic_class, is_bot, visitor_hash)
       select l.id, now() - interval '${age}', '${device}', '${browser}', '${os}',
              '${country}', '${referrer}', '${traffic}', ${isBot}, ${hash ? `'${hash}'` : "null"}
       from public.links l where l.slug = '${slug}'`,
    );
  }
}

interface DetailData {
  metrics: LinkMetrics;
  timeseries: TimeseriesPoint[];
  breakdowns: Record<BreakdownDimension, BreakdownRow[]>;
}

async function loadDetail(linkId: string): Promise<DetailData> {
  const metrics = await asOwner(async () => {
    const { rows } = await db.query<Record<string, unknown>>(
      "select * from public.my_link_metrics($1, now() - interval '30 days', now())", [linkId]);
    return toLinkMetrics(rows[0]);
  });
  const timeseries = await asOwner(async () => {
    const { rows } = await db.query<Record<string, unknown>>(
      "select * from public.my_link_timeseries($1, now() - interval '30 days', now(), 'day')", [linkId]);
    return toTimeseries(rows);
  });
  const breakdowns = {} as Record<BreakdownDimension, BreakdownRow[]>;
  for (const d of BREAKDOWN_DIMENSIONS) {
    const { rows } = await asOwner(() =>
      db.query<Record<string, unknown>>(
        `select * from public.my_link_breakdown($1, '${d}', now() - interval '30 days', now())`, [linkId]),
    );
    breakdowns[d] = withPercentages(
      rows.filter((r) => typeof r.key === "string").map((r) => ({
        key: r.key as string, total: Number(r.total), human: Number(r.human),
      })),
    );
  }
  return { metrics, timeseries, breakdowns };
}

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id) values ('${USER_A}')`);
  await db.exec(
    `insert into public.links (slug, destination_url, user_id, expires_at) values
      ('d-main', 'https://example.com/main', '${USER_A}', now() + interval '30 days'),
      ('d-empty', 'https://example.com/empty', '${USER_A}', now() + interval '30 days'),
      ('d-big', 'https://example.com/big', '${USER_A}', now() + interval '30 days')`,
  );
  const { rows } = await db.query<{ id: string; slug: string }>(
    "select id, slug from public.links where slug like 'd-%'",
  );
  for (const r of rows) {
    if (r.slug === "d-main") linkMain = r.id;
    if (r.slug === "d-empty") linkEmpty = r.id;
    if (r.slug === "d-big") linkBig = r.id;
  }

  await seed("d-main", [
    ["1 hour", "desktop", "chrome", "windows", "US", "google", "human", false, H("1")],
    ["2 hours", "desktop", "chrome", "windows", "US", "google", "human", false, H("2")],
    ["26 hours", "desktop", "firefox", "macos", "DE", "direct", "human", false, H("1")],
    ["3 days", "mobile", "safari", "ios", "GB", "instagram", "human", false, H("4")],
    ["4 days", "mobile", "safari", "ios", "GB", "instagram", "human", false, H("5")],
    ["5 hours", "tablet", "edge", "linux", "FR", "twitter", "human", false, H("3")],
    ["6 hours", "desktop", "other", "other", "unknown", "other", "bot", true, H("b")],
    ["7 hours", "unknown", "other", "other", "unknown", "direct", "scanner", true, null],
    ["8 hours", "unknown", "unknown", "unknown", "unknown", "direct", "unknown", false, null],
  ]);

  // Larger dataset: 300 human clicks across devices, one SQL statement.
  await db.exec(
    `insert into public.link_events
       (link_id, occurred_at, device_type, browser, operating_system, country_code,
        referrer_source, traffic_class, is_bot, visitor_hash)
     select l.id,
            now() - (g || ' hours')::interval,
            (array['desktop','mobile','tablet'])[1 + (g % 3)],
            'chrome', 'windows', 'US', 'google', 'human', false,
            md5(g::text) || md5('salt' || g::text)
     from public.links l, generate_series(1, 300) g where l.slug = 'd-big'`,
  );
});

after(async () => {
  await db.close();
});

describe("hero metrics render database truth (no demo data)", () => {
  it("headline counts humans only; bots surface as requests, never as clicks", async () => {
    const { metrics } = await loadDetail(linkMain);
    assert.equal(metrics.totalRequests, 9);
    assert.equal(metrics.clicks, 6);
    assert.equal(metrics.approxUniques, 6);
    const html = renderToStaticMarkup(<AnalyticsSummary metrics={metrics} />);
    assert.ok(html.includes(">6<"), "hero shows 6 human clicks, not 9 requests");
    assert.ok(html.includes("Unique visitors") && html.includes("(approx.)"), "uniques labelled approximate");
    assert.ok(html.includes("9 total requests"), "filtering methodology stated");
    assert.ok(!html.includes("Sample") && !html.includes("Demo") && !html.includes("Lorem"));
  });

  it("zero state names the outcome instead of charting nothing", async () => {
    const { metrics } = await loadDetail(linkEmpty);
    assert.deepEqual(metrics, emptyLinkMetrics());
    const data = { preset: "all" as const, metrics, timeseries: [], breakdowns: {} as never };
    const html = renderToStaticMarkup(<LinkAnalytics data={data} shortUrl="https://v.test/d-empty" />);
    assert.ok(html.includes("No clicks yet"));
    assert.ok(html.includes("https://v.test/d-empty"));
    assert.ok(!html.includes("Clicks over time"), "no empty chart pretending at data");
    // A bounded range says the quiet spell is this range, not the link's life.
    const ranged = renderToStaticMarkup(<LinkAnalytics data={{ ...data, preset: "7d" }} shortUrl="https://v.test/d-empty" />);
    assert.ok(ranged.includes("No clicks in the last 7 days"));
  });
});

describe("trend chart (readable, touchable, accessible)", () => {
  it("names the peak in words and exposes every period to assistive tech", async () => {
    const { timeseries } = await loadDetail(linkMain);
    const html = renderToStaticMarkup(<TrendChart points={timeseries} bucket="day" />);
    assert.ok(html.includes("Clicks over time"));
    assert.ok(html.includes("Busiest period:"), "values readable without hover");
    assert.ok(html.includes('role="listbox"') && html.includes('tabindex="0"'), "one keyboard stop, arrow keys inside");
    const options = html.match(/role="option"/g) ?? [];
    assert.equal(options.length, timeseries.length, "every period is a named option");
    assert.ok(/aria-label="\d+ \w+: \d+ clicks?"/.test(html), "options name date and value");
    assert.ok(html.includes("Use the arrow keys"), "keyboard use explained");
    assert.ok(html.includes("touch-pan-y"), "horizontal drag reads values; vertical still scrolls the page");
  });

  it("thins date labels by width: 3 on phones, 5 on tablets, 7 on desktop", async () => {
    const { timeseries } = await loadDetail(linkMain);
    assert.ok(timeseries.length >= 30);
    const html = renderToStaticMarkup(<TrendChart points={timeseries} bucket="day" />);
    const ticks = [...html.matchAll(/<span class="absolute top-0 whitespace-nowrap([^"]*)"/g)].map((m) => m[1]!.split(/\s+/));
    const visible = (bp: "" | "sm:" | "lg:") => ticks.filter((c) => {
      // The last class that applies at this breakpoint wins (mobile-first).
      const order = bp === "" ? [""] : bp === "sm:" ? ["", "sm:"] : ["", "sm:", "lg:"];
      let shown = false;
      for (const prefix of order) {
        if (c.includes(`${prefix}block`)) shown = true;
        if (c.includes(`${prefix}hidden`)) shown = false;
      }
      return shown;
    }).length;
    assert.equal(visible(""), 3, "phones");
    assert.equal(visible("sm:"), 5, "tablets");
    assert.equal(visible("lg:"), 7, "desktop");
  });

  it("puts round values on the y axis", () => {
    assert.deepEqual([1, 3, 5, 9, 10, 12, 23, 300].map(niceTop), [1, 4, 6, 10, 10, 20, 40, 400]);
  });
});

describe("breakdowns render honest, readable rows", () => {
  it("expands countries, marks direct unknown, shows shares", async () => {
    const { breakdowns } = await loadDetail(linkMain);
    const device = renderToStaticMarkup(<BreakdownList dimension="device" rows={breakdowns.device} />);
    assert.ok(device.includes("Desktop") && device.includes("50%"), "3 of 6 humans on desktop");
    assert.ok(device.includes("Unknown"), "missing device data stays unknown");
    const country = renderToStaticMarkup(<BreakdownList dimension="country" rows={breakdowns.country} />);
    assert.ok(country.includes("United States"), "codes expand to names");
    assert.ok(!country.includes(">US<"), "raw codes not shown");
    const referrer = renderToStaticMarkup(<BreakdownList dimension="referrer" rows={breakdowns.referrer} />);
    assert.ok(referrer.includes("Direct / Unknown"));
    assert.ok(referrer.includes("Where visits came from"), "explanatory hint rendered");
  });

  it("empty breakdowns explain instead of zeroing out", () => {
    const html = renderToStaticMarkup(<BreakdownList dimension="os" rows={[]} />);
    assert.ok(html.includes("Nothing here for this period yet."));
  });
});

describe("layout, responsiveness and freshness markers", () => {
  it("columns follow the width the analytics get, never scrolls sideways", async () => {
    const { metrics, timeseries, breakdowns } = await loadDetail(linkMain);
    const html = renderToStaticMarkup(
      <LinkAnalytics data={{ preset: "30d", metrics, timeseries, breakdowns }} shortUrl="https://v.test/d-main" />,
    );
    assert.ok(html.includes("@container"), "sized by its column, not the screen");
    assert.ok(html.includes("grid-cols-1"), "narrow: one column");
    assert.ok(html.includes("@xl:grid-cols-2"), "wider: two");
    assert.ok(html.includes("@5xl:grid-cols-3"), "full width: three");
    assert.ok(!html.includes("overflow-x-auto"), "no horizontal scrolling");
  });

  it("range switcher: one row of links, current one announced, keeps scroll", () => {
    const html = renderToStaticMarkup(<PresetSwitcher linkId={linkMain} preset="7d" />);
    assert.ok(html.includes('aria-current="page"'), "active range announced");
    assert.ok(html.includes("grid-cols-4"), "four equal cells, no wrapping on phones");
    assert.equal((html.match(/min-h-11/g) ?? []).length, 4, "44px targets");
  });

  it("communicates freshness without claiming live data", async () => {
    const { metrics } = await loadDetail(linkMain);
    const html = renderToStaticMarkup(<AnalyticsSummary metrics={metrics} />);
    assert.ok(html.includes("Counts update as visits arrive"));
    assert.ok(!html.includes("Live"), "never claims live");
  });

  it("holds up under a larger dataset (aggregation, not event loading)", async () => {
    const data = await loadDetail(linkBig);
    assert.equal(data.metrics.totalRequests, 300);
    assert.ok(data.timeseries.length <= 31, `buckets=${data.timeseries.length}`);
    const html = renderToStaticMarkup(<TrendChart points={data.timeseries} bucket="day" />);
    assert.ok(html.includes("300 clicks in view"));
  });
});
