import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { handleAliasCheckRequest, handleCreateLinkRequest } from "@/lib/links/api";
import { resolveLink } from "@/lib/links/resolve-link";
import type { AdminClient } from "@/lib/supabase/admin";
import { createTestDb, pgliteClient } from "./helpers/pglite-client";

let db: PGlite;
let client: AdminClient;
let ipCounter = 0;
const newIp = () => `203.0.113.${++ipCounter}`;

function post(body: unknown, init: { ip?: string; headers?: Record<string, string>; raw?: string } = {}) {
  return new Request("http://localhost:3000/api/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      "x-forwarded-for": init.ip ?? newIp(),
      ...init.headers,
    },
    body: init.raw ?? JSON.stringify(body),
  });
}

const aliasGet = (alias: string, ip = newIp()) =>
  new Request(`http://localhost:3000/api/links/alias?alias=${encodeURIComponent(alias)}`, {
    headers: { host: "localhost:3000", "x-forwarded-for": ip },
  });

interface CreateJson {
  ok: boolean;
  code: string;
  field: string;
  error: string;
  link: {
    slug: string;
    shortUrl: string;
    displayUrl: string;
    destinationUrl: string;
    expiresAt: string | null;
    isCustomAlias: boolean;
  };
}

async function create(body: unknown, init?: Parameters<typeof post>[1]) {
  const response = await handleCreateLinkRequest(post(body, init), { client });
  return { response, json: (await response.json()) as CreateJson };
}

before(async () => {
  db = await createTestDb();
  client = pgliteClient(db);
});
after(async () => {
  await db.close();
});

