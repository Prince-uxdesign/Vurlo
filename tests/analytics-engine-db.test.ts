import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import {
  getAccountMetrics,
  getCachedLinkMetrics,
  getLinkBreakdown,
  getLinkMetrics,
  getLinkTimeseries,
  createAnalyticsCache,
} from "@/lib/analytics/queries";
import { createTestDb } from "./helpers/pglite-client";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const H1 = "1".repeat(64);
const H2 = "2".repeat(64);
const H3 = "3".repeat(64);
const H4 = "4".repeat(64);
const H5 = "5".repeat(64);
const H6 = "6".repeat(64);
const HB = "b".repeat(64);
const HA = "a".repeat(64);

let db: PGlite;
let linkA1 = "";
let linkA2 = "";
let linkB1 = "";
let linkExpired = "";

async function as<T>(role: "anon" | "authenticated" | "service_role", sub: string | null, fn: () => Promise<T>) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ""}', false)`);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function code(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

interface SeedEvent {
  slug: string;
  age: string;
  device: string;
  browser: string;
  os: string;
  country: string;
  referrer: string;
  traffic: string;
  isBot: boolean;
  hash: string | null;
}

async function seed(events: SeedEvent[]) {
  for (const e of events) {
    await db.exec(
      `insert into public.link_events
         (link_id, occurred_at, device_type, browser, operating_system, country_code,
          referrer_source, traffic_class, is_bot, visitor_hash)
       select l.id, now() - interval '${e.age}', '${e.device}', '${e.browser}', '${e.os}',
              '${e.country}', '${e.referrer}', '${e.traffic}', ${e.isBot}, ${e.hash ? `'${e.hash}'` : "null"}
       from public.links l where l.slug = '${e.slug}'`,
    );
  }
}

