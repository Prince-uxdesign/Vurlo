import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./helpers/pglite-client";

/**
 * Phase 8A authorization matrix, against real Postgres with every migration
 * and Supabase's roles. The UI hides other users' links, but that is not a
 * control: these tests go straight at the database the way someone holding
 * a valid session token (or the public anon key) could, via PostgREST.
 */

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: PGlite;
let linkB = "";
let linkA = "";
let goneA = "";

type Role = "anon" | "authenticated" | "service_role";

async function as<T>(role: Role, sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ""}', false)`);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/** "ok" with the row count, or the SQLSTATE of the failure. */
async function attempt(role: Role, sub: string | null, sql: string, params: unknown[] = []): Promise<string> {
  try {
    const r = await as(role, sub, () => db.query(sql, params));
    return `ok:${r.rows.length}${r.affectedRows ? `/${r.affectedRows}` : ""}`;
  } catch (error) {
    return (error as { code?: string }).code ?? "error";
  }
}

const denied = (result: string) => result === "42501";
const emptyOk = (result: string) => result === "ok:0" || result === "ok:0/0";

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}')`);
  await db.exec(
    `insert into public.links (slug, destination_url, user_id) values
       ('sec-a', 'https://example.com/a', '${USER_A}'),
       ('sec-gone', 'https://example.com/gone', '${USER_A}'),
       ('sec-b', 'https://example.com/b', '${USER_B}');
     update public.links set status = 'deleted' where slug = 'sec-gone';
     insert into public.link_events (link_id, traffic_class, is_bot)
       select id, 'human', false from public.links where slug = 'sec-b';`,
  );
  const { rows } = await db.query<{ id: string; slug: string }>("select id, slug from public.links");
  for (const r of rows) {
    if (r.slug === "sec-a") linkA = r.id;
    if (r.slug === "sec-b") linkB = r.id;
    if (r.slug === "sec-gone") goneA = r.id;
  }
});

after(async () => {
  await db.close();
});

describe("User A against User B's link", () => {
  it("can't see it", async () => {
    assert.ok(emptyOk(await attempt("authenticated", USER_A, "select * from public.links where id = $1", [linkB])));
    const list = await as("authenticated", USER_A, () => db.query<{ slug: string }>("select slug from public.list_my_links(null, 'all', 'newest', 100, 0)"));
    assert.ok(!list.rows.some((r) => r.slug === "sec-b"));
  });

  it("can't edit, disable, archive, rename or delete it", async () => {
    for (const set of ["destination_url = 'https://evil.example/'", "status = 'disabled'", "status = 'archived'", "status = 'deleted'", "slug = 'stolen-b'", "expires_at = now() + interval '1 day'"]) {
      const r = await attempt("authenticated", USER_A, `update public.links set ${set} where id = $1`, [linkB]);
      assert.ok(emptyOk(r) || denied(r), `${set}: ${r}`);
    }
    assert.ok(denied(await attempt("authenticated", USER_A, "delete from public.links where id = $1", [linkB])), "no DELETE privilege at all");
    const { rows } = await db.query<{ status: string; destination_url: string; slug: string }>("select status, destination_url, slug from public.links where id = $1", [linkB]);
    assert.deepEqual(rows[0], { status: "active", destination_url: "https://example.com/b", slug: "sec-b" }, "B's link untouched");
  });

  it("can't take it over", async () => {
    assert.ok(denied(await attempt("authenticated", USER_A, "update public.links set user_id = $1 where id = $2", [USER_A, linkB])));
    assert.ok(denied(await attempt("authenticated", USER_A, "update public.links set user_id = $1 where id = $2", [USER_B, linkA])), "can't hand links to others either");
    assert.ok(denied(await attempt("authenticated", USER_A, "insert into public.links (slug, destination_url, user_id) values ('forged', 'https://example.com', $1)", [USER_B])));
  });

  it("can't read its analytics through any function", async () => {
    const calls: Array<[string, unknown[]]> = [
      ["select * from public.my_link_metrics($1, null, null)", [linkB]],
      ["select * from public.my_link_timeseries($1, now() - interval '1 day', now(), 'hour')", [linkB]],
      ["select * from public.my_link_breakdown($1, 'country', null, null)", [linkB]],
      ["select * from public.my_links_clicks($1)", [[linkB]]],
    ];
    for (const [sql, params] of calls) {
      assert.ok(emptyOk(await attempt("authenticated", USER_A, sql, params)), sql);
    }
    const owns = await as("authenticated", USER_A, () => db.query<{ o: boolean }>("select public.owns_link($1) as o", [linkB]));
    assert.equal(owns.rows[0]!.o, false);
    for (const sql of ["select * from public.my_top_links(null, null, 10)", "select * from public.my_recent_activity(20)"]) {
      const { rows } = await as("authenticated", USER_A, () => db.query<{ slug: string }>(sql));
      assert.ok(!rows.some((r) => r.slug === "sec-b"), sql);
    }
    const account = await as("authenticated", USER_A, () => db.query<{ total_requests: number }>("select * from public.my_account_metrics(null, null)"));
    assert.equal(Number(account.rows[0]!.total_requests), 0, "B's click isn't in A's totals");
  });

  it("can't read raw events, visitor hashes or internal tables", async () => {
    for (const table of ["link_events", "rate_limits", "retired_slugs"]) {
      assert.ok(denied(await attempt("authenticated", USER_A, `select * from public.${table}`)), table);
    }
    assert.ok(emptyOk(await attempt("authenticated", USER_A, "select * from public.profiles where id = $1", [USER_B])));
  });
});

