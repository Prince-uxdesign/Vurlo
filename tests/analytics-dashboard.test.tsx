import React from "react";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PGlite } from "@electric-sql/pglite";
import { AnalyticsSummary } from "@/components/analytics/analytics-summary";
import { BreakdownList } from "@/components/analytics/breakdown-list";
import { LinkAnalytics } from "@/components/analytics/link-analytics";
import { TrendChart } from "@/components/analytics/trend-chart";
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
    assert.ok(html.includes("Approx. 6 unique visitors"));
    assert.ok(html.includes("9 total requests"), "filtering methodology stated");
    assert.ok(!html.includes("Sample") && !html.includes("Demo") && !html.includes("Lorem"));
  });

  it("zero state names the outcome instead of charting nothing", async () => {
    const { metrics } = await loadDetail(linkEmpty);
    assert.deepEqual(metrics, emptyLinkMetrics());
    const detail = {
      link: { id: linkEmpty } as never, preset: "30d" as const,
      metrics, timeseries: [], breakdowns: {} as never,
    };
    const html = renderToStaticMarkup(
      <LinkAnalytics detail={detail} shortUrl="https://v.test/d-empty" />,
    );
    assert.ok(html.includes("No clicks yet"));
    assert.ok(html.includes("https://v.test/d-empty"));
    assert.ok(!html.includes("Clicks over time"), "no empty chart pretending at data");
  });
});

describe("trend chart (readable, touchable, accessible)", () => {
  it("names the peak in words and ships the full series as a table", async () => {
    const { timeseries } = await loadDetail(linkMain);
    const html = renderToStaticMarkup(<TrendChart points={timeseries} bucket="day" />);
    assert.ok(html.includes("Clicks over time"));
    assert.ok(html.includes("Busiest period:"), "touch users get values as text");
    assert.ok(html.includes('role="img"'), "chart has a text alternative");
    assert.ok(html.includes("<table"), "complete series as a semantic table");
    assert.ok(html.includes("<caption>"), "table labelled");
    // Bars carry per-period titles (mouse) AND sr-only values (touch/reader).
    assert.ok(html.includes("title=") && html.includes("sr-only"));
  });

  it("keeps ticks sparse so 320px phones stay readable", async () => {
    const { timeseries } = await loadDetail(linkMain);
    const html = renderToStaticMarkup(<TrendChart points={timeseries} bucket="day" />);
    const labelledTicks = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      .filter((m) => html.includes(` ${m}<`));
    assert.ok(labelledTicks.length <= 5, `ticks=${labelledTicks.length}`);
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
  it("stacks on phones, columns on tablet/desktop, never scrolls sideways", async () => {
    const { metrics, timeseries, breakdowns } = await loadDetail(linkMain);
    const detail = {
      link: { id: linkMain } as never, preset: "30d" as const,
      metrics, timeseries, breakdowns,
    };
    const html = renderToStaticMarkup(
      <LinkAnalytics detail={detail} shortUrl="https://v.test/d-main" />,
    );
    assert.ok(html.includes("grid-cols-1"), "phones stack");
    assert.ok(html.includes("md:grid-cols-2"), "tablets get two columns");
    assert.ok(html.includes("xl:grid-cols-3"), "desktop gets three");
    assert.ok(!html.includes("overflow-x-auto"), "no horizontal scrolling");
    assert.ok(html.includes('aria-current="page"'), "active range announced");
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