/** Independent raw aggregates (service role) -- the math the functions must match. */
async function rawMetrics(linkId: string, startAgo: string | null) {
  const window = startAgo ? `and e.occurred_at >= now() - interval '${startAgo}'` : "";
  const { rows } = await db.query<Record<string, string>>(
    `select count(*) as total,
            count(*) filter (where e.traffic_class = 'human') as human,
            count(*) filter (where e.traffic_class = 'bot') as bots,
            count(*) filter (where e.traffic_class = 'scanner') as scanners,
            count(*) filter (where e.traffic_class = 'unknown') as unknown_t,
            count(distinct e.visitor_hash) filter (where e.visitor_hash is not null) as uniques,
            count(distinct e.visitor_hash) filter (where e.visitor_hash is not null and e.traffic_class = 'human') as human_uniques
     from public.link_events e where e.link_id = $1 ${window}`,
    [linkId],
  );
  const r = rows[0]!;
  return {
    total: Number(r.total),
    human: Number(r.human),
    bots: Number(r.bots),
    scanners: Number(r.scanners),
    unknown: Number(r.unknown_t),
    uniques: Number(r.uniques),
    humanUniques: Number(r.human_uniques),
  };
}

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}')`);
  await db.exec(
    `insert into public.links (slug, destination_url, user_id, expires_at) values
      ('m-a1', 'https://example.com/a1', '${USER_A}', now() + interval '30 days'),
      ('m-a2', 'https://example.com/a2', '${USER_A}', now() + interval '30 days'),
      ('m-b1', 'https://example.com/b1', '${USER_B}', now() + interval '30 days'),
      ('m-off', 'https://example.com/off', '${USER_A}', now() + interval '30 days')`,
  );
  await db.exec(
    `insert into public.links (slug, destination_url, created_at, expires_at) values
      ('m-old', 'https://example.com/old', now() - interval '32 days', now() - interval '1 day')`,
  );
  await db.exec(
    `update public.links set user_id = '${USER_A}' where slug = 'm-old';
     update public.links set status = 'disabled' where slug = 'm-off'`,
  );
  const { rows } = await db.query<{ id: string; slug: string }>(
    "select id, slug from public.links where slug like 'm-%'",
  );
  for (const r of rows) {
    if (r.slug === "m-a1") linkA1 = r.id;
    if (r.slug === "m-a2") linkA2 = r.id;
    if (r.slug === "m-b1") linkB1 = r.id;
    if (r.slug === "m-old") linkExpired = r.id;
  }

  await seed([
    { slug: "m-a1", age: "1 hour", device: "desktop", browser: "chrome", os: "windows", country: "US", referrer: "google", traffic: "human", isBot: false, hash: H1 },
    { slug: "m-a1", age: "2 hours", device: "mobile", browser: "safari", os: "ios", country: "GB", referrer: "instagram", traffic: "human", isBot: false, hash: H2 },
    { slug: "m-a1", age: "26 hours", device: "desktop", browser: "firefox", os: "macos", country: "DE", referrer: "direct", traffic: "human", isBot: false, hash: H1 },
    { slug: "m-a1", age: "40 days", device: "tablet", browser: "edge", os: "linux", country: "FR", referrer: "twitter", traffic: "human", isBot: false, hash: H3 },
    { slug: "m-a1", age: "3 hours", device: "desktop", browser: "other", os: "other", country: "unknown", referrer: "other", traffic: "bot", isBot: true, hash: HB },
    { slug: "m-a1", age: "4 hours", device: "unknown", browser: "other", os: "other", country: "unknown", referrer: "direct", traffic: "scanner", isBot: true, hash: null },
    { slug: "m-a1", age: "5 hours", device: "unknown", browser: "unknown", os: "unknown", country: "unknown", referrer: "direct", traffic: "unknown", isBot: false, hash: null },
    { slug: "m-a1", age: "10 minutes", device: "mobile", browser: "chrome", os: "android", country: "US", referrer: "google", traffic: "human", isBot: false, hash: H4 },
    { slug: "m-a1", age: "23 hours", device: "desktop", browser: "chrome", os: "windows", country: "CA", referrer: "bing", traffic: "human", isBot: false, hash: H5 },
    { slug: "m-a1", age: "8 days", device: "mobile", browser: "safari", os: "ios", country: "US", referrer: "tiktok", traffic: "human", isBot: false, hash: H6 },
    { slug: "m-a1", age: "30 minutes", device: "desktop", browser: "chrome", os: "windows", country: "US", referrer: "google", traffic: "human", isBot: false, hash: H2 },
    // Second owned link (account rollup) + other owner's link (isolation).
    { slug: "m-a2", age: "1 hour", device: "mobile", browser: "chrome", os: "android", country: "US", referrer: "google", traffic: "human", isBot: false, hash: HA },
    { slug: "m-a2", age: "2 hours", device: "mobile", browser: "chrome", os: "android", country: "US", referrer: "google", traffic: "human", isBot: false, hash: HA },
    { slug: "m-b1", age: "1 hour", device: "desktop", browser: "chrome", os: "windows", country: "US", referrer: "google", traffic: "human", isBot: false, hash: H1 },
    { slug: "m-b1", age: "2 hours", device: "desktop", browser: "chrome", os: "windows", country: "US", referrer: "google", traffic: "human", isBot: false, hash: H2 },
    { slug: "m-b1", age: "3 hours", device: "desktop", browser: "chrome", os: "windows", country: "US", referrer: "google", traffic: "human", isBot: false, hash: H4 },
    // Historical click on the now-expired link (analytics must survive expiry).
    { slug: "m-old", age: "10 days", device: "desktop", browser: "firefox", os: "linux", country: "NL", referrer: "github", traffic: "human", isBot: false, hash: H5 },
  ]);
});

after(async () => {
  await db.close();
});

