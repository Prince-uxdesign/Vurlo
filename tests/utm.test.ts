import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { validateLinkEdit } from "@/lib/links/manage";
import {
  MAX_TRACKED_URL_LENGTH,
  buildTrackedUrl,
  findUtmConflicts,
  hasUtm,
  readUtm,
  trackedUrlTooLong,
  validateUtm,
  validateUtmValue,
} from "@/lib/validation/utm";
import { createTestDb } from "./helpers/pglite-client";

const none = { source: null, medium: null, campaign: null };
const all = { source: "google", medium: "cpc", campaign: "summer-launch" };

describe("buildTrackedUrl", () => {
  it("uses ? when the destination has no query", () => {
    assert.equal(
      buildTrackedUrl("https://example.com/page", all),
      "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=summer-launch",
    );
  });

  it("uses & after an existing query and keeps it byte-for-byte", () => {
    // URLSearchParams would rewrite these (%20 → +, flag → flag=, / → %2F).
    const dest = "https://example.com/s?q=a%20b&flag&path=a/b&plus=a+b";
    assert.equal(
      buildTrackedUrl(dest, { ...none, source: "news" }),
      `${dest}&utm_source=news`,
    );
  });

  it("keeps the fragment last, including hash-router fragments", () => {
    assert.equal(
      buildTrackedUrl("https://example.com/p#pricing", { ...none, medium: "email" }),
      "https://example.com/p?utm_medium=email#pricing",
    );
    assert.equal(
      buildTrackedUrl("https://app.example.com/?a=1#/route?tab=2", { ...none, source: "x" }),
      "https://app.example.com/?a=1&utm_source=x#/route?tab=2",
    );
  });

  it("replaces supplied utm_* params in place and drops their duplicates", () => {
    const dest = "https://example.com/?utm_source=old&x=1&utm_source=older&utm_medium=keep";
    assert.equal(
      buildTrackedUrl(dest, { ...none, source: "new" }),
      "https://example.com/?utm_source=new&x=1&utm_medium=keep",
    );
  });

  it("leaves existing utm_* params alone when their field is empty", () => {
    const dest = "https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&utm_term=t";
    assert.equal(buildTrackedUrl(dest, { source: "", medium: "  ", campaign: "" }), dest);
    assert.equal(
      buildTrackedUrl(dest, { ...none, campaign: "d" }),
      "https://example.com/?utm_source=a&utm_medium=b&utm_campaign=d&utm_term=t",
    );
  });

  it("recognizes encoded parameter names", () => {
    assert.equal(
      buildTrackedUrl("https://example.com/?utm%5Fsource=old", { ...none, source: "new" }),
      "https://example.com/?utm_source=new",
    );
  });

  it("percent-encodes special characters so values can't break the URL", () => {
    const url = buildTrackedUrl("https://example.com/?x=1", {
      source: "Q&A / news",
      medium: "e-mail",
      campaign: "Été 2026 (launch)",
    });
    assert.equal(
      url,
      "https://example.com/?x=1&utm_source=Q%26A%20%2F%20news&utm_medium=e-mail&utm_campaign=%C3%89t%C3%A9%202026%20(launch)",
    );
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("utm_source"), "Q&A / news");
    assert.equal(parsed.searchParams.get("utm_campaign"), "Été 2026 (launch)");
    assert.equal(parsed.searchParams.get("x"), "1");
    assert.equal([...parsed.searchParams.keys()].length, 4);
  });

  it("handles an empty query marker and a trailing &", () => {
    assert.equal(buildTrackedUrl("https://example.com/?", { ...none, source: "a" }), "https://example.com/?utm_source=a");
    assert.equal(buildTrackedUrl("https://example.com/?x=1&", { ...none, source: "a" }), "https://example.com/?x=1&utm_source=a");
  });

  it("returns the destination untouched when no values are supplied", () => {
    assert.equal(buildTrackedUrl("https://example.com/p?x=1#h", none), "https://example.com/p?x=1#h");
  });
});