describe("POST /api/links", () => {
  it("creates an anonymous link that expires in 30 days by default", async () => {
    const { response, json } = await create({ destination: "example.com/path?x=1#frag" });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(json.ok, true);
    assert.match(json.link.slug, /^[a-z0-9]{7}$/);
    assert.equal(json.link.shortUrl, `http://localhost:3000/${json.link.slug}`);
    assert.equal(json.link.destinationUrl, "https://example.com/path?x=1#frag");
    assert.equal(json.link.isCustomAlias, false);
    assert.equal("id" in json.link || "userId" in json.link, false);

    const { rows } = await db.query<{ user_id: string | null; days: number }>(
      "select user_id, extract(epoch from (expires_at - created_at)) / 86400 as days from public.links where slug = $1",
      [json.link.slug],
    );
    assert.equal(rows[0]!.user_id, null);
    assert.ok(Math.abs(Number(rows[0]!.days) - 30) < 0.01);
  });

  it("honours 24h and 7d expiry and rejects unknown or 'never'", async () => {
    const a = await create({ destination: "https://example.com", expiration: "1d" });
    const b = await create({ destination: "https://example.com", expiration: "7d" });
    assert.equal(a.response.status, 201);
    assert.equal(b.response.status, 201);
    for (const bad of ["never", "90d", "", 7, null]) {
      const r = await create({ destination: "https://example.com", expiration: bad });
      assert.equal(r.response.status, 400, String(bad));
      assert.equal(r.json.field, "expiration");
    }
  });

  it("creates custom aliases, normalizing case", async () => {
    const { response, json } = await create({ destination: "https://example.com", alias: "  My-Design_01 " });
    assert.equal(response.status, 201);
    assert.equal(json.link.slug, "my-design_01");
    assert.equal(json.link.isCustomAlias, true);
  });

  it("enforces alias boundaries: 3–32 characters", async () => {
    assert.equal((await create({ destination: "https://example.com", alias: "abc" })).response.status, 201);
    assert.equal((await create({ destination: "https://example.com", alias: "a".repeat(32) })).response.status, 201);
    assert.equal((await create({ destination: "https://example.com", alias: "ab" })).response.status, 400);
    assert.equal((await create({ destination: "https://example.com", alias: "a".repeat(33) })).response.status, 400);
  });

  it("rejects invalid aliases with specific messages", async () => {
    for (const alias of ["has space", "sp€cial", "a/b", "a.b", "-lead", "%20%20%20", "<b>x</b>"]) {
      const { response, json } = await create({ destination: "https://example.com", alias });
      assert.equal(response.status, 400, alias);
      assert.equal(json.code, "invalid_alias", alias);
      assert.equal(json.field, "alias");
      assert.match(json.error, /3–32|lowercase/);
    }
  });

  it("rejects reserved aliases, in any case", async () => {
    for (const alias of ["api", "Dashboard", "LOGIN", "admin", "privacy"]) {
      const { response, json } = await create({ destination: "https://example.com", alias });
      assert.equal(response.status, 400, alias);
      assert.equal(json.code, "reserved_alias");
    }
  });

  it("returns 409 for a duplicate alias, including different casing", async () => {
    await create({ destination: "https://example.com", alias: "taken-one" });
    for (const alias of ["taken-one", "TAKEN-ONE"]) {
      const { response, json } = await create({ destination: "https://other.example.com", alias });
      assert.equal(response.status, 409);
      assert.equal(json.code, "alias_taken");
      assert.equal(json.field, "alias");
    }
  });

  it("accepts valid destinations and keeps queries and fragments", async () => {
    for (const url of [
      "https://example.com",
      "http://example.com/a",
      "https://example.com/search?q=a+b&x=%20y#top",
      `https://example.com/${"a".repeat(1900)}`,
    ]) {
      assert.equal((await create({ destination: url })).response.status, 201, url.slice(0, 40));
    }
  });

  it("rejects invalid and dangerous destinations with a helpful message", async () => {
    for (const destination of ["", "   ", "not a url", "javascript:alert(1)", "data:text/html,x", "ftp://a.com/x", "https://user:pw@example.com", `https://example.com/${"a".repeat(2100)}`]) {
      const { response, json } = await create({ destination });
      assert.equal(response.status, 400, destination.slice(0, 30));
      assert.equal(json.field, "destination");
      assert.ok(json.error.length > 10);
    }
  });

  it("stores UTM values and applies them to the returned destination", async () => {
    const { json } = await create({
      destination: "https://example.com/p?keep=1&utm_source=old&utm_term=stay",
      utm: { source: "newsletter", medium: "email", campaign: "spring 2026" },
    });
    const url = new URL(json.link.destinationUrl);
    assert.equal(url.searchParams.get("utm_source"), "newsletter");
    assert.equal(url.searchParams.get("utm_medium"), "email");
    assert.equal(url.searchParams.get("utm_campaign"), "spring 2026");
    assert.equal(url.searchParams.get("utm_term"), "stay");
    assert.equal(url.searchParams.get("keep"), "1");
    const { rows } = await db.query<{ destination_url: string; utm_source: string }>(
      "select destination_url, utm_source from public.links where slug = $1", [json.link.slug]);
    // Stored separately, applied at redirect time.
    assert.equal(rows[0]!.utm_source, "newsletter");
    assert.ok(rows[0]!.destination_url.includes("utm_source=old"));
  });

  it("ignores empty UTM values and rejects unsafe ones", async () => {
    const ok = await create({ destination: "https://example.com", utm: { source: "", medium: "  ", campaign: "" } });
    assert.equal(ok.response.status, 201);
    assert.equal(ok.json.link.destinationUrl, "https://example.com/");
    for (const source of ["<script>", "a&utm_medium=x", "x".repeat(101), "a=b"]) {
      const { response, json } = await create({ destination: "https://example.com", utm: { source } });
      assert.equal(response.status, 400, source);
      assert.equal(json.field, "utm");
    }
  });

  it("handles malformed requests without leaking details", async () => {
    const wrongType = await handleCreateLinkRequest(post({}, { headers: { "content-type": "text/plain" } }), { client });
    assert.equal(wrongType.status, 400);
    const badJson = await handleCreateLinkRequest(post(null, { raw: "{not json" }), { client });
    assert.equal(badJson.status, 400);
    const huge = await handleCreateLinkRequest(post({ destination: "https://a.com/" + "x".repeat(6000) }), { client });
    assert.equal(huge.status, 413);
    for (const body of [null, [], "str", 5]) {
      const r = await create(body);
      assert.equal(r.response.status, 400);
    }
    const text = JSON.stringify(await badJson.clone().json().catch(() => ""));
    assert.equal(/SyntaxError|Unexpected|stack/i.test(text), false);
  });

  it("blocks cross-site browser requests", async () => {
    const r = await handleCreateLinkRequest(post({ destination: "https://example.com" }, { headers: { origin: "https://evil.example" } }), { client });
    assert.equal(r.status, 403);
    const same = await handleCreateLinkRequest(post({ destination: "https://example.com" }, { headers: { origin: "http://localhost:3000" } }), { client });
    assert.equal(same.status, 201);
  });

  it("fails safely when unconfigured or when the limiter is down", async () => {
    const off = await handleCreateLinkRequest(post({ destination: "https://example.com" }), { client: null });
    assert.equal(off.status, 503);
    const broken = { rpc: async () => ({ data: null, error: { code: "XX", message: "boom" } }) } as unknown as AdminClient;
    const down = await handleCreateLinkRequest(post({ destination: "https://example.com" }), { client: broken });
    assert.equal(down.status, 503);
    assert.equal(((await down.json()) as { code: string }).code, "unavailable");
  });
});

