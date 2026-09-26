import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSlug } from "@/lib/links/generate-slug";
import { RESERVED_SLUGS, isReservedSlug } from "@/lib/links/reserved-slugs";
import { getEffectiveStatus } from "@/lib/links/status";
import {
  applyUtm,
  findUtmConflicts,
  isSafeRedirectUrl,
  isSchemeless,
  normalizeDestination,
  resolveExpiration,
  validateAlias,
  validateExpiresAt,
  validateUtm,
} from "@/lib/validation/link-input";

describe("normalizeDestination", () => {
  it("accepts and normalizes valid web URLs", () => {
    assert.deepEqual(normalizeDestination("https://example.com/a?b=1"), {
      ok: true,
      value: "https://example.com/a?b=1",
    });
    assert.deepEqual(normalizeDestination("  example.com/page "), {
      ok: true,
      value: "https://example.com/page",
    });
    assert.equal(normalizeDestination("HTTP://Example.COM").ok, true);
    assert.equal(normalizeDestination("example.com:8080/x").ok, true);
  });

  it("rejects dangerous and non-web schemes", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://example.com/file",
      "blob:https://example.com/uuid",
      "//evil.com",
      "mailto:a@b.com",
    ]) {
      assert.equal(normalizeDestination(bad).ok, false, bad);
    }
  });

  it("rejects malformed, empty, credentialed and hostless input", () => {
    for (const bad of [
      "",
      "   ",
      "not a url",
      "http://",
      "https://localhost",
      "https://intranet/path",
      "https://google.com@evil.com/",
      "https://user:pass@example.com",
      "https://exa mple.com",
      "https://example.com/\u0000",
      "https://example.com/\nSet-Cookie: x=1",
    ]) {
      assert.equal(normalizeDestination(bad).ok, false, JSON.stringify(bad));
    }
  });

  it("rejects over-long URLs and non-strings", () => {
    assert.equal(normalizeDestination(`https://example.com/${"a".repeat(2100)}`).ok, false);
    assert.equal(normalizeDestination(undefined as unknown as string).ok, false);
    assert.equal(normalizeDestination(42 as unknown as string).ok, false);
  });
});

describe("validateAlias", () => {
  it("treats empty as 'generate one' and lowercases input", () => {
    assert.deepEqual(validateAlias(undefined), { ok: true, value: undefined });
    assert.deepEqual(validateAlias("   "), { ok: true, value: undefined });
    assert.deepEqual(validateAlias(" Summer-Sale "), { ok: true, value: "summer-sale" });
  });

  it("rejects bad formats", () => {
    for (const bad of ["ab", "a".repeat(33), "has space", "emoji😀", "-lead", "a/b", "a.b", "../etc", "<script>"]) {
      const result = validateAlias(bad);
      assert.equal(result.ok, false, bad);
    }
  });

  it("rejects every reserved slug, case-insensitively", () => {
    for (const slug of RESERVED_SLUGS) {
      if (slug.length < 3) continue;
      assert.equal(isReservedSlug(slug.toUpperCase()), true);
      const result = validateAlias(slug.toUpperCase());
      // Reserved names that also fail the format (e.g. leading "_") are still rejected.
      assert.equal(result.ok, false, slug);
    }
    const reserved = validateAlias("Dashboard");
    assert.equal(!reserved.ok && reserved.code, "reserved_alias");
  });
});

describe("expiration", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("resolves presets to absolute timestamps", () => {
    assert.deepEqual(resolveExpiration("1d", { now }), { ok: true, value: "2026-01-02T00:00:00.000Z" });
    assert.deepEqual(resolveExpiration("30d", { now }), { ok: true, value: "2026-01-31T00:00:00.000Z" });
  });

  it("defaults to 30 days and refuses 'never' without an account", () => {
    assert.deepEqual(resolveExpiration(undefined, { now }), { ok: true, value: "2026-01-31T00:00:00.000Z" });
    assert.equal(resolveExpiration("never", { now }).ok, false);
    assert.deepEqual(resolveExpiration("never", { now, allowNever: true }), { ok: true, value: null });
    assert.deepEqual(resolveExpiration(undefined, { now, allowNever: true }), { ok: true, value: null });
  });

  it("rejects unknown presets", () => {
    assert.equal(resolveExpiration("forever" as never, { now }).ok, false);
    assert.equal(resolveExpiration("1d; drop table" as never, { now }).ok, false);
  });

  it("validates explicit dates", () => {
    assert.equal(validateExpiresAt("2025-12-31T00:00:00Z", now).ok, false);
    assert.equal(validateExpiresAt("not a date", now).ok, false);
    assert.equal(validateExpiresAt("2030-01-01T00:00:00Z", now).ok, false);
    assert.equal(validateExpiresAt("2026-02-01T00:00:00Z", now).ok, true);
  });

  it("derives expired status without a stored flag", () => {
    const base = { status: "active" as const, expires_at: "2026-01-01T00:00:00.000Z" };
    assert.equal(getEffectiveStatus(base, new Date("2025-12-31T23:59:59Z")), "active");
    assert.equal(getEffectiveStatus(base, new Date("2026-01-01T00:00:00Z")), "expired");
    assert.equal(getEffectiveStatus({ ...base, expires_at: null }, now), "active");
    // Only active links turn into "expired".
    assert.equal(getEffectiveStatus({ ...base, status: "disabled" }, now), "disabled");
    assert.equal(getEffectiveStatus({ ...base, status: "deleted" }, now), "deleted");
  });
});

