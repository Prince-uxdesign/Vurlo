import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { getAccountTrend, getLinksClicks, getRecentActivity, getTopLinks } from "@/lib/dashboard/queries";
import { TREND_DAYS, activityLabel, toActivity, trendWindow } from "@/lib/dashboard/shape";
import { createTestDb } from "./helpers/pglite-client";

/**
 * Phase 7 dashboard aggregates against real Postgres with every migration
 * applied. Each number the dashboard shows is checked against an independent
 * raw count, and every function is checked for ownership isolation.
 */

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let db: PGlite;
const ids: Record<string, string> = {};

async function as<T>(role: "anon" | "authenticated", sub: string | null, fn: () => Promise<T>) {
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

const q = (sub: string, sql: string, params: unknown[] = []) =>
  as("authenticated", sub, () => db.query<Record<string, unknown>>(sql, params)).then((r) => r.rows);

/** Same shim as the Phase 6 wrapper tests: real functions, caller's role. */
const liveClient = (sub: string) => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    const names = Object.keys(args);
    const placeholders = names.map((n, i) => `${n} => $${i + 1}`).join(", ");
    try {
      const result = await as("authenticated", sub, () =>
        db.query(`select * from public.${fn}(${placeholders})`, Object.values(args)),
      );
      return { data: result.rows, error: null as { message: string } | null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },
});

async function events(slug: string, rows: Array<[age: string, traffic: string]>) {
  for (const [age, traffic] of rows) {
    await db.exec(
      `insert into public.link_events (link_id, occurred_at, traffic_class, is_bot)
       select l.id, now() - interval '${age}', '${traffic}', ${traffic === "bot" || traffic === "scanner"}
       from public.links l where l.slug = '${slug}'`,
    );
  }
}

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}')`);
  await db.exec(
    `insert into public.links (slug, destination_url, user_id, created_at, updated_at, expires_at)
     select slug, 'https://example.com/' || slug, owner::uuid, now() - age::interval, now() - age::interval, expires
     from (values
       ('p-hot',   '${USER_A}', '20 days',  null::timestamptz),
       ('p-warm',  '${USER_A}', '10 days',  null),
       ('p-new',   '${USER_A}', '1 minute', now() + interval '3 days'),
       ('p-off',   '${USER_A}', '15 days',  null),
       ('p-gone',  '${USER_A}', '15 days',  null),
       ('p-other', '${USER_B}', '15 days',  null)
     ) as seed(slug, owner, age, expires)`,
  );
  // Owned links can't be created already expired, so expire an anonymous one and adopt it.
  await db.exec(
    `insert into public.links (slug, destination_url, created_at, expires_at)
       values ('p-old', 'https://example.com/old', now() - interval '12 days', now() - interval '2 days');
     update public.links set user_id = '${USER_A}' where slug = 'p-old';
     update public.links set status = 'disabled' where slug = 'p-off';
     update public.links set status = 'deleted' where slug = 'p-gone'`,
  );
  const { rows } = await db.query<{ id: string; slug: string }>("select id, slug from public.links where slug like 'p-%'");
  for (const r of rows) ids[r.slug] = r.id;

  await events("p-hot", [
    ["10 minutes", "human"], ["2 hours", "human"], ["5 hours", "human"], ["30 hours", "human"],
    ["3 days", "human"], ["45 days", "human"], ["1 hour", "bot"], ["1 hour", "scanner"], ["1 hour", "unknown"],
  ]);
  await events("p-warm", [["20 hours", "human"], ["4 days", "human"]]);
  await events("p-gone", [["1 hour", "human"], ["1 hour", "human"]]);
  await events("p-other", [["1 hour", "human"], ["2 days", "human"]]);
});

after(async () => {
  await db.close();
});

describe("my_links_clicks", () => {
  it("counts all-time human clicks per owned link and ignores automation", async () => {
    const rows = await q(USER_A, "select * from public.my_links_clicks($1)", [[ids["p-hot"], ids["p-warm"], ids["p-new"]]]);
    const by = Object.fromEntries(rows.map((r) => [r.link_id, Number(r.human_clicks)]));
    assert.equal(by[ids["p-hot"]!], 6, "6 human clicks; bot/scanner/unknown excluded");
    assert.equal(by[ids["p-warm"]!], 2);
    assert.equal(by[ids["p-new"]!], 0, "owned link with no clicks reports 0, not missing");
    const hot = rows.find((r) => r.link_id === ids["p-hot"])!;
    assert.ok(hot.last_clicked_at, "last human click reported");
  });

  it("never returns another user's or a deleted link", async () => {
    const rows = await q(USER_A, "select * from public.my_links_clicks($1)", [[ids["p-other"], ids["p-gone"]]]);
    assert.equal(rows.length, 0);
    assert.equal(await code(() => as("anon", null, () => db.query("select * from public.my_links_clicks($1)", [[ids["p-hot"]]]))), "42501");
  });

  it("reads at most 100 ids", async () => {
    const many = Array.from({ length: 150 }, () => "00000000-0000-4000-8000-000000000000");
    many[120] = ids["p-hot"]!;
    const rows = await q(USER_A, "select * from public.my_links_clicks($1)", [many]);
    assert.equal(rows.length, 0, "an id past the 100th is not read");
  });
});

