import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { RESERVED_SLUGS } from "@/lib/links/reserved-slugs";

/**
 * Runs the real migration against in-process Postgres. Supabase's `auth`
 * schema and roles are stubbed the same way Supabase defines them, so
 * privileges and RLS are exercised for real (as anon / authenticated /
 * service_role), not simulated.
 */
const MIGRATION = readFileSync(
  new URL("../supabase/migrations/20260925120000_create_links.sql", import.meta.url),
  "utf8",
);

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let db: PGlite;

async function as<T>(role: "anon" | "authenticated" | "service_role", sub: string | null, fn: () => Promise<T>) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ""}', false)`);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

/** Resolves to the Postgres error code (SQLSTATE) or "ok". */
async function code(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

const insert = (slug: string, extra = "") =>
  db.query(
    `insert into public.links (slug, destination_url ${extra ? ", " + extra.split("=")[0] : ""})
     values ($1, 'https://example.com/page' ${extra ? ", " + extra.split("=")[1] : ""})`,
    [slug],
  );

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    -- Supabase's default privileges: new public tables are open to API roles.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
  `);
  await db.exec(MIGRATION);
});

after(async () => {
  await db.close();
});

describe("schema and constraints (service role)", () => {
  it("inserts a valid anonymous link with sensible defaults", async () => {
    await as("service_role", null, () => insert("first-link"));
    const { rows } = await db.query<Record<string, unknown>>(
      "select * from public.links where slug = 'first-link'",
    );
    const row = rows[0];
    assert.equal(row.user_id, null);
    assert.equal(row.status, "active");
    assert.equal(row.is_custom_alias, false);
    assert.equal(row.expires_at, null);
    assert.match(String(row.id), /^[0-9a-f-]{36}$/);
    assert.ok(row.created_at && row.updated_at);
  });

  it("stores an owned link and cascades on user deletion", async () => {
    await as("service_role", null, () => insert("owned-1", `user_id='${USER_B}'`));
    const ok = await db.query("select 1 from public.links where slug = 'owned-1'");
    assert.equal(ok.rows.length, 1);
    await db.exec("insert into auth.users (id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc')");
    await db.exec("insert into public.links (slug, destination_url, user_id) values ('gone-1','https://example.com','cccccccc-cccc-4ccc-8ccc-cccccccccccc')");
    await db.exec("delete from auth.users where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'");
    const gone = await db.query("select 1 from public.links where slug = 'gone-1'");
    assert.equal(gone.rows.length, 0);
  });

  it("rejects an unknown owner (foreign key)", async () => {
    const c = await as("service_role", null, () =>
      code(() => insert("bad-owner", `user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'`)),
    );
    assert.equal(c, "23503");
  });

  it("enforces unique slugs", async () => {
    await as("service_role", null, () => insert("dupe-slug"));
    const c = await as("service_role", null, () => code(() => insert("dupe-slug")));
    assert.equal(c, "23505");
  });

  it("holds under concurrent inserts of the same slug", async () => {
    const results = await as("service_role", null, () =>
      Promise.all(Array.from({ length: 8 }, () => code(() => insert("race-slug")))),
    );
    assert.equal(results.filter((r) => r === "ok").length, 1);
    assert.equal(results.filter((r) => r === "23505").length, 7);
  });

  it("keeps a deleted link's slug reserved", async () => {
    await as("service_role", null, () => insert("was-deleted"));
    await db.exec("update public.links set status = 'deleted' where slug = 'was-deleted'");
    const c = await as("service_role", null, () => code(() => insert("was-deleted")));
    assert.equal(c, "23505");
  });

  it("rejects invalid slugs", async () => {
    for (const bad of ["ab", "UPPER", "Mixed-Case", "has space", "-lead", "a/b", "a.b", "x".repeat(33), "emoji😀x", "", "<script>"]) {
      const c = await as("service_role", null, () => code(() => insert(bad)));
      assert.equal(c, "23514", JSON.stringify(bad));
    }
  });

  it("rejects reserved slugs", async () => {
    for (const bad of ["api", "dashboard", "login", "admin", "privacy", "terms", "sitemap", "robots", "favicon"]) {
      const c = await as("service_role", null, () => code(() => insert(bad)));
      assert.equal(c, "23514", bad);
    }
  });

  it("keeps SQL and TypeScript reserved-slug lists identical", async () => {
    const sql = MIGRATION.split("array[")[1].split("]")[0];
    const inSql = [...sql.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(inSql, [...RESERVED_SLUGS].sort());
    for (const slug of RESERVED_SLUGS) {
      const { rows } = await db.query<{ r: boolean }>("select public.is_reserved_slug($1) as r", [slug.toUpperCase()]);
      assert.equal(rows[0].r, true, slug);
    }
  });

  it("rejects unsafe or malformed destinations", async () => {
    const bad = [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com/x",
      "file:///etc/passwd",
      "http://",
      "https://",
      "https://user:pass@example.com",
      "https://google.com@evil.com",
      "https://exa mple.com",
      "https://example.com/a b",
      "//evil.com",
      "example.com",
      `https://example.com/${"a".repeat(2100)}`,
    ];
    for (const url of bad) {
      const c = await code(() =>
        db.query("insert into public.links (slug, destination_url) values ($1, $2)", [`d-${Math.random().toString(36).slice(2, 9)}`, url]),
      );
      assert.equal(c, "23514", url.slice(0, 40));
    }
    const good = await code(() =>
      db.query("insert into public.links (slug, destination_url) values ('d-good1', 'https://example.com/a?b=c@d#e')"),
    );
    assert.equal(good, "ok");
  });

  it("validates status values", async () => {
    for (const status of ["active", "expired", "disabled", "archived", "deleted"]) {
      const c = await code(() => insert(`st-${status}`, `status='${status}'`));
      assert.equal(c, "ok", status);
    }
    assert.equal(await code(() => insert("st-bogus", "status='paused'")), "23514");
    assert.equal(await code(() => insert("st-null", "status=null")), "23502");
  });

  it("validates expiry and UTM values", async () => {
    assert.equal(await code(() => insert("exp-future", "expires_at=now() + interval '1 day'")), "ok");
    assert.equal(await code(() => insert("exp-past", "expires_at=now() - interval '1 day'")), "23514");
    assert.equal(await code(() => insert("utm-ok", "utm_source='newsletter'")), "ok");
    assert.equal(await code(() => insert("utm-empty", "utm_source=''")), "23514");
    assert.equal(await code(() => insert("utm-long", `utm_campaign='${"x".repeat(101)}'`)), "23514");
  });

  it("derives expired status deterministically", async () => {
    await db.exec(`insert into public.links (slug, destination_url, created_at, expires_at)
      values ('long-gone', 'https://example.com', now() - interval '2 days', now() - interval '1 day')`);
    const { rows } = await db.query<{ slug: string; s: string }>(
      `select slug, public.effective_link_status(status, expires_at) as s from public.links
       where slug in ('long-gone','exp-future','first-link','st-disabled')`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.slug, r.s]));
    assert.equal(by["long-gone"], "expired");
    assert.equal(by["exp-future"], "active");
    assert.equal(by["first-link"], "active");
    assert.equal(by["st-disabled"], "disabled");
  });

  it("bumps updated_at on update", async () => {
    await db.exec("update public.links set created_at = now() - interval '1 hour', updated_at = now() - interval '1 hour' where slug = 'first-link'");
    await db.exec("update public.links set destination_url = 'https://example.com/changed' where slug = 'first-link'");
    const { rows } = await db.query<{ fresh: boolean }>(
      "select updated_at > now() - interval '1 minute' as fresh from public.links where slug = 'first-link'",
    );
    assert.equal(rows[0].fresh, true);
  });
});