describe("uniqueness under contention", () => {
  it("retries a colliding generated slug and never duplicates", async () => {
    await db.exec("insert into public.links (slug, destination_url, expires_at) values ('aaaaaaa', 'https://example.com', now() + interval '1 day')");
    const queue = ["aaaaaaa", "aaaaaaa", "bbbbbbb"];
    const { createLink } = await import("@/lib/links/create-link");
    const result = await createLink({ destination: "https://example.com/x" }, { client, slugGenerator: () => queue.shift() ?? "zzzzzzz" });
    assert.equal(result.ok && result.link.slug, "bbbbbbb");
    assert.equal(queue.length, 0);
  });

  it("gives up cleanly when every generated slug collides", async () => {
    const { createLink } = await import("@/lib/links/create-link");
    const result = await createLink({ destination: "https://example.com/x" }, { client, slugGenerator: () => "aaaaaaa" });
    assert.equal(!result.ok && result.code, "slug_generation_failed");
  });

  it("many simultaneous creates of one alias produce exactly one link", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, () => create({ destination: "https://example.com", alias: "contended" })));
    assert.equal(results.filter((r) => r.response.status === 201).length, 1);
    assert.equal(results.filter((r) => r.response.status === 409).length, 14);
    const { rows } = await db.query("select 1 from public.links where slug = 'contended'");
    assert.equal(rows.length, 1);
  });

  it("many simultaneous generated creates all succeed with distinct slugs", async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => create({ destination: "https://example.com" })));
    assert.ok(results.every((r) => r.response.status === 201));
    assert.equal(new Set(results.map((r) => r.json.link.slug)).size, 40);
  });
});

