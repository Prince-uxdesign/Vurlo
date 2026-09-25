import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./helpers/pglite-client";

/**
 * Phase 4B: ownership and lifecycle rules, tested against the real migrations
 * with the same roles Supabase uses. These run as the signed-in user's own
 * database role, i.e. exactly what someone could do with their own token and
 * a hand-crafted request, bypassing the UI and server actions entirely.
 */
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
const row = async (slug: string) =>
  (await db.query<Record<string, unknown>>("select * from public.links where slug = $1", [slug])).rows[0];
const idOf = async (slug: string) => (await row(slug))!.id as string;
const insert = (slug: string, user: string | null, status = "active") =>
  db.query(
    `insert into public.links (slug, destination_url, user_id, status, expires_at) values ($1, 'https://example.com/' || $1, $2, $3, case when $2::uuid is null then now() + interval '1 day' end)`,
    [slug, user, status],
  );
/** An UPDATE as user `sub`, returning how many rows it actually changed. */
const updateAs = (sub: string, sql: string, params: unknown[] = []) =>
  as("authenticated", sub, async () => (await db.query(`${sql} returning id`, params)).rows.length);

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);
  await insert("a-owned", A);
  await insert("a-second", A);
  await insert("b-owned", B);
  await insert("anon-link", null);
});
after(async () => { await db.close(); });

describe("ownership: a user can only manage their own links", () => {
  it("can't read another user's link, even by id", async () => {
    const id = await idOf("a-owned");
    const r = await as("authenticated", B, () => db.query("select * from public.links where id = $1", [id]));
    assert.equal(r.rows.length, 0);
  });

  it("can't disable, archive, delete, edit or rename another user's link by id", async () => {
    const id = await idOf("a-owned");
    for (const [sql, params] of [
      ["update public.links set status = 'disabled' where id = $1", [id]],
      ["update public.links set status = 'archived' where id = $1", [id]],
      ["update public.links set status = 'deleted' where id = $1", [id]],
      ["update public.links set destination_url = 'https://evil.example.com' where id = $1", [id]],
      ["update public.links set slug = 'stolen-one' where id = $1", [id]],
      ["update public.links set expires_at = now() + interval '1 day' where id = $1", [id]],
    ] as const) {
      assert.equal(await updateAs(B, sql, [...params]), 0, sql);
    }
    const after = await row("a-owned");
    assert.equal(after!.status, "active");
    assert.equal(after!.destination_url, "https://example.com/a-owned");
    assert.equal(await row("stolen-one"), undefined);
  });

  it("can't touch anonymous links", async () => {
    const id = await idOf("anon-link");
    assert.equal(await updateAs(A, "update public.links set status = 'deleted' where id = $1", [id]), 0);
  });

  it("can't take ownership, hard-delete or insert directly", async () => {
    const id = await idOf("b-owned");
    assert.match(await as("authenticated", B, () => code(() => db.query(`update public.links set user_id = '${A}' where id = $1`, [id]))), /42501/);
    assert.match(await as("authenticated", B, () => code(() => db.query("delete from public.links where id = $1", [id]))), /42501/);
    assert.match(await as("authenticated", B, () => code(() => db.query(`insert into public.links (slug, destination_url, user_id) values ('sneaky', 'https://example.com', '${B}')`))), /42501/);
    assert.match(await as("authenticated", B, () => code(() => db.query("update public.links set is_custom_alias = true where id = $1", [id]))), /42501/);
  });

  it("anonymous visitors can't change anything", async () => {
    assert.match(await as("anon", null, () => code(() => db.query("update public.links set status = 'deleted'"))), /42501/);
  });

  it("the owner can", async () => {
    const id = await idOf("a-second");
    assert.equal(await updateAs(A, "update public.links set status = 'disabled' where id = $1", [id]), 1);
    assert.equal(await updateAs(A, "update public.links set status = 'active' where id = $1", [id]), 1);
  });
});

describe("deleted links are terminal", () => {
  before(async () => { await insert("gone-link", A); });

  it("delete stops the redirect and hides the destination", async () => {
    const id = await idOf("gone-link");
    assert.equal(await updateAs(A, "update public.links set status = 'deleted' where id = $1", [id]), 1);
    const r = (await as("anon", null, () => db.query<Record<string, unknown>>("select * from public.resolve_link('gone-link')"))).rows[0]!;
    assert.equal(r.status, "deleted");
    assert.equal(r.destination_url, null);
    assert.equal(r.utm_source, null);
  });

  it("can't be restored, edited or renamed, even by the owner with their own token", async () => {
    const id = await idOf("gone-link");
    for (const sql of [
      "update public.links set status = 'active' where id = $1",
      "update public.links set status = 'archived' where id = $1",
      "update public.links set destination_url = 'https://example.com/x' where id = $1",
      "update public.links set slug = 'gone-renamed' where id = $1",
    ]) {
      assert.match(await as("authenticated", A, () => code(() => db.query(sql, [id]))), /P0001:link_deleted/, sql);
    }
    assert.equal((await row("gone-link"))!.status, "deleted");
  });

  it("its slug stays reserved", async () => {
    assert.match(await code(() => insert("gone-link", B)), /23505/);
  });
});