describe("row level security", () => {
  before(async () => {
    await db.exec(`
      insert into public.links (slug, destination_url, user_id) values
        ('a-link-1', 'https://example.com/a1', '${USER_A}'),
        ('a-link-2', 'https://example.com/a2', '${USER_A}'),
        ('b-link-1', 'https://example.com/b1', '${USER_B}');
    `);
  });

  it("anonymous visitors cannot read, write or delete any row", async () => {
    await as("anon", null, async () => {
      assert.equal(await code(() => db.query("select * from public.links")), "42501");
      assert.equal(await code(() => insert("anon-insert")), "42501");
      assert.equal(await code(() => db.query("update public.links set destination_url = 'https://evil.com'")), "42501");
      assert.equal(await code(() => db.query("delete from public.links")), "42501");
    });
  });

  it("signed-in users see only their own links", async () => {
    const a = await as("authenticated", USER_A, () => db.query<{ slug: string }>("select slug from public.links order by slug"));
    assert.deepEqual(a.rows.map((r) => r.slug), ["a-link-1", "a-link-2"]);
    const b = await as("authenticated", USER_B, () => db.query<{ slug: string }>("select slug from public.links order by slug"));
    assert.equal(b.rows.every((r) => r.slug !== "a-link-1"), true);
    assert.ok(b.rows.some((r) => r.slug === "b-link-1"));
  });

  it("signed-in users never see anonymous links", async () => {
    const a = await as("authenticated", USER_A, () => db.query("select 1 from public.links where user_id is null"));
    assert.equal(a.rows.length, 0);
  });

  it("a session with no user id sees nothing", async () => {
    const rows = await as("authenticated", null, () => db.query("select 1 from public.links"));
    assert.equal(rows.rows.length, 0);
  });

  it("owners can edit allowed columns on their own links only", async () => {
    const own = await as("authenticated", USER_A, () =>
      db.query("update public.links set destination_url = 'https://example.com/new', status = 'disabled' where slug = 'a-link-1'"),
    );
    assert.equal(own.affectedRows, 1);
    const other = await as("authenticated", USER_A, () =>
      db.query("update public.links set destination_url = 'https://evil.com' where slug = 'b-link-1'"),
    );
    assert.equal(other.affectedRows, 0);
    const { rows } = await db.query<{ destination_url: string }>("select destination_url from public.links where slug = 'b-link-1'");
    assert.equal(rows[0].destination_url, "https://example.com/b1");
  });

  it("owners cannot change slug, owner or id, transfer links, insert or delete", async () => {
    await as("authenticated", USER_A, async () => {
      assert.equal(await code(() => db.query("update public.links set slug = 'hijack-1' where slug = 'a-link-2'")), "42501");
      assert.equal(await code(() => db.query(`update public.links set user_id = '${USER_B}' where slug = 'a-link-2'`)), "42501");
      assert.equal(await code(() => db.query("update public.links set id = gen_random_uuid() where slug = 'a-link-2'")), "42501");
      assert.equal(await code(() => insert("auth-insert", `user_id='${USER_A}'`)), "42501");
      assert.equal(await code(() => db.query("delete from public.links where slug = 'a-link-2'")), "42501");
    });
  });

  it("owner edits still pass the check constraints", async () => {
    const c = await as("authenticated", USER_A, () =>
      code(() => db.query("update public.links set destination_url = 'javascript:alert(1)' where slug = 'a-link-2'")),
    );
    assert.equal(c, "23514");
  });

  it("the service role can write (bypasses RLS)", async () => {
    const c = await as("service_role", null, () => code(() => insert("svc-insert")));
    assert.equal(c, "ok");
  });
});