describe("rate limiting", () => {
  it("allows 20 creates per hour per IP, then returns 429 with Retry-After", async () => {
    const ip = newIp();
    for (let i = 0; i < 20; i++) {
      assert.equal((await create({ destination: "https://example.com" }, { ip })).response.status, 201, `#${i + 1}`);
    }
    const { response, json } = await create({ destination: "https://example.com" }, { ip });
    assert.equal(response.status, 429);
    assert.equal(json.code, "rate_limited");
    const retry = Number(response.headers.get("retry-after"));
    assert.ok(retry > 0 && retry <= 3600, String(retry));
    assert.match(json.error, /minute/);
    // Another client is unaffected.
    assert.equal((await create({ destination: "https://example.com" })).response.status, 201);
  });

  it("stores hashed keys, never raw IPs", async () => {
    const ip = "198.51.100.77";
    await create({ destination: "https://example.com" }, { ip });
    const { rows } = await db.query<{ key: string }>("select key from public.rate_limits");
    assert.ok(rows.length > 0);
    assert.equal(rows.some((r) => r.key.includes(ip)), false);
    assert.ok(rows.every((r) => /^(create|alias):[0-9a-f]{64}$/.test(r.key)));
  });

  it("limits alias checks separately from creation", async () => {
    const ip = newIp();
    for (let i = 0; i < 60; i++) {
      assert.equal((await handleAliasCheckRequest(aliasGet("free-name", ip), { client })).status, 200);
    }
    const blocked = await handleAliasCheckRequest(aliasGet("free-name", ip), { client });
    assert.equal(blocked.status, 429);
    assert.equal(((await blocked.json()) as { status: string }).status, "rate_limited");
    // Creation for the same IP still works.
    assert.equal((await create({ destination: "https://example.com" }, { ip })).response.status, 201);
  });
});

describe("GET /api/links/alias", () => {
  const check = async (alias: string) => {
    const r = await handleAliasCheckRequest(aliasGet(alias), { client });
    return { status: r.status, body: (await r.json()) as { status: string; error?: string } };
  };

  it("reports available and taken aliases, case-insensitively", async () => {
    await create({ destination: "https://example.com", alias: "check-taken" });
    assert.deepEqual((await check("check-free-1")).body, { status: "available" });
    assert.equal((await check("check-taken")).body.status, "taken");
    assert.equal((await check("CHECK-TAKEN")).body.status, "taken");
  });

  it("answers invalid and reserved aliases without touching the database", async () => {
    const dead = { rpc: async () => { throw new Error("db touched"); }, from: () => { throw new Error("db touched"); } } as unknown as AdminClient;
    for (const [alias, status] of [["ab", "invalid"], ["bad char", "invalid"], ["dashboard", "reserved"], ["", "invalid"]] as const) {
      const r = await handleAliasCheckRequest(aliasGet(alias), { client: dead });
      assert.equal(((await r.json()) as { status: string }).status, status, alias);
      assert.equal(r.status, 400);
    }
  });
});

