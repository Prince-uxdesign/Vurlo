import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./helpers/pglite-client";

let db: PGlite;
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function as<T>(role: "anon" | "authenticated" | "service_role", sub: string | null, fn: () => Promise<T>) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ""}', false)`);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
async function code(fn: () => Promise<unknown>) {
  try { await fn(); return "ok"; } catch (e) { return `${(e as { code?: string }).code}:${(e as Error).message}`; }
}
const seed = (user: string, n: number, prefix: string, extra = "") =>
  db.exec(`insert into public.links (slug, destination_url, user_id ${extra ? "," + extra.split("=")[0] : ""})
           select '${prefix}' || lpad(g::text, 3, '0'), 'https://example.com/' || g, '${user}' ${extra ? "," + extra.split("=")[1] : ""} from generate_series(1, ${n}) g`);
const list = (sub: string, args: string) =>
  as("authenticated", sub, () => db.query<{ slug: string } & Record<string, unknown>>(`select * from public.list_my_links(${args})`));

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);
});
after(async () => { await db.close(); });

describe("50 active links per account (database-enforced)", () => {
  it("allows exactly 50, then refuses the 51st with a stable error", async () => {
    await seed(A, 50, "lim-");
    const c = await as("service_role", null, () => code(() => db.query(`insert into public.links (slug, destination_url, user_id) values ('lim-over','https://example.com/x','${A}')`)));
    assert.match(c, /^P0001:active_link_limit_reached/);
    assert.equal((await db.query("select 1 from public.links where slug = 'lim-over'")).rows.length, 0);
  });

  it("is per account: another user is unaffected", async () => {
    assert.equal(await code(() => db.query(`insert into public.links (slug, destination_url, user_id) values ('b-first','https://example.com/b','${B}')`)), "ok");
  });

  it("does not count anonymous links or links owned by others", async () => {
    assert.equal(await code(() => db.query("insert into public.links (slug, destination_url, expires_at) values ('anon-free','https://example.com/a', now() + interval '1 day')")), "ok");
  });

  it("frees a slot when a link is disabled, archived, deleted or expires", async () => {
    for (const [slug, status] of [["lim-001", "disabled"], ["lim-002", "archived"], ["lim-003", "deleted"]] as const) {
      await as("authenticated", A, () => db.query("update public.links set status = $1 where slug = $2", [status, slug]));
    }
    await db.exec(`update public.links set expires_at = now() + interval '1 second', created_at = now() - interval '1 day' where slug = 'lim-004'`);
    await db.exec("select pg_sleep(1.2)");
    for (const slug of ["lim-new1", "lim-new2", "lim-new3", "lim-new4"]) {
      assert.equal(await code(() => db.query(`insert into public.links (slug, destination_url, user_id) values ('${slug}','https://example.com/n','${A}')`)), "ok", slug);
    }
    const c = await code(() => db.query(`insert into public.links (slug, destination_url, user_id) values ('lim-new5','https://example.com/n','${A}')`));
    assert.match(c, /active_link_limit_reached/);
  });

  it("blocks re-activating (enable / unarchive / extend expiry) when full, as the user themselves", async () => {
    await as("authenticated", A, async () => {
      assert.match(await code(() => db.query("update public.links set status = 'active' where slug = 'lim-001'")), /active_link_limit_reached/); // enable
      assert.match(await code(() => db.query("update public.links set status = 'active' where slug = 'lim-002'")), /active_link_limit_reached/); // unarchive
      assert.match(await code(() => db.query("update public.links set expires_at = now() + interval '5 days' where slug = 'lim-004'")), /active_link_limit_reached/); // un-expire
    });
  });

  it("does not block editing a link that already holds a slot", async () => {
    const c = await as("authenticated", A, () => code(() => db.query("update public.links set destination_url = 'https://example.com/edited' where slug = 'lim-010'")));
    assert.equal(c, "ok");
    const d = await as("authenticated", A, () => code(() => db.query("update public.links set expires_at = now() + interval '60 days' where slug = 'lim-011'")));
    assert.equal(d, "ok");
  });

  it("frees the slot for the same user after archiving one", async () => {
    await as("authenticated", A, () => db.query("update public.links set status = 'archived' where slug = 'lim-005'"));
    assert.equal(await as("authenticated", A, () => code(() => db.query("update public.links set status = 'active' where slug = 'lim-001'"))), "ok");
  });

  it("exposes the limit as a function so app and database can't drift", async () => {
    assert.equal((await db.query<{ n: number }>("select public.active_link_limit() as n")).rows[0]!.n, 50);
  });
});