describe("my_link_metrics() matches raw events in every window", () => {
  const windows: Array<[string, string | null]> = [
    ["24h", "24 hours"],
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["all", null],
  ];

  for (const [label, ago] of windows) {
    it(`${label}: totals, bot split and uniques equal the raw counts`, async () => {
      const expected = await rawMetrics(linkA1, ago);
      const { rows } = await as("authenticated", USER_A, () =>
        db.query<Record<string, unknown>>(
          `select * from public.my_link_metrics($1, ${ago ? `now() - interval '${ago}'` : "null"}, null)`,
          [linkA1],
        ),
      );
      assert.equal(rows.length, 1, label);
      const r = rows[0]!;
      assert.equal(Number(r.total_requests), expected.total, `${label} total`);
      assert.equal(Number(r.human_clicks), expected.human, `${label} human`);
      assert.equal(Number(r.bots), expected.bots, `${label} bots`);
      assert.equal(Number(r.scanners), expected.scanners, `${label} scanners`);
      assert.equal(Number(r.unknown_traffic), expected.unknown, `${label} unknown`);
      assert.equal(Number(r.approx_uniques), expected.uniques, `${label} uniques`);
      assert.equal(Number(r.approx_human_uniques), expected.humanUniques, `${label} human uniques`);
    });
  }

  it("24h excludes the 26h repeated-visitor click; 7d includes it", async () => {
    const day = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>(
        "select * from public.my_link_metrics($1, now() - interval '24 hours', null)", [linkA1]),
    );
    const week = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>(
        "select * from public.my_link_metrics($1, now() - interval '7 days', null)", [linkA1]),
    );
    assert.equal(Number(day.rows[0]!.total_requests), 8);
    assert.equal(Number(day.rows[0]!.human_clicks), 5);
    assert.equal(Number(week.rows[0]!.total_requests), 9);
    assert.equal(Number(week.rows[0]!.human_clicks), 6);
  });

  it("zero-click link returns one zero row (empty state, not null)", async () => {
    const { rows } = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>("select * from public.my_link_metrics($1, null, null)", [linkA2]),
    );
    // A2 HAS events; use the disabled link with none.
    assert.equal(rows.length, 1);
    const off = await as("authenticated", USER_A, () =>
      db.query<{ id: string }>("select id from public.links where slug = 'm-off'").then(async (r) =>
        db.query<Record<string, unknown>>("select * from public.my_link_metrics($1, null, null)", [r.rows[0]!.id]),
      ),
    );
    assert.equal(off.rows.length, 1);
    assert.equal(Number(off.rows[0]!.total_requests), 0);
    assert.equal(off.rows[0]!.last_clicked_at, null);
  });

  it("expired links keep their history; deleted links return zero rows", async () => {
    const kept = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>("select * from public.my_link_metrics($1, null, null)", [linkExpired]),
    );
    assert.equal(kept.rows.length, 1);
    assert.equal(Number(kept.rows[0]!.total_requests), 1);

    await db.exec(
      `insert into public.links (slug, destination_url, user_id, expires_at) values
        ('m-doom', 'https://example.com/doom', '${USER_A}', now() + interval '30 days')`,
    );
    await seed([
      { slug: "m-doom", age: "1 hour", device: "desktop", browser: "chrome", os: "windows", country: "US", referrer: "google", traffic: "human", isBot: false, hash: H1 },
    ]);
    const { rows } = await db.query<{ id: string }>("select id from public.links where slug = 'm-doom'");
    await db.exec("update public.links set status = 'deleted' where slug = 'm-doom'");
    const gone = await as("authenticated", USER_A, () =>
      db.query("select * from public.my_link_metrics($1, null, null)", [rows[0]!.id]),
    );
    assert.equal(gone.rows.length, 0);
  });

  it("unauthorized and anonymous callers get zero rows, never data", async () => {
    const other = await as("authenticated", USER_B, () =>
      db.query("select * from public.my_link_metrics($1, null, null)", [linkA1]),
    );
    assert.equal(other.rows.length, 0);
    // ...while the other owner's own link resolves normally (isolation both ways).
    const own = await as("authenticated", USER_B, () =>
      db.query<Record<string, unknown>>("select * from public.my_link_metrics($1, null, null)", [linkB1]),
    );
    assert.equal(own.rows.length, 1);
    assert.equal(Number(own.rows[0]!.total_requests), 3);
    const c = await as("anon", null, () =>
      code(() => db.query("select * from public.my_link_metrics($1, null, null)", [linkA1])),
    );
    assert.equal(c, "42501");
  });
});