describe("resolving links (redirects)", () => {
  const publicClient = () => pgliteClient(db, "anon") as unknown as Parameters<typeof resolveLink>[1] extends infer D ? (D extends { client?: infer C } ? C : never) : never;

  it("redirects an active link to its destination with UTM applied", async () => {
    const { json } = await create({
      destination: "https://example.com/landing?ref=1",
      utm: { source: "news" },
      alias: "resolve-me",
    });
    const result = await resolveLink("Resolve-Me", { client: publicClient() });
    assert.deepEqual(result, { kind: "redirect", url: "https://example.com/landing?ref=1&utm_source=news" });
    assert.equal(json.link.slug, "resolve-me");
  });

  it("reports expired, disabled and archived distinctly; deleted and unknown look missing", async () => {
    await db.exec(`insert into public.links (slug, destination_url, created_at, expires_at)
      values ('old-link', 'https://example.com/old', now() - interval '2 days', now() - interval '1 day')`);
    await db.exec(`insert into public.links (slug, destination_url, expires_at, status) values
      ('off-link', 'https://example.com/off', now() + interval '1 day', 'disabled'),
      ('arc-link', 'https://example.com/arc', now() + interval '1 day', 'archived'),
      ('del-link', 'https://example.com/del', now() + interval '1 day', 'deleted')`);
    assert.deepEqual(await resolveLink("old-link", { client: publicClient() }), { kind: "expired" });
    assert.deepEqual(await resolveLink("off-link", { client: publicClient() }), { kind: "disabled" });
    assert.deepEqual(await resolveLink("arc-link", { client: publicClient() }), { kind: "archived" });
    for (const slug of ["del-link", "never-existed"]) {
      assert.deepEqual(await resolveLink(slug, { client: publicClient() }), { kind: "not_found" }, slug);
    }
  });

  it("refuses to redirect to an unsafe stored destination", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "https://u:p@example.com/", "/relative", "ftp://example.com/x"]) {
      const fake = { rpc: async () => ({ data: [{ status: "active", destination_url: bad, utm_source: null, utm_medium: null, utm_campaign: null }], error: null }) } as never;
      assert.deepEqual(await resolveLink("some-slug", { client: fake }), { kind: "unavailable" }, bad);
    }
  });

  it("never redirects on a non-active status even if a destination leaks through", async () => {
    for (const status of ["expired", "disabled", "archived", "deleted", "weird"]) {
      const fake = { rpc: async () => ({ data: [{ status, destination_url: "https://example.com/", utm_source: null, utm_medium: null, utm_campaign: null }], error: null }) } as never;
      const result = await resolveLink("some-slug", { client: fake });
      assert.notEqual(result.kind, "redirect", status);
    }
  });

  it("rejects junk paths before any database call", async () => {
    const dead = { rpc: async () => { throw new Error("db touched"); } } as never;
    for (const slug of ["wp-login.php", "favicon.ico", "a", "..%2f", "x".repeat(40), "<script>"]) {
      assert.deepEqual(await resolveLink(slug, { client: dead }), { kind: "not_found" }, slug);
    }
  });

  it("degrades to 'unavailable' when the database errors or is unconfigured", async () => {
    const broken = { rpc: async () => ({ data: null, error: { message: "x" } }) } as never;
    assert.deepEqual(await resolveLink("some-slug", { client: broken }), { kind: "unavailable" });
    assert.deepEqual(await resolveLink("some-slug", { client: null }), { kind: "unavailable" });
  });
});

describe("migration: anonymous expiry and rate-limit table", () => {
  const code = async (sql: string) => {
    try { await db.exec(sql); return "ok"; } catch (e) { return (e as { code?: string }).code ?? "unknown"; }
  };

  it("requires anonymous links to expire, within ~30 days; owned links may not", async () => {
    assert.equal(await code("insert into public.links (slug, destination_url) values ('anon-noexp','https://example.com')"), "23514");
    assert.equal(await code("insert into public.links (slug, destination_url, expires_at) values ('anon-far','https://example.com', now() + interval '90 days')"), "23514");
    assert.equal(await code("insert into public.links (slug, destination_url, expires_at) values ('anon-ok1','https://example.com', now() + interval '30 days')"), "ok");
    await db.exec("insert into auth.users (id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')");
    assert.equal(await code("insert into public.links (slug, destination_url, user_id) values ('owned-forever','https://example.com','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')"), "ok");
  });

  it("keeps rate_limits and consume_rate_limit away from anon and authenticated", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      for (const sql of ["select * from public.rate_limits", "select * from public.consume_rate_limit('k', 5, 60)", "delete from public.rate_limits"]) {
        assert.equal(await code(sql), "42501", `${role}: ${sql}`);
      }
      await db.exec("reset role");
    }
  });

  it("counts atomically and reports remaining and retry-after", async () => {
    const rows: Array<{ allowed: boolean; remaining: number; retry_after_seconds: number }> = [];
    for (let i = 0; i < 4; i++) {
      const r = await db.query<(typeof rows)[number]>("select * from public.consume_rate_limit('unit-key', 3, 60)");
      rows.push(r.rows[0]!);
    }
    assert.deepEqual(rows.map((r) => r.allowed), [true, true, true, false]);
    assert.deepEqual(rows.map((r) => r.remaining), [2, 1, 0, 0]);
    assert.ok(rows[3]!.retry_after_seconds >= 1 && rows[3]!.retry_after_seconds <= 60);
  });
});
