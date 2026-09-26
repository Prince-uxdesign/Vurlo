import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recordClickEvent, scheduleClickLogging } from "@/lib/analytics/record";
import { createAnalyticsGuard } from "@/lib/analytics/guard";
import { redact, sanitizeError } from "@/lib/links/log";
import { resolveLink } from "@/lib/links/resolve-link";
import { createBurstLimiter } from "@/lib/security/burst";
import { waitPhrase } from "@/lib/security/wait";
import { fetchWithTimeout } from "@/lib/supabase/fetch";

/**
 * Phase 8B: abuse controls and graceful degradation. Every "failure" here
 * is one that happens in production: a hung database, a dropped
 * connection, an analytics outage, a user hammering refresh.
 */

type ResolveClient = Parameters<typeof resolveLink>[1] extends { client?: infer C } ? C : never;
const ACTIVE = { status: "active", destination_url: "https://example.com/x", utm_source: null, utm_medium: null, utm_campaign: null };

function scripted(responses: Array<"transport" | "sql" | "throw" | "ok">) {
  let calls = 0;
  const client = {
    rpc: async () => {
      const r = responses[Math.min(calls++, responses.length - 1)];
      if (r === "throw") throw new Error("socket hang up");
      if (r === "transport") return { data: null, error: { message: "TypeError: fetch failed", code: "" } };
      if (r === "sql") return { data: null, error: { message: "boom", code: "XX000" } };
      return { data: [ACTIVE], error: null };
    },
  };
  return { client: client as unknown as ResolveClient, calls: () => calls };
}

const quiet = async <T,>(fn: () => Promise<T>) => {
  const e = console.error;
  const w = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.error = e;
    console.warn = w;
  }
};

describe("redirect availability", () => {
  it("retries once after a transport failure and still redirects", async () => {
    const s = scripted(["transport", "ok"]);
    const r = await quiet(() => resolveLink("abc", { client: s.client }));
    assert.deepEqual(r, { kind: "redirect", url: "https://example.com/x" });
    assert.equal(s.calls(), 2);
  });

  it("survives a client that throws, then recovers on retry", async () => {
    const s = scripted(["throw", "ok"]);
    assert.equal((await quiet(() => resolveLink("abc", { client: s.client }))).kind, "redirect");
  });

  it("doesn't retry database errors; shows the temporary-problem page", async () => {
    const s = scripted(["sql"]);
    assert.equal((await quiet(() => resolveLink("abc", { client: s.client }))).kind, "unavailable");
    assert.equal(s.calls(), 1);
  });

  it("gives up cleanly when the database is down (two tries, never more)", async () => {
    const s = scripted(["transport", "transport", "transport"]);
    assert.equal((await quiet(() => resolveLink("abc", { client: s.client }))).kind, "unavailable");
    assert.equal(s.calls(), 2);
  });

  it("analytics failure never affects the redirect", async () => {
    const failing = { rpc: async () => { throw new Error("analytics down"); } };
    assert.equal(await quiet(() => recordClickEvent("abc", {
      device_type: "desktop", browser: "chrome", operating_system: "windows", country_code: "US",
      referrer_source: "google", traffic_class: "human", is_bot: false, visitor_hash: null,
    }, { client: failing })), null);
    // Scheduling outside a request scope, with no database configured, must not throw either.
    assert.doesNotThrow(() => scheduleClickLogging("abc", new Headers({ "user-agent": "x" })));
  });

  it("a hung database call is cut off at its deadline", async () => {
    const hang = fetchWithTimeout(50);
    const original = globalThis.fetch;
    globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))) as typeof fetch;
    try {
      const started = Date.now();
      await assert.rejects(hang("https://db.example/rest/v1/rpc/resolve_link"));
      assert.ok(Date.now() - started < 1000);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("analytics guard", () => {
  it("serves repeat views from cache, isolated per user", async () => {
    const g = createAnalyticsGuard(() => 0, createBurstLimiter(() => 0));
    let dbCalls = 0;
    const fetch = async () => ({ clicks: ++dbCalls });
    for (let i = 0; i < 20; i++) await g.load("user-a", "account", 60_000, fetch);
    assert.equal(dbCalls, 1, "20 refreshes, one query");
    const b = await g.load("user-b", "account", 60_000, fetch);
    assert.equal(b.data?.clicks, 2, "user B never gets user A's numbers");
  });

  it("throttles database loads per user, serving stale data when it can", async () => {
    let t = 0;
    const g = createAnalyticsGuard(() => t, createBurstLimiter(() => t));
    let dbCalls = 0;
    const fetch = async () => ({ n: ++dbCalls });
    for (let i = 0; i < 30; i++) await g.load("u", `link:${i}`, 1, fetch);
    assert.equal(dbCalls, 30);
    const fresh = await g.load("u", "link:new", 1, fetch);
    assert.deepEqual(fresh, { data: null, throttled: true }, "31st distinct load in a minute is throttled");
    t = 5; // cached entries have expired, still inside the throttle window
    const stale = await g.load("u", "link:3", 1, fetch);
    assert.deepEqual(stale, { data: { n: 4 }, throttled: false }, "stale copy beats an empty section");
    assert.equal(dbCalls, 30);
    t = 61_000;
    assert.equal((await g.load("u", "link:new", 1, fetch)).throttled, false, "throttle lifts after the window");
  });

  it("never caches failures", async () => {
    const g = createAnalyticsGuard(() => 0, createBurstLimiter(() => 0));
    let calls = 0;
    await g.load("u", "k", 60_000, async () => { calls++; return null; });
    await g.load("u", "k", 60_000, async () => { calls++; return null; });
    assert.equal(calls, 2);
  });
});

describe("logs stay useful without becoming a store of personal data", () => {
  it("drops Postgres row details and keeps the diagnosis", () => {
    const pg = {
      code: "23514",
      message: 'new row for relation "links" violates check constraint "links_destination_url_format"',
      details: "Failing row contains (4f1c…, my-slug, https://private.example/secret?token=abc, aaaa-user-id, …)",
      hint: null,
    };
    const out = sanitizeError(pg);
    assert.equal(out.code, "23514");
    assert.match(String(out.message), /links_destination_url_format/);
    assert.ok(!("details" in out));
    assert.ok(!JSON.stringify(out).includes("private.example"));
  });

  it("redacts emails, tokens and query strings from messages", () => {
    const text = redact("User jane.doe@example.com failed with Bearer abc.def.ghi at https://x.supabase.co/auth/v1/verify?token_hash=1234 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJlLXNpZw");
    assert.ok(!text.includes("jane.doe"));
    assert.ok(!text.includes("abc.def.ghi"));
    assert.ok(!text.includes("token_hash=1234"));
    assert.ok(!text.includes("eyJhbGciOiJIUzI1NiJ9"));
    assert.ok(redact("x".repeat(5000)).length <= 300);
  });

  it("keeps error causes, sanitized", () => {
    const out = sanitizeError(new Error("rate limit check failed", { cause: { code: "XX", message: "boom", details: "row data" } }));
    assert.deepEqual(out, { name: "Error", message: "rate limit check failed", cause: { code: "XX", message: "boom" } });
  });
});

describe("retry timing wording", () => {
  it("says how long, in words people use", () => {
    assert.equal(waitPhrase(3), "5 seconds");
    assert.equal(waitPhrase(12), "15 seconds");
    assert.equal(waitPhrase(60), "1 minute");
    assert.equal(waitPhrase(61), "2 minutes");
    assert.equal(waitPhrase(1500), "25 minutes");
  });
});