describe("my_link_timeseries() (compact, gap-filled, honest buckets)", () => {
  it("aligned bounds give exactly 24 hourly / 7 daily buckets", async () => {
    const hours = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>(
        `select * from public.my_link_timeseries(
           $1, date_trunc('hour', now()) - interval '24 hours', date_trunc('hour', now()), 'hour')`,
        [linkA1],
      ),
    );
    assert.equal(hours.rows.length, 24);
    const days = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>(
        `select * from public.my_link_timeseries(
           $1, date_trunc('day', now()) - interval '7 days', date_trunc('day', now()), 'day')`,
        [linkA1],
      ),
    );
    assert.equal(days.rows.length, 7);
  });

  it("live windows reconcile exactly with metrics (partial edge buckets included)", async () => {
    const { rows } = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>(
        "select * from public.my_link_timeseries($1, now() - interval '24 hours', now(), 'hour')",
        [linkA1],
      ),
    );
    // 24 or 25 points depending on hour alignment; sums must match metrics.
    assert.ok(rows.length === 24 || rows.length === 25, `buckets=${rows.length}`);
    assert.equal(rows.reduce((s, r) => s + Number(r.total), 0), 8);
    assert.equal(rows.reduce((s, r) => s + Number(r.human), 0), 5);
    // Ordered ascending, gap buckets present as zeros.
    const times = rows.map((r) => new Date(String(r.bucket_start)).getTime());
    assert.deepEqual([...times].sort((a, b) => a - b), times);
    assert.ok(rows.some((r) => Number(r.total) === 0));
    assert.ok(rows.every((r) => Number(r.human) <= Number(r.total)));
  });

  it("7d returns 7-8 daily buckets; long range stays compact", async () => {
    const { rows } = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>(
        "select * from public.my_link_timeseries($1, now() - interval '7 days', now(), 'day')",
        [linkA1],
      ),
    );
    assert.ok(rows.length === 7 || rows.length === 8, `buckets=${rows.length}`);
    assert.equal(rows.reduce((s, r) => s + Number(r.total), 0), 9);
  });

  it("rejects bad buckets, bad ranges and non-owners with zero rows", async () => {
    const folded = await as("authenticated", USER_A, () =>
      db.query(
        "select * from public.my_link_timeseries($1, now() - interval '7 days', now(), 'minute')",
        [linkA1],
      ),
    );
    assert.ok(folded.rows.length === 7 || folded.rows.length === 8); // junk bucket folds to day
    const badRange = await as("authenticated", USER_A, () =>
      db.query("select * from public.my_link_timeseries($1, now(), now(), 'day')", [linkA1]),
    );
    assert.equal(badRange.rows.length, 0);
    const other = await as("authenticated", USER_B, () =>
      db.query(
        "select * from public.my_link_timeseries($1, now() - interval '24 hours', now(), 'hour')",
        [linkA1],
      ),
    );
    assert.equal(other.rows.length, 0);
  });
});