describe("changing a link's address (slug)", () => {
  before(async () => {
    await insert("move-me", A);
    await insert("taken-one", B);
  });

  it("the owner can rename; the old address stops resolving and is retired", async () => {
    const id = await idOf("move-me");
    assert.equal(await updateAs(A, "update public.links set slug = 'moved-here' where id = $1", [id]), 1);
    const moved = await row("moved-here");
    assert.equal(moved!.id, id);
    assert.equal(moved!.is_custom_alias, true);
    const old = await as("anon", null, () => db.query("select * from public.resolve_link('move-me')"));
    assert.equal(old.rows.length, 0); // not found: nothing revealed
    const neu = (await as("anon", null, () => db.query<Record<string, unknown>>("select * from public.resolve_link('moved-here')"))).rows[0]!;
    assert.equal(neu.destination_url, "https://example.com/move-me");
  });

  it("nobody else can ever claim the retired address", async () => {
    assert.match(await code(() => insert("move-me", B)), /23505:.*links_slug_key/);
    const bId = await idOf("taken-one");
    assert.match(await as("authenticated", B, () => code(() => db.query("update public.links set slug = 'move-me' where id = $1", [bId]))), /23505/);
  });

  it("the owner can move back to the link's own old address", async () => {
    const id = await idOf("moved-here");
    assert.equal(await updateAs(A, "update public.links set slug = 'move-me' where id = $1", [id]), 1);
    const retired = await db.query<{ slug: string }>("select slug from public.retired_slugs where link_id = $1 order by slug", [id]);
    assert.deepEqual(retired.rows.map((r) => r.slug), ["moved-here"]);
  });

  it("can't take a live slug, a reserved word or a malformed slug", async () => {
    const id = await idOf("move-me");
    const tryRename = (slug: string) => as("authenticated", A, () => code(() => db.query("update public.links set slug = $2 where id = $1", [id, slug])));
    assert.match(await tryRename("taken-one"), /23505/);
    assert.match(await tryRename("dashboard"), /23514/);
    assert.match(await tryRename("Has Caps"), /23514/);
    assert.match(await tryRename("ab"), /23514/);
    assert.equal((await row("move-me"))!.id, id); // unchanged after all the failures
  });

  it("caps address changes per link", async () => {
    await insert("cap-0", A);
    const id = await idOf("cap-0");
    for (let i = 1; i <= 5; i++) {
      assert.equal(await updateAs(A, "update public.links set slug = $2 where id = $1", [id, `cap-${i}`]), 1, `rename ${i}`);
    }
    assert.match(await as("authenticated", A, () => code(() => db.query("update public.links set slug = 'cap-6' where id = $1", [id]))), /slug_change_limit_reached/);
    // Moving back to an old address is still allowed and frees a change.
    assert.equal(await updateAs(A, "update public.links set slug = 'cap-0' where id = $1", [id]), 1);
  });

  it("retired slugs are invisible to users and visitors", async () => {
    assert.match(await as("authenticated", A, () => code(() => db.query("select * from public.retired_slugs"))), /42501/);
    assert.match(await as("anon", null, () => code(() => db.query("select * from public.retired_slugs"))), /42501/);
  });
});

describe("is_slug_taken() (server-only availability check)", () => {
  it("reports live, retired, deleted and reserved slugs as taken", async () => {
    const taken = async (s: string) => (await as("service_role", null, () => db.query<{ taken: boolean }>("select * from public.is_slug_taken($1)", [s]))).rows[0]!.taken;
    assert.equal(await taken("a-owned"), true);
    assert.equal(await taken("moved-here"), true); // retired
    assert.equal(await taken("gone-link"), true); // deleted
    assert.equal(await taken("admin"), true); // reserved
    assert.equal(await taken("A-OWNED"), true); // case-insensitive
    assert.equal(await taken("brand-new-slug"), false);
  });

  it("isn't callable by users or visitors", async () => {
    assert.match(await as("authenticated", A, () => code(() => db.query("select * from public.is_slug_taken('x')"))), /42501/);
    assert.match(await as("anon", null, () => code(() => db.query("select * from public.is_slug_taken('x')"))), /42501/);
  });
});

describe("the active count follows lifecycle changes", () => {
  it("disable / archive / delete each free a slot; enable and restore take one back", async () => {
    const active = async () => Number((await as("authenticated", A, () => db.query<{ active: number }>("select active from public.my_link_stats()"))).rows[0]!.active);
    const start = await active();
    await insert("count-me", A);
    const id = await idOf("count-me");
    assert.equal(await active(), start + 1);
    await updateAs(A, "update public.links set status = 'disabled' where id = $1", [id]);
    assert.equal(await active(), start);
    await updateAs(A, "update public.links set status = 'active' where id = $1", [id]);
    assert.equal(await active(), start + 1);
    await updateAs(A, "update public.links set status = 'archived' where id = $1", [id]);
    assert.equal(await active(), start);
    await updateAs(A, "update public.links set status = 'active' where id = $1", [id]);
    await updateAs(A, "update public.links set status = 'deleted' where id = $1", [id]);
    assert.equal(await active(), start);
  });
});