describe("my_account_timeseries", () => {
  it("returns exactly one bucket per day of the dashboard window, summing to the raw count", async () => {
    const now = new Date();
    const { start, end } = trendWindow(now);
    const rows = await q(USER_A, "select * from public.my_account_timeseries($1, $2)", [start.toISOString(), end.toISOString()]);
    assert.equal(rows.length, TREND_DAYS);
    assert.equal(new Date(String(rows[0]!.bucket_start instanceof Date ? (rows[0]!.bucket_start as Date).toISOString() : rows[0]!.bucket_start)).toISOString(), start.toISOString(), "first bucket is UTC midnight");
    const human = rows.reduce((s, r) => s + Number(r.human), 0);
    const raw = await db.query<{ n: string }>(
      `select count(*) as n from public.link_events e join public.links l on l.id = e.link_id
       where l.user_id = $1 and l.status <> 'deleted' and e.traffic_class = 'human'
         and e.occurred_at >= $2 and e.occurred_at < $3`,
      [USER_A, start.toISOString(), end.toISOString()],
    );
    assert.equal(human, Number(raw.rows[0]!.n));
    assert.equal(human, 7, "hot 5 in window + warm 2; the 45-day click and deleted link's clicks are out");
  });

  it("buckets by UTC day whatever the session time zone", async () => {
    const { start, end } = trendWindow();
    await db.exec("set timezone = 'Pacific/Kiritimati'"); // UTC+14
    try {
      const rows = await q(USER_A, "select * from public.my_account_timeseries($1, $2)", [start.toISOString(), end.toISOString()]);
      assert.equal(rows.length, TREND_DAYS);
      assert.equal(rows.reduce((s, r) => s + Number(r.human), 0), 7);
    } finally {
      await db.exec("reset timezone");
    }
  });

  it("isolates users, rejects oversized windows, refuses anon", async () => {
    const { start, end } = trendWindow();
    const b = await q(USER_B, "select * from public.my_account_timeseries($1, $2)", [start.toISOString(), end.toISOString()]);
    assert.equal(b.reduce((s, r) => s + Number(r.human), 0), 2);
    const huge = await q(USER_A, "select * from public.my_account_timeseries(now() - interval '400 days', now())");
    assert.equal(huge.length, 0);
    assert.equal(await code(() => as("anon", null, () => db.query("select * from public.my_account_timeseries(now() - interval '1 day', now())"))), "42501");
  });
});

describe("my_top_links", () => {
  it("ranks owned links by human clicks in the window and leaves out zeros", async () => {
    const rows = await q(USER_A, "select * from public.my_top_links(now() - interval '30 days', now(), 5)");
    assert.deepEqual(rows.map((r) => [r.slug, Number(r.human_clicks)]), [["p-hot", 5], ["p-warm", 2]]);
  });

  it("clamps the limit and isolates users", async () => {
    const one = await q(USER_A, "select * from public.my_top_links(null, null, 0)");
    assert.equal(one.length, 1);
    const b = await q(USER_B, "select * from public.my_top_links(null, null, 50)");
    assert.deepEqual(b.map((r) => r.slug), ["p-other"]);
  });
});

describe("my_recent_activity", () => {
  it("derives each link's latest change plus a 24-hour click summary, newest first", async () => {
    const rows = await q(USER_A, "select * from public.my_recent_activity(20)");
    const items = toActivity(rows);
    const kinds = Object.fromEntries(items.filter((i) => i.kind !== "clicked").map((i) => [i.slug, i.kind]));
    assert.equal(kinds["p-new"], "created");
    assert.equal(kinds["p-off"], "disabled");
    assert.equal(kinds["p-old"], "expired");
    assert.equal(kinds["p-hot"], "created");
    assert.equal(kinds["p-gone"], undefined, "deleted links never appear");

    const clicked = items.filter((i) => i.kind === "clicked");
    assert.deepEqual(clicked.map((i) => [i.slug, i.clicks]).sort(), [["p-hot", 3], ["p-warm", 1]]);
    assert.equal(activityLabel(clicked.find((i) => i.slug === "p-hot")!), "3 clicks in the last 24 hours");

    const times = items.map((i) => new Date(i.occurredAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a), "newest first");
  });

  it("clamps the limit and isolates users", async () => {
    assert.equal((await q(USER_A, "select * from public.my_recent_activity(2)")).length, 2);
    assert.equal((await q(USER_A, "select * from public.my_recent_activity(500)")).length, 7, "5 lifecycle rows (deleted excluded) + 2 clicked rows, under the cap");
    const b = toActivity(await q(USER_B, "select * from public.my_recent_activity(20)"));
    assert.ok(b.every((i) => i.slug === "p-other"));
    assert.equal(await code(() => as("anon", null, () => db.query("select * from public.my_recent_activity(5)"))), "42501");
  });
});

describe("dashboard query wrappers", () => {
  it("map real rows and stay fail-safe", async () => {
    const clicks = await getLinksClicks(liveClient(USER_A), [ids["p-hot"]!, "not-a-uuid"]);
    assert.equal(clicks?.get(ids["p-hot"]!)?.clicks, 6);
    assert.equal((await getLinksClicks(liveClient(USER_A), []))?.size, 0);
    assert.equal(await getLinksClicks(null, [ids["p-hot"]!]), null, "no client: unknown, not zero");

    const trend = await getAccountTrend(liveClient(USER_A));
    assert.equal(trend?.length, TREND_DAYS);

    const top = await getTopLinks(liveClient(USER_A));
    assert.equal(top?.[0]?.slug, "p-hot");

    const activity = await getRecentActivity(liveClient(USER_A), 3);
    assert.equal(activity?.length, 3);

    const broken = { rpc: async () => ({ data: null, error: { message: "boom" } }) };
    assert.equal(await getRecentActivity(broken), null);
    assert.equal(await getAccountTrend(broken), null);
  });
});