describe("the public anon key", () => {
  it("can't read or write any table", async () => {
    for (const table of ["links", "link_events", "profiles", "rate_limits", "retired_slugs"]) {
      assert.ok(denied(await attempt("anon", null, `select * from public.${table}`)), table);
    }
    assert.ok(denied(await attempt("anon", null, "insert into public.links (slug, destination_url) values ('anon-x', 'https://example.com')")));
  });

  it("can't forge clicks (record_link_event is server-only)", async () => {
    const forge = "select public.record_link_event('sec-b', 'desktop', 'chrome', 'windows', 'US', 'google', 'human', false, null)";
    assert.ok(denied(await attempt("anon", null, forge)));
    assert.ok(denied(await attempt("authenticated", USER_A, forge)));
    assert.equal(await attempt("service_role", null, forge), "ok:1", "the redirect server still records");
  });

  it("can't call account, analytics, alias-oracle or limiter functions", async () => {
    for (const sql of [
      "select * from public.list_my_links(null, 'all', 'newest', 10, 0)",
      "select * from public.my_link_stats()",
      "select * from public.my_account_metrics(null, null)",
      "select * from public.my_link_metrics('00000000-0000-4000-8000-000000000000', null, null)",
      "select * from public.my_recent_activity(5)",
      "select * from public.is_slug_taken('sec-a')",
      "select * from public.consume_rate_limit('k', 1, 60)",
    ]) {
      assert.ok(denied(await attempt("anon", null, sql)), sql);
    }
    for (const sql of ["select * from public.is_slug_taken('sec-a')", "select * from public.consume_rate_limit('k', 1, 60)"]) {
      assert.ok(denied(await attempt("authenticated", USER_A, sql)), `authenticated: ${sql}`);
    }
  });

  it("resolves only what a visitor needs, and nothing for deleted links", async () => {
    const active = await as("anon", null, () => db.query<Record<string, unknown>>("select * from public.resolve_link('sec-b')"));
    assert.deepEqual(Object.keys(active.rows[0]!).sort(), ["destination_url", "status", "utm_campaign", "utm_medium", "utm_source"], "no ids, owner or timestamps");
    const gone = await as("anon", null, () => db.query<{ status: string; destination_url: string | null }>("select * from public.resolve_link('sec-gone')"));
    assert.equal(gone.rows[0]!.destination_url, null, "a deleted link's destination never leaves the database");
  });

  it("new functions aren't callable by API roles unless a migration grants them", async () => {
    await db.exec("create function public.zz_probe() returns int language sql as 'select 1'");
    assert.ok(denied(await attempt("anon", null, "select public.zz_probe()")));
    assert.ok(denied(await attempt("authenticated", USER_A, "select public.zz_probe()")));
    await db.exec("drop function public.zz_probe()");
  });
});

describe("owners editing their own rows directly", () => {
  it("still can't store an unsafe destination or a reserved/deleted state change", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "https://u:p@example.com", "//evil.com", "https://example.com/a b"]) {
      assert.equal(await attempt("authenticated", USER_A, "update public.links set destination_url = $1 where id = $2", [bad, linkA]), "23514", bad);
    }
    assert.equal(await attempt("authenticated", USER_A, "update public.links set slug = 'forgot-password' where id = $1", [linkA]), "23514", "reserved route");
    assert.equal(await attempt("authenticated", USER_A, "update public.links set status = 'active' where id = $1", [goneA]), "P0001", "deleted links are terminal (link_deleted)");
  });

  it("an alias can't be claimed twice, whatever the case", async () => {
    assert.equal(await attempt("service_role", null, "insert into public.links (slug, destination_url, user_id) values ('sec-a', 'https://example.com', $1)", [USER_B]), "23505");
    assert.equal(await attempt("service_role", null, "insert into public.links (slug, destination_url, user_id) values ('SEC-A', 'https://example.com', $1)", [USER_B]), "23514", "uppercase never reaches the table");
  });
});

describe("profile settings (Phase 9)", () => {
  it("owners change only their expiry preference, only on their own row", async () => {
    assert.equal(await attempt("authenticated", USER_A, "update public.profiles set default_link_expiration = 'never' where id = $1", [USER_A]), "ok:0/1");
    const mine = await db.query<{ d: string }>("select default_link_expiration as d from public.profiles where id = $1", [USER_A]);
    assert.equal(mine.rows[0]!.d, "never");
    assert.ok(emptyOk(await attempt("authenticated", USER_A, "update public.profiles set default_link_expiration = '1d' where id = $1", [USER_B])), "not B's");
    const theirs = await db.query<{ d: string }>("select default_link_expiration as d from public.profiles where id = $1", [USER_B]);
    assert.equal(theirs.rows[0]!.d, "30d");
  });

  it("can't touch email, id or created_at, or store junk", async () => {
    for (const set of ["email = 'x@evil.example'", "created_at = now() - interval '9 years'", `id = '${USER_B}'`]) {
      assert.ok(denied(await attempt("authenticated", USER_A, `update public.profiles set ${set} where id = $1`, [USER_A])), set);
    }
    assert.equal(await attempt("authenticated", USER_A, "update public.profiles set default_link_expiration = 'forever' where id = $1", [USER_A]), "23514");
    assert.ok(denied(await attempt("anon", null, "update public.profiles set default_link_expiration = 'never'")));
    assert.ok(denied(await attempt("authenticated", USER_A, "delete from public.profiles where id = $1", [USER_A])));
  });
});
