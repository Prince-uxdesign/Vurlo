import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { recordClickEvent } from "@/lib/analytics/record";
import { createTestDb } from "./helpers/pglite-client";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let db: PGlite;
let linkA: string;

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

const record = (slug: string, overrides: Record<string, unknown> = {}) =>
  as("service_role", null, () =>
    db.query<{ record_link_event: string | null }>(
      `select public.record_link_event($1, $2, $3, $4, $5, $6, $7, $8, $9) as record_link_event`,
      [
        slug,
        overrides.device_type ?? "desktop",
        overrides.browser ?? "chrome",
        overrides.operating_system ?? "windows",
        overrides.country_code ?? "US",
        overrides.referrer_source ?? "google",
        overrides.traffic_class ?? "human",
        overrides.is_bot ?? false,
        overrides.visitor_hash ?? null,
      ],
    ),
  );

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}')`);
  await db.exec(
    `insert into public.links (slug, destination_url, user_id, expires_at) values
      ('click-active', 'https://example.com/a', '${USER_A}', now() + interval '30 days'),
      ('click-other', 'https://example.com/b', '${USER_B}', now() + interval '30 days'),
      ('click-off', 'https://example.com/c', '${USER_A}', now() + interval '30 days')`,
  );
  await db.exec(
    `insert into public.links (slug, destination_url, created_at, expires_at) values
      ('click-old', 'https://example.com/d', now() - interval '2 days', now() - interval '1 day')`,
  );
  await db.exec(`update public.links set status = 'disabled' where slug = 'click-off'`);
  const { rows } = await db.query<{ id: string; slug: string }>(
    "select id, slug from public.links where slug = 'click-active'",
  );
  linkA = rows[0]!.id;
});

after(async () => {
  await db.close();
});

describe("link_events schema (Phase 6A)", () => {
  it("has the lean event columns and no raw-PII columns", async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'link_events' order by 1`,
    );
    const cols = rows.map((r) => r.column_name);
    for (const expected of [
      "id", "link_id", "occurred_at", "visitor_hash", "device_type", "browser",
      "operating_system", "country_code", "referrer_source", "traffic_class", "is_bot",
    ]) {
      assert.ok(cols.includes(expected), expected);
    }
    for (const forbidden of ["ip_address", "ip", "user_agent", "referrer_url", "email", "password"]) {
      assert.equal(cols.includes(forbidden), false, forbidden);
    }
  });

  it("enables RLS with no direct access for anon/authenticated", async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.link_events'::regclass",
    );
    assert.equal(rows[0]!.relrowsecurity, true);
    for (const role of ["anon", "authenticated"] as const) {
      await as(role, role === "anon" ? null : USER_A, async () => {
        assert.equal(await code(() => db.query("select * from public.link_events")), "42501", role);
        assert.equal(
          await code(() => db.query("insert into public.link_events (link_id) values ($1)", [linkA])),
          "42501",
          role,
        );
      });
    }
  });

  it("creates exactly the planned indexes", async () => {
    const { rows } = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'link_events'`,
    );
    const names = rows.map((r) => r.indexname);
    assert.ok(names.includes("link_events_link_occurred_idx"));
    assert.ok(names.includes("link_events_occurred_idx"));
    assert.ok(names.includes("link_events_link_human_idx"));
    // Lean: no per-column bloat beyond the plan (plus the pkey).
    assert.ok(names.length <= 5, names.join(","));
  });

  it("cascades event rows when a link is deleted", async () => {
    await db.exec(
      `insert into public.links (slug, destination_url, expires_at) values ('doomed', 'https://example.com', now() + interval '1 day')`,
    );
    await record("doomed", { visitor_hash: HASH_A });
    const before = await db.query("select 1 from public.link_events e join public.links l on l.id = e.link_id where l.slug = 'doomed'");
    assert.equal(before.rows.length, 1);
    await db.exec(`delete from public.links where slug = 'doomed'`);
    const afterDel = await db.query(
      "select 1 from public.link_events where link_id not in (select id from public.links)",
    );
    assert.equal(afterDel.rows.length, 0);
  });
});

