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
  try { await fn(); return "ok"; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
}

before(async () => {
  db = await createTestDb();
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@example.com'), ('${B}', 'b@example.com')`);
});
after(async () => { await db.close(); });

describe("profiles", () => {
  it("are created by trigger with id, email and created_at only", async () => {
    const { rows } = await db.query<Record<string, unknown>>("select * from public.profiles where id = $1", [A]);
    assert.deepEqual(Object.keys(rows[0]!).sort(), ["created_at", "email", "id"]);
    assert.equal(rows[0]!.email, "a@example.com");
  });

  it("follow email changes and are removed with the account", async () => {
    await db.exec(`update auth.users set email = 'a2@example.com' where id = '${A}'`);
    assert.equal((await db.query<{ email: string }>("select email from public.profiles where id = $1", [A])).rows[0]!.email, "a2@example.com");
    const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await db.exec(`insert into auth.users (id, email) values ('${C}', 'c@example.com')`);
    await db.exec(`delete from auth.users where id = '${C}'`);
    assert.equal((await db.query("select 1 from public.profiles where id = $1", [C])).rows.length, 0);
  });

  it("are readable only by their owner", async () => {
    const own = await as("authenticated", A, () => db.query<{ id: string }>("select id from public.profiles"));
    assert.deepEqual(own.rows.map((r) => r.id), [A]);
    await as("anon", null, async () => assert.equal(await code(() => db.query("select * from public.profiles")), "42501"));
    const none = await as("authenticated", null, () => db.query("select * from public.profiles"));
    assert.equal(none.rows.length, 0);
  });

  it("cannot be written by users, even their own row", async () => {
    await as("authenticated", A, async () => {
      assert.equal(await code(() => db.query("update public.profiles set email = 'x@evil.com' where id = $1", [A])), "42501");
      assert.equal(await code(() => db.query("delete from public.profiles where id = $1", [A])), "42501");
      assert.equal(await code(() => db.query("insert into public.profiles (id) values (gen_random_uuid())")), "42501");
    });
  });

  it("trigger functions are not callable by API roles", async () => {
    await as("authenticated", A, async () => {
      assert.equal(await code(() => db.query("select public.handle_new_user()")), "42501");
    });
  });
});

describe("link ownership through auth.uid()", () => {
  before(async () => {
    await db.exec(`insert into public.links (slug, destination_url, user_id) values
      ('owned-a1', 'https://example.com/1', '${A}'), ('owned-a2', 'https://example.com/2', '${A}'),
      ('owned-b1', 'https://example.com/3', '${B}')`);
    await db.exec("insert into public.links (slug, destination_url, expires_at) values ('anon-one', 'https://example.com/4', now() + interval '1 day')");
  });

  it("counts only the caller's own links (what the account page does)", async () => {
    const a = await as("authenticated", A, () => db.query<{ n: number }>("select count(*)::int as n from public.links"));
    const b = await as("authenticated", B, () => db.query<{ n: number }>("select count(*)::int as n from public.links"));
    assert.equal(a.rows[0]!.n, 2);
    assert.equal(b.rows[0]!.n, 1);
  });

  it("allows owned links to never expire, but not anonymous ones", async () => {
    assert.equal(await code(() => db.query(`insert into public.links (slug, destination_url, user_id) values ('forever-1','https://example.com','${A}')`)), "ok");
    assert.equal(await code(() => db.query("insert into public.links (slug, destination_url) values ('forever-2','https://example.com')")), "23514");
  });

  it("removes a user's links when the account is deleted", async () => {
    await db.exec("delete from auth.users where id = '" + B + "'");
    assert.equal((await db.query("select 1 from public.links where slug = 'owned-b1'")).rows.length, 0);
    assert.equal((await db.query("select 1 from public.links where slug = 'anon-one'")).rows.length, 1);
  });
});