describe("my_link_breakdown() (one coarse dimension at a time)", () => {
  it("device counts match raw group-bys exactly", async () => {
    const { rows } = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>("select * from public.my_link_breakdown($1, 'device', null, null)", [linkA1]),
    );
    const by = Object.fromEntries(rows.map((r) => [r.key, { total: Number(r.total), human: Number(r.human) }]));
    assert.deepEqual(by["desktop"], { total: 5, human: 4 });
    assert.deepEqual(by["mobile"], { total: 3, human: 3 });
    assert.deepEqual(by["tablet"], { total: 1, human: 1 });
    assert.deepEqual(by["unknown"], { total: 2, human: 0 });
  });

  it("all five dimensions agree with raw counts", async () => {
    const dims: Array<[string, string]> = [
      ["browser", "browser"],
      ["os", "operating_system"],
      ["country", "country_code"],
      ["referrer", "referrer_source"],
    ];
    for (const [dim, col] of dims) {
      const { rows } = await as("authenticated", USER_A, () =>
        db.query<Record<string, unknown>>(`select * from public.my_link_breakdown($1, '${dim}', null, null)`, [linkA1]),
      );
      const raw = await db.query<Record<string, unknown>>(
        `select ${col} as key, count(*) as total, count(*) filter (where traffic_class = 'human') as human
         from public.link_events where link_id = $1 group by 1`,
        [linkA1],
      );
      assert.deepEqual(
        rows.map((r) => [r.key, String(r.total), String(r.human)]).sort(),
        raw.rows.map((r) => [String(r.key), String(r.total), String(r.human)]).sort(),
        dim,
      );
    }
  });

  it("rejects unknown dimensions and non-owners with zero rows, never raw rows", async () => {
    const junk = await as("authenticated", USER_A, () =>
      db.query("select * from public.my_link_breakdown($1, 'ip', null, null)", [linkA1]),
    );
    assert.equal(junk.rows.length, 0);
    const other = await as("authenticated", USER_B, () =>
      db.query("select * from public.my_link_breakdown($1, 'device', null, null)", [linkA1]),
    );
    assert.equal(other.rows.length, 0);
    const cols = junk.rows[0] ? Object.keys(junk.rows[0]) : [];
    assert.equal(cols.includes("visitor_hash"), false);
  });

  it("missing metadata aggregates honestly under unknown/direct", async () => {
    const { rows } = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>("select * from public.my_link_breakdown($1, 'country', null, null)", [linkA1]),
    );
    const by = Object.fromEntries(rows.map((r) => [String(r.key), Number(r.total)]));
    assert.equal(by["unknown"], 3); // bot + scanner + unknown-class events
    assert.equal(by["US"], 4);
  });
});

describe("my_account_metrics() (User -> Links -> Events rollup)", () => {
  it("rolls up owned links and matches raw math", async () => {
    const { rows } = await as("authenticated", USER_A, () =>
      db.query<Record<string, unknown>>("select * from public.my_account_metrics(null, null)"),
    );
    assert.equal(rows.length, 1);
    const raw = await db.query<Record<string, string>>(
      `select count(*) as total, count(*) filter (where e.traffic_class = 'human') as human,
              count(distinct e.visitor_hash) filter (where e.visitor_hash is not null) as uniques,
              count(distinct e.link_id) as clicked
       from public.link_events e join public.links l on l.id = e.link_id
       where l.user_id = '${USER_A}' and l.status <> 'deleted'`,
    );
    const r = rows[0]!;
    assert.equal(Number(r.total_requests), Number(raw.rows[0]!.total));
    assert.equal(Number(r.human_clicks), Number(raw.rows[0]!.human));
    assert.equal(Number(r.approx_uniques), Number(raw.rows[0]!.uniques));
    assert.equal(Number(r.links_clicked), Number(raw.rows[0]!.clicked));
    assert.ok(Number(r.total_links) >= 4); // a1, a2, old, off (doom is deleted)
  });

  it("isolates users and refuses anon", async () => {
    const b = await as("authenticated", USER_B, () =>
      db.query<Record<string, unknown>>("select * from public.my_account_metrics(null, null)"),
    );
    assert.equal(Number(b.rows[0]!.total_requests), 3);
    const c = await as("anon", null, () => code(() => db.query("select * from public.my_account_metrics(null, null)")));
    assert.equal(c, "42501");
  });
});