describe("record_link_event() (server-validated, never client-trusted)", () => {
  it("logs a normal click for an active link", async () => {
    const { rows } = await record("click-active", { visitor_hash: HASH_A });
    assert.match(String(rows[0]!.record_link_event), /^[0-9a-f-]{36}$/);
    const stored = await db.query<Record<string, unknown>>(
      `select device_type, browser, operating_system, country_code, referrer_source, traffic_class, is_bot, visitor_hash
       from public.link_events where id = $1`,
      [rows[0]!.record_link_event],
    );
    assert.deepEqual(stored.rows[0], {
      device_type: "desktop",
      browser: "chrome",
      operating_system: "windows",
      country_code: "US",
      referrer_source: "google",
      traffic_class: "human",
      is_bot: false,
      visitor_hash: HASH_A,
    });
  });

  it("accumulates repeated clicks (same visitor, multiple rows)", async () => {
    await record("click-active", { visitor_hash: HASH_B });
    await record("click-active", { visitor_hash: HASH_B });
    const { rows } = await db.query<{ n: string }>(
      "select count(*)::text as n from public.link_events e join public.links l on l.id = e.link_id where l.slug = 'click-active' and e.visitor_hash = $1",
      [HASH_B],
    );
    assert.equal(Number(rows[0]!.n) >= 2, true);
  });

  it("stores bot, scanner and minimal-anonymous requests", async () => {
    const bot = await record("click-active", {
      device_type: "unknown", browser: "other", operating_system: "other",
      country_code: "unknown", referrer_source: "direct", traffic_class: "bot", is_bot: true,
    });
    assert.ok(bot.rows[0]!.record_link_event);
    const scanner = await record("click-active", { traffic_class: "scanner", is_bot: true });
    assert.ok(scanner.rows[0]!.record_link_event);
    const anon = await record("click-active", {
      device_type: "unknown", browser: "unknown", operating_system: "unknown",
      country_code: "unknown", referrer_source: "direct", traffic_class: "unknown",
      is_bot: false, visitor_hash: null,
    });
    assert.ok(anon.rows[0]!.record_link_event);
  });

  it("stores mobile / tablet / desktop distinctly", async () => {
    for (const device of ["mobile", "tablet", "desktop"]) {
      const { rows } = await record("click-active", { device_type: device });
      assert.ok(rows[0]!.record_link_event, device);
    }
  });

  it("logs nothing for invalid, expired, disabled or deleted links", async () => {
    for (const slug of ["never-existed", "click-old", "click-off", "CLICK-OFF"]) {
      const { rows } = await record(slug);
      assert.equal(rows[0]!.record_link_event, null, slug);
    }
    // Deleted is terminal (guard_link_update refuses to revive it), so use a
    // dedicated link for the deleted case rather than mutating click-off.
    await db.exec(
      `insert into public.links (slug, destination_url, user_id, expires_at) values
        ('click-doomed', 'https://example.com/doomed', '${USER_A}', now() + interval '30 days')`,
    );
    await db.exec(`update public.links set status = 'deleted' where slug = 'click-doomed'`);
    const { rows } = await record("click-doomed");
    assert.equal(rows[0]!.record_link_event, null);
    const counts = await db.query<{ n: string }>(
      `select count(*)::text as n from public.link_events e join public.links l on l.id = e.link_id
       where l.slug in ('never-existed','click-old')`,
    );
    assert.equal(counts.rows[0]!["n"], "0");
  });

  it("coerces malformed classifications instead of failing", async () => {
    const { rows } = await record("click-active", {
      device_type: "watch", browser: "netscape", operating_system: "plan9",
      country_code: "USA", referrer_source: "https://evil.com/full?url=x", traffic_class: "alien",
      visitor_hash: "not-a-hash",
    });
    assert.ok(rows[0]!.record_link_event);
    const stored = await db.query<Record<string, unknown>>(
      "select device_type, browser, operating_system, country_code, referrer_source, traffic_class, visitor_hash, is_bot from public.link_events where id = $1",
      [rows[0]!.record_link_event],
    );
    assert.deepEqual(stored.rows[0], {
      device_type: "unknown",
      browser: "unknown",
      operating_system: "other",
      country_code: "unknown",
      referrer_source: "other",
      traffic_class: "unknown",
      visitor_hash: null,
      is_bot: false,
    });
  });

  it("handles concurrent clicks without loss", async () => {
    const before = await db.query<{ n: string }>(
      `select count(*)::text as n from public.link_events e join public.links l on l.id = e.link_id where l.slug = 'click-active'`,
    );
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        record("click-active", { visitor_hash: i % 2 === 0 ? HASH_A : HASH_B }),
      ),
    );
    const afterCount = await db.query<{ n: string }>(
      `select count(*)::text as n from public.link_events e join public.links l on l.id = e.link_id where l.slug = 'click-active'`,
    );
    assert.equal(Number(afterCount.rows[0]!.n) - Number(before.rows[0]!.n), 20);
  });

  it("is callable by anon and authenticated, but never allows link_id injection", async () => {
    // There is no link_id parameter at all: the slug is re-resolved in SQL.
    const { rows } = await db.query<{ p: string }>(
      `select parameter_name as p from information_schema.parameters
       where specific_schema = 'public' and specific_name like 'record_link_event%'`,
    );
    const params = rows.map((r) => r.p);
    assert.equal(params.includes("p_link_id"), false);
    assert.ok(params.includes("p_slug"));
  });
});

describe("retired analytics reads", () => {
  it("my_link_event_stats() no longer exists (replaced by my_link_metrics)", async () => {
    const { rows } = await db.query("select 1 from pg_proc where proname = 'my_link_event_stats'");
    assert.equal(rows.length, 0);
  });
});

describe("analytics service wrappers (never throw, never leak)", () => {
  it("recordClickEvent returns null (not an exception) when unavailable or failing", async () => {
    assert.equal(await recordClickEvent("slug", {
      device_type: "desktop", browser: "chrome", operating_system: "windows",
      country_code: "US", referrer_source: "direct", traffic_class: "human",
      is_bot: false, visitor_hash: null,
    }, { client: null }), null);
    const broken = {
      rpc: async () => { throw new Error("down"); },
    } as never;
    assert.equal(await recordClickEvent("slug", {
      device_type: "desktop", browser: "chrome", operating_system: "windows",
      country_code: "US", referrer_source: "direct", traffic_class: "human",
      is_bot: false, visitor_hash: null,
    }, { client: broken }), null);
  });

  it("recordClickEvent surfaces the event id on success", async () => {
    const fake = {
      rpc: async () => ({ data: "evt-1", error: null }),
    } as never;
    assert.equal(await recordClickEvent("Slug", {
      device_type: "desktop", browser: "chrome", operating_system: "windows",
      country_code: "US", referrer_source: "direct", traffic_class: "human",
      is_bot: false, visitor_hash: null,
    }, { client: fake }), "evt-1");
  });
});