describe("list_my_links()", () => {
  before(async () => {
    await db.exec(`insert into public.links (slug, destination_url, user_id, created_at, updated_at, expires_at, status) values
      ('find-alpha', 'https://shop.example.com/summer', '${B}', now() - interval '5 days', now() - interval '1 day', now() + interval '3 days', 'active'),
      ('find-beta',  'https://blog.example.com/100%_sure', '${B}', now() - interval '4 days', now() - interval '4 days', null, 'active'),
      ('find-gamma', 'https://docs.example.com/guide', '${B}', now() - interval '3 days', now() - interval '2 hours', null, 'disabled'),
      ('find-delta', 'https://old.example.com/', '${B}', now() - interval '9 days', now() - interval '9 days', now() - interval '8 days', 'active'),
      ('find-eps',   'https://arch.example.com/', '${B}', now() - interval '2 days', now() - interval '2 days', null, 'archived'),
      ('find-zeta',  'https://gone.example.com/', '${B}', now() - interval '1 day', now() - interval '1 day', null, 'deleted')`);
  });

  it("only ever returns the caller's own, non-deleted links", async () => {
    const r = await list(B, "null, 'all', 'newest', 50, 0");
    assert.ok(r.rows.every((x) => x.slug === "b-first" || x.slug.startsWith("find-")));
    assert.equal(r.rows.some((x) => x.slug === "find-zeta"), false); // deleted
    assert.equal(r.rows.some((x) => x.slug === "find-eps"), false); // archived is not in "all"
    assert.equal(r.rows.some((x) => x.slug.startsWith("lim-")), false); // other user's
    const anon = await as("anon", null, () => code(() => db.query("select * from public.list_my_links()")));
    assert.match(anon, /42501/);
  });

  it("filters by status, expiry window and archive", async () => {
    const slugs = async (f: string) => (await list(B, `null, '${f}', 'oldest', 50, 0`)).rows.map((r) => r.slug);
    assert.deepEqual(await slugs("active"), ["find-alpha", "find-beta", "b-first"]); // oldest first
    assert.deepEqual(await slugs("expired"), ["find-delta"]);
    assert.deepEqual(await slugs("disabled"), ["find-gamma"]);
    assert.deepEqual(await slugs("archived"), ["find-eps"]);
    assert.deepEqual(await slugs("expiring"), ["find-alpha"]);
    assert.deepEqual(await slugs("bogus"), []);
  });

  it("searches slug and destination, case-insensitively", async () => {
    const one = async (q: string) => (await list(B, `'${q}', 'all', 'newest', 50, 0`)).rows.map((r) => r.slug);
    assert.deepEqual(await one("ALPHA"), ["find-alpha"]);
    assert.deepEqual(await one("blog.example"), ["find-beta"]);
    assert.deepEqual(await one("guide"), ["find-gamma"]);
    assert.deepEqual(await one("nothing-matches-this"), []);
  });

  it("treats % and _ and quotes as literal text, never as wildcards or SQL", async () => {
    const count = async (q: string) => (await db.query("select * from public.list_my_links($1, 'all', 'newest', 50, 0)", [q]).catch(() => ({ rows: ["ERR"] }))).rows.length;
    await db.exec(`select set_config('request.jwt.claim.sub', '${B}', false)`); await db.exec("set role authenticated");
    try {
      assert.equal(await count("%"), 1); // only the URL that literally contains "%"
      assert.equal(await count("100%_sure"), 1);
      assert.equal(await count("_"), 1); // literal underscore (in the 100%_sure URL)
      assert.equal(await count("'; drop table public.links; --"), 0);
      assert.equal(await count("\\"), 0);
      assert.equal(await count("a\\"), 0);
    } finally { await db.exec("reset role"); }
    assert.equal((await db.query("select count(*)::int as n from public.links")).rows[0] !== undefined, true); // table still there
  });

  it("sorts newest, oldest, recently updated and expiring soonest", async () => {
    const order = async (s: string) => (await list(B, `null, 'all', '${s}', 50, 0`)).rows.map((r) => r.slug).filter((x) => x.startsWith("find-"));
    assert.deepEqual(await order("newest"), ["find-gamma", "find-beta", "find-alpha", "find-delta"]);
    assert.deepEqual(await order("oldest"), ["find-delta", "find-alpha", "find-beta", "find-gamma"]);
    assert.deepEqual(await order("updated"), ["find-gamma", "find-alpha", "find-beta", "find-delta"]);
    const exp = await order("expiring"); // soonest first (expired before upcoming), no-expiry last
    assert.deepEqual(exp.slice(0, 2), ["find-delta", "find-alpha"]);
  });

  it("paginates with a stable total and clamps silly limits", async () => {
    const p1 = await list(A, "null, 'all', 'newest', 20, 0");
    const p3 = await list(A, "null, 'all', 'newest', 20, 40");
    assert.equal(p1.rows.length, 20);
    assert.equal(Number(p1.rows[0]!.total_count), Number(p3.rows[0]!.total_count));
    const total = Number(p1.rows[0]!.total_count);
    assert.equal(p3.rows.length, Math.min(20, Math.max(0, total - 40)));
    const ids = new Set([...(await list(A, "null, 'all', 'newest', 20, 0")).rows, ...(await list(A, "null, 'all', 'newest', 20, 20")).rows].map((r) => r.id));
    assert.equal(ids.size, 40); // no overlap between pages
    assert.equal((await list(A, "null, 'all', 'newest', 100000, 0")).rows.length, 50); // limit clamped to 50
    assert.equal((await list(A, "null, 'all', 'newest', -5, -10")).rows.length, 1);
  });

  it("marks expired links as such without a stored flag", async () => {
    const r = (await list(B, "'find-delta', 'all', 'newest', 5, 0")).rows[0]!;
    assert.equal(r.status, "active");
    assert.equal(r.effective_status, "expired");
  });
});

describe("my_link_stats()", () => {
  it("counts by effective status for the caller only", async () => {
    const s = (await as("authenticated", A, () => db.query<Record<string, unknown>>("select * from public.my_link_stats()"))).rows[0]!;
    assert.equal(Number(s.active), 50);
    assert.equal(Number(s.archived), 2);
    assert.ok(Number(s.total) >= 52);
    const b = (await as("authenticated", B, () => db.query<Record<string, unknown>>("select * from public.my_link_stats()"))).rows[0]!;
    assert.equal(Number(b.active), 3); // b-first, alpha, beta
    assert.equal(Number(b.expired), 1);
    assert.equal(Number(b.disabled), 1);
    assert.equal(Number(b.archived), 1);
    assert.equal(Number(b.expiring), 1);
    assert.equal(Number(b.listed), 5);
  });
  it("is not callable by anonymous visitors", async () => {
    assert.match(await as("anon", null, () => code(() => db.query("select * from public.my_link_stats()"))), /42501/);
  });
});