describe("utm", () => {
  it("trims, nulls empties and accepts normal values", () => {
    assert.deepEqual(validateUtm({ source: " news ", medium: "", campaign: "spring-2026" }), {
      ok: true,
      value: { source: "news", medium: null, campaign: "spring-2026" },
    });
    assert.deepEqual(validateUtm(undefined), {
      ok: true,
      value: { source: null, medium: null, campaign: null },
    });
  });

  it("rejects long, unusual and non-string values", () => {
    assert.equal(validateUtm({ source: "a".repeat(101) }).ok, false);
    assert.equal(validateUtm({ source: "<script>" }).ok, false);
    assert.equal(validateUtm({ source: "a&utm_medium=evil" }).ok, false);
    assert.equal(validateUtm({ source: 5 as unknown as string }).ok, false);
  });

  it("applyUtm adds only filled params and keeps existing query", () => {
    assert.equal(
      applyUtm("https://example.com/p?x=1", { source: "a", medium: null, campaign: "c" }),
      "https://example.com/p?x=1&utm_source=a&utm_campaign=c",
    );
    assert.equal(applyUtm("https://example.com/", { source: "", medium: "", campaign: "" }), "https://example.com/");
  });
});

describe("utm conflicts and normalization hints", () => {
  it("reports which utm params the form will replace", () => {
    const dest = "https://example.com/?utm_source=old&utm_term=keep&x=1";
    assert.deepEqual(findUtmConflicts(dest, { source: "new", medium: "email" }), ["utm_source"]);
    assert.deepEqual(findUtmConflicts(dest, { source: "", medium: "" }), []);
    assert.equal(applyUtm(dest, { source: "new", medium: null, campaign: null }),
      "https://example.com/?utm_source=new&utm_term=keep&x=1");
  });

  it("keeps fragments and encodes special characters", () => {
    assert.equal(applyUtm("https://example.com/p#section", { source: "a b", medium: null, campaign: null }),
      "https://example.com/p?utm_source=a%20b#section");
  });

  it("flags schemeless input only", () => {
    assert.equal(isSchemeless("example.com"), true);
    assert.equal(isSchemeless("https://example.com"), false);
    assert.equal(isSchemeless("  "), false);
  });
});

describe("isSafeRedirectUrl", () => {
  it("accepts only absolute credential-free http(s) URLs", () => {
    for (const ok of ["https://example.com", "http://example.com/a?b=1#c", "http://8.8.8.8:4000/x"]) {
      assert.equal(isSafeRedirectUrl(ok), true, ok);
    }
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://a.com", "//evil.com", "/path", "example.com", "https://u:p@a.com", "https://", "", "HTTPS:evil", "http://127.0.0.1:4000/x"]) {
      assert.equal(isSafeRedirectUrl(bad), false, bad);
    }
  });
});

describe("generateSlug", () => {
  it("produces 7 URL-safe, lowercase, non-reserved slugs", () => {
    for (let i = 0; i < 2000; i++) {
      const slug = generateSlug();
      assert.match(slug, /^[a-z0-9]{7}$/);
      assert.equal(/[01lo]/.test(slug), false);
    }
  });

  it("is spread widely enough that collisions are rare (and the DB handles the rest)", () => {
    // 32^7 ≈ 3.4e10 slugs. Birthday odds of any collision in n draws ≈ n²/2N:
    // 5,000 draws ≈ 0.04%. (50,000 would be ~4%: a flaky test, not a bug.)
    const seen = new Set<string>();
    for (let i = 0; i < 5_000; i++) seen.add(generateSlug());
    assert.equal(seen.size, 5_000);
  });
});