describe("query layer wrappers (secure, fail-safe, cached)", () => {
  // Authenticated clients calling the real functions through the wrappers.
  const liveClient = (sub: string) => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      const names = Object.keys(args);
      const values = Object.values(args);
      const placeholders = names.map((n, i) => `${n} => $${i + 1}`).join(", ");
      try {
        const result = await as("authenticated", sub, () =>
          db.query(`select * from public.${fn}(${placeholders})`, values),
        );
        return { data: result.rows, error: null as { message: string } | null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
  });

  it("getLinkMetrics maps rows per preset; unauthorized/invalid give null", async () => {
    const m = await getLinkMetrics(linkA1, "24h", { client: liveClient(USER_A) });
    assert.ok(m && m.totalRequests === 8 && m.clicks === 5 && m.hasData);
    assert.equal(m.approxUniques, 5);
    const all = await getLinkMetrics(linkA1, "all", { client: liveClient(USER_A) });
    assert.equal(all!.totalRequests, 11);
    assert.equal(await getLinkMetrics(linkA1, "24h", { client: liveClient(USER_B) }), null);
    assert.equal(await getLinkMetrics("not-a-uuid", "24h", { client: liveClient(USER_A) }), null);
    assert.equal(await getLinkMetrics(linkA1, "24h", { client: null }), null);
  });

  it("getLinkTimeseries sizes series by preset; 'all' charts trailing 30d", async () => {
    const day = await getLinkTimeseries(linkA1, "24h", { client: liveClient(USER_A) });
    assert.ok(day!.length === 24 || day!.length === 25, `buckets=${day!.length}`);
    // Series reconciles with headline metrics for the same live window.
    const metrics = await getLinkMetrics(linkA1, "24h", { client: liveClient(USER_A) });
    assert.equal(day!.reduce((s, p) => s + p.total, 0), metrics!.totalRequests);
    assert.equal(day!.reduce((s, p) => s + p.human, 0), metrics!.clicks);
    const week = await getLinkTimeseries(linkA1, "7d", { client: liveClient(USER_A) });
    assert.ok(week!.length === 7 || week!.length === 8, `buckets=${week!.length}`);
    const all = await getLinkTimeseries(linkA1, "all", { client: liveClient(USER_A) });
    assert.ok(all!.length === 30 || all!.length === 31, `buckets=${all!.length}`);
    assert.equal(await getLinkTimeseries(linkA1, "24h", { client: liveClient(USER_B) }), null);
  });

  it("getLinkBreakdown attaches real percentages summing to ~100", async () => {
    const rows = await getLinkBreakdown(linkA1, "device", "all", { client: liveClient(USER_A) });
    assert.deepEqual(rows!.map((r) => r.key), ["desktop", "mobile", "tablet", "unknown"]);
    const sum = rows!.reduce((s, r) => s + r.pct, 0);
    assert.ok(Math.abs(sum - 100) <= 0.5, `sum=${sum}`);
    assert.equal(rows![0]!.pct, 50); // 4 of 8 humans on desktop
    // Unknown dimension is rejected before any database call (null, no probing).
    assert.equal(await getLinkBreakdown(linkA1, "ip", "all", { client: liveClient(USER_A) }), null);
    // Non-owner: also empty -- indistinguishable from no-data by design.
    // (No leak: use getLinkMetrics, which returns null, to tell them apart.)
    assert.deepEqual(await getLinkBreakdown(linkA1, "device", "all", { client: liveClient(USER_B) }), []);
    assert.equal(await getLinkBreakdown("not-a-uuid", "device", "all", { client: liveClient(USER_A) }), null);
  });

  it("getAccountMetrics always returns a state object", async () => {
    const a = await getAccountMetrics("all", { client: liveClient(USER_A) });
    assert.equal(a.hasData, true);
    assert.ok(a.totalRequests >= 14 && a.linksClicked >= 3);
    const empty = await getAccountMetrics("all", { client: null });
    assert.equal(empty.hasData, false);
  });

  it("cached metrics isolate users (no cross-user serving)", async () => {
    const cache = createAnalyticsCache(60_000);
    let calls = 0;
    const counting = {
      rpc: async () => {
        calls += 1;
        return { data: [], error: null as { message: string } | null };
      },
    };
    await getCachedLinkMetrics(USER_A, linkA1, "24h", { client: counting, cache });
    await getCachedLinkMetrics(USER_A, linkA1, "24h", { client: counting, cache });
    assert.equal(calls, 1);
    await getCachedLinkMetrics(USER_B, linkA1, "24h", { client: counting, cache });
    assert.equal(calls, 2);
  });
});