describe("resolve_link()", () => {
  before(async () => {
    await db.exec(`insert into public.links (slug, destination_url, utm_source, user_id, status) values
      ('res-active', 'https://example.com/live', 'newsletter', '${USER_A}', 'active'),
      ('res-off', 'https://example.com/off', 'newsletter', null, 'disabled'),
      ('res-gone', 'https://example.com/gone', null, null, 'deleted');
      insert into public.links (slug, destination_url, created_at, expires_at)
      values ('res-expired', 'https://example.com/old', now() - interval '2 days', now() - interval '1 day');`);
  });

  const resolve = (slug: string) =>
    as("anon", null, () =>
      db.query<Record<string, unknown>>("select * from public.resolve_link($1)", [slug]),
    );

  it("returns only redirect fields for an active link, for anonymous callers", async () => {
    const { rows } = await resolve("res-active");
    assert.deepEqual(rows[0], {
      status: "active",
      destination_url: "https://example.com/live",
      utm_source: "newsletter",
      utm_medium: null,
      utm_campaign: null,
    });
    assert.equal("user_id" in rows[0], false);
    assert.equal("id" in rows[0], false);
  });

  it("is case-insensitive", async () => {
    const { rows } = await resolve("RES-Active");
    assert.equal(rows[0].status, "active");
  });

  it("hides the destination for expired, disabled and deleted links", async () => {
    for (const [slug, status] of [["res-expired", "expired"], ["res-off", "disabled"], ["res-gone", "deleted"]] as const) {
      const { rows } = await resolve(slug);
      assert.equal(rows[0].status, status, slug);
      assert.equal(rows[0].destination_url, null, slug);
      assert.equal(rows[0].utm_source, null, slug);
    }
  });

  it("returns nothing for unknown slugs and injection attempts", async () => {
    for (const slug of ["does-not-exist", "' or '1'='1", "res-active' --", "%", "_"]) {
      const { rows } = await resolve(slug);
      assert.equal(rows.length, 0, slug);
    }
  });
});

describe("privileges", () => {
  it("anon and authenticated cannot bypass via table privileges", async () => {
    const { rows } = await db.query<{ role: string; priv: string }>(`
      select r.rolname as role, p.priv
      from pg_roles r
      cross join (values ('select'),('insert'),('update'),('delete')) as p(priv)
      where r.rolname in ('anon','authenticated')
        and has_table_privilege(r.rolname, 'public.links', p.priv)`);
    assert.deepEqual(
      rows.map((r) => `${r.role}:${r.priv}`).sort(),
      ["authenticated:select"],
    );
  });

  it("authenticated may update only the editable columns", async () => {
    const { rows } = await db.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'links'
        and has_column_privilege('authenticated', 'public.links', column_name, 'update')
      order by column_name`);
    assert.deepEqual(rows.map((r) => r.column_name), [
      "destination_url", "expires_at", "status", "utm_campaign", "utm_medium", "utm_source",
    ]);
  });

  it("RLS is enabled on links", async () => {
    const { rows } = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid = 'public.links'::regclass",
    );
    assert.equal(rows[0].relrowsecurity, true);
  });
});