describe("validateUtmValue / validateUtm", () => {
  it("accepts normal marketing values, any script, everyday punctuation", () => {
    for (const v of ["google", "cpc", "summer-launch", "Spring Sale 2026", "q3_promo", "fb/ig", "Q&A", "a.b~c+d", "café", "日本語", "(launch)", "partner:acme", "it's"]) {
      assert.deepEqual(validateUtmValue(v), { ok: true, value: v }, v);
    }
  });

  it("trims, collapses whitespace, and treats empty as not set", () => {
    assert.deepEqual(validateUtmValue("  spring \t  sale "), { ok: true, value: "spring sale" });
    assert.deepEqual(validateUtmValue("   "), { ok: true, value: null });
    assert.deepEqual(validateUtmValue(""), { ok: true, value: null });
    assert.deepEqual(validateUtmValue(undefined), { ok: true, value: null });
  });

  it("counts length in characters, max 100", () => {
    assert.equal(validateUtmValue("x".repeat(100)).ok, true);
    assert.equal(validateUtmValue("é".repeat(100)).ok, true);
    const long = validateUtmValue("x".repeat(101));
    assert.equal(long.ok, false);
    assert.match((long as { error: string }).error, /100 characters/);
  });

  it("explains pasted key=value, pre-encoded text and unsafe characters", () => {
    const err = (v: unknown) => (validateUtmValue(v) as { error: string }).error;
    assert.match(err("utm_source=google"), /just the value/);
    assert.match(err("a&utm_medium=evil"), /just the value/);
    assert.match(err("google?x"), /just the value/);
    assert.match(err("spring%20sale"), /plain text/);
    assert.match(err("<script>"), /“<” can't be used/);
    assert.match(err('say "hi"'), /“"” can't be used/);
    assert.match(err("a\u0000b"), /hidden or control/);
    assert.match(err("a​b"), /hidden or control/);
    assert.match(err(5), /Enter text/);
  });

  it("reports every invalid field, and a summary naming the first", () => {
    const result = validateUtm({ source: "ok", medium: "<b>", campaign: "x".repeat(101) });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(Object.keys(result.fieldErrors), ["medium", "campaign"]);
    assert.match(result.error, /^Medium: /);
    assert.deepEqual(validateUtm({ source: " g ", medium: "", campaign: "c" }), {
      ok: true,
      value: { source: "g", medium: null, campaign: "c" },
    });
  });
});

describe("helpers", () => {
  it("reads, detects and reports conflicts", () => {
    const dest = "https://example.com/?utm_source=old&utm_term=t";
    assert.deepEqual(readUtm(dest), { source: "old" });
    assert.deepEqual(findUtmConflicts(dest, { source: "new", medium: "email", campaign: "" }), ["utm_source"]);
    assert.equal(hasUtm(dest, none), true);
    assert.equal(hasUtm("https://example.com/?utm_term=t", none), false);
    assert.equal(hasUtm("https://example.com/", { ...none, campaign: "c" }), true);
    assert.deepEqual(readUtm("not a url"), {});
  });

  it("caps the final URL length", () => {
    const dest = `https://example.com/${"p".repeat(2000)}`;
    assert.equal(trackedUrlTooLong(dest, all), undefined);
    const heavy = { source: "日".repeat(100), medium: "本".repeat(100), campaign: "語".repeat(100) };
    const huge = `https://example.com/${"p".repeat(1500)}`;
    assert.ok(buildTrackedUrl(huge, heavy).length > MAX_TRACKED_URL_LENGTH);
    assert.match(trackedUrlTooLong(huge, heavy)!, /too long/);
  });

  it("edit validation keeps UTM in its own columns and applies the same rules", () => {
    const ok = validateLinkEdit({ destination: "https://example.com/?a=1", expiry: "keep", utm: { source: " g ", medium: "", campaign: "c" } });
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.equal(ok.patch.destination_url, "https://example.com/?a=1");
      assert.deepEqual([ok.patch.utm_source, ok.patch.utm_medium, ok.patch.utm_campaign], ["g", null, "c"]);
    }
    const bad = validateLinkEdit({ destination: "https://example.com", expiry: "keep", utm: { source: "a=b", medium: "", campaign: "" } });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.fieldErrors.utm!, /^Source: /);
  });
});

describe("database UTM invariants", () => {
  let db: PGlite;
  before(async () => {
    db = await createTestDb();
  });
  after(async () => {
    await db.close();
  });

  const insert = async (slug: string, column: string, value: string) => {
    try {
      await db.query(
        `insert into public.links (slug, destination_url, expires_at, ${column}) values ($1, 'https://example.com', now() + interval '1 day', $2)`,
        [slug, value],
      );
      return "ok";
    } catch (error) {
      return (error as { code?: string }).code ?? "unknown";
    }
  };

  it("accepts clean values and rejects padded or control characters", async () => {
    assert.equal(await insert("utm-clean", "utm_campaign", "Été 2026 (launch)"), "ok");
    assert.equal(await insert("utm-pad", "utm_source", " google"), "23514");
    assert.equal(await insert("utm-nl", "utm_medium", "e\nmail"), "23514");
    assert.equal(await insert("utm-nul", "utm_campaign", "a\u0007b"), "23514");
  });
});
