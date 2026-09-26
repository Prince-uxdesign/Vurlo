import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath } from "@/lib/auth/redirect";
import { isReservedSlug } from "@/lib/links/reserved-slugs";
import {
  blockedDestinationReason,
  isSafeRedirectUrl,
  normalizeDestination,
  validateAlias,
} from "@/lib/validation/link-input";

/**
 * Phase 8A: hostile-input tests. Every value here is something an attacker
 * would actually try against a URL shortener.
 */

describe("destinations: schemes and parsing tricks", () => {
  const rejected = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "javascript&colon;alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "DATA:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "ftp://files.example.com/x",
    "blob:https://example.com/uuid",
    "//evil.com/path",
    "/\\evil.com",
    "\\\\evil.com",
    "https:evil.com",
    "https:/evil.com",
    "https://user:pass@example.com",
    "https://google.com@evil.com",
    "https://",
    "https://.",
    "https://..example.com",
    "https://example..com",
    "http://[::1]/",
    `https://example.com/${"a".repeat(2100)}`,
  ];
  for (const raw of rejected) {
    it(`rejects ${JSON.stringify(raw.slice(0, 50))}`, () => {
      assert.equal(normalizeDestination(raw).ok, false);
    });
  }

  it("percent-encoded schemes can only ever become an https:// URL", () => {
    for (const raw of ["%6A%61%76%61script:alert(1)", "%2F%2Fevil.com", "java%0Ascript:alert(1)"]) {
      const r = normalizeDestination(raw);
      if (r.ok) assert.match(r.value, /^https:\/\//, raw);
    }
  });

  it("accepts ordinary public URLs, including IDNs and public IPs", () => {
    for (const raw of ["https://example.com", "example.com/page?q=1#x", "http://8.8.8.8/", "https://bücher.example/", "https://172.32.0.1/"]) {
      const r = normalizeDestination(raw);
      assert.ok(r.ok, raw);
      if (r.ok) assert.match(r.value, /^https?:\/\/[\x21-\x7e]+$/, "stored form is ASCII (punycode)");
    }
  });
});

describe("destinations: loops and private networks", () => {
  const u = (s: string) => new URL(s);

  it("refuses links to Vurlo itself, in any spelling", () => {
    for (const s of ["https://vurlo.app/abc", "https://VURLO.APP/abc", "https://vurlo.app./abc", "https://www.vurlo.app/x", "http://vurlo.app:8080/x"]) {
      assert.ok(blockedDestinationReason(u(s), "vurlo.app"), s);
    }
    assert.equal(blockedDestinationReason(u("https://notvurlo.app/x"), "vurlo.app"), null, "lookalike suffix is a different site");
  });

  it("refuses private, loopback, link-local and special-use hosts, however they're written", () => {
    for (const s of [
      "http://127.0.0.1/", "http://127.1/", "http://2130706433/", "http://0x7f.0.0.1/", "http://0177.0.0.1/",
      "http://10.0.0.5/", "http://192.168.1.1/admin", "http://172.16.0.1/", "http://172.31.255.255/",
      "http://169.254.169.254/latest/meta-data/", "http://100.64.0.1/", "http://0.0.0.0/", "http://224.0.0.1/",
      "http://router.local/", "http://nas.internal/", "http://printer.home.arpa/", "http://app.localhost/", "http://x.test/",
    ]) {
      assert.ok(blockedDestinationReason(u(s), "vurlo.app"), s);
    }
  });

  it("applies the same rules at redirect time (direct database edits can't bypass them)", () => {
    assert.equal(isSafeRedirectUrl("http://192.168.0.1/"), false);
    assert.equal(isSafeRedirectUrl("http://169.254.169.254/"), false);
    assert.equal(isSafeRedirectUrl("https://example.com/ok"), true);
  });
});

describe("aliases: route collisions, normalization and weird input", () => {
  it("reserves every real app route and account-sounding words", () => {
    for (const s of ["dashboard", "links", "login", "signup", "forgot-password", "reset-password", "account", "api", "auth", "verify", "confirm", "password", "sign-in", "Admin", "VURLO"]) {
      assert.ok(isReservedSlug(s), s);
      const v = validateAlias(s);
      assert.ok(!v.ok && v.code === "reserved_alias", s);
    }
  });

  it("normalizes case and refuses anything that isn't a plain ASCII slug", () => {
    const upper = validateAlias("  MyLink  ");
    assert.ok(upper.ok && upper.value === "mylink");
    for (const bad of ["ａｂｃ", "раураl", "abc%2f", "../abc", "abc/def", "a b c", "abc.html", "-abc", "_abc", "ab", "a".repeat(33), "abc​", "İstanbul", "abc?x=1", "abc#x", "<script>"]) {
      assert.equal(validateAlias(bad).ok, false, JSON.stringify(bad));
    }
  });
});

describe("post-login redirect (next=)", () => {
  it("only ever returns a same-site path", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "\\/evil.com", "https://evil.com", "javascript:alert(1)", "/%0d%0aSet-Cookie:x=1", "/\t/evil.com", " /x", "%2F%2Fevil.com", "/%5Cevil.com"]) {
      const out = safeNextPath(bad);
      assert.ok(out.startsWith("/") && !out.startsWith("//") && !out.includes("\\"), `${bad} -> ${out}`);
      assert.ok(!/evil\.com/.test(new URL(out, "https://vurlo.app").host), bad);
    }
  });
});

describe("salts", () => {
  it("never uses the public dev salt in production", async () => {
    const { serverSalt } = await import("@/lib/utils/secrets");
    const env = process.env as Record<string, string | undefined>;
    const saved = { NODE_ENV: env.NODE_ENV, RATE_LIMIT_SALT: env.RATE_LIMIT_SALT, KEY: env.SUPABASE_SERVICE_ROLE_KEY };
    const errors = console.error;
    console.error = () => {};
    try {
      env.NODE_ENV = "production";
      delete env.RATE_LIMIT_SALT;
      env.SUPABASE_SERVICE_ROLE_KEY = "secret-key";
      const derived = serverSalt("RATE_LIMIT_SALT");
      assert.notEqual(derived, "vurlo-dev-salt");
      assert.match(derived, /^[0-9a-f]{64}$/);
      delete env.SUPABASE_SERVICE_ROLE_KEY;
      assert.throws(() => serverSalt("RATE_LIMIT_SALT"), "refuses rather than hash with a public value");
      env.RATE_LIMIT_SALT = "configured";
      assert.equal(serverSalt("RATE_LIMIT_SALT"), "configured");
    } finally {
      console.error = errors;
      env.NODE_ENV = saved.NODE_ENV;
      if (saved.RATE_LIMIT_SALT === undefined) delete env.RATE_LIMIT_SALT; else env.RATE_LIMIT_SALT = saved.RATE_LIMIT_SALT;
      if (saved.KEY === undefined) delete env.SUPABASE_SERVICE_ROLE_KEY; else env.SUPABASE_SERVICE_ROLE_KEY = saved.KEY;
    }
  });
});

describe("security headers", () => {
  it("sets a CSP that forbids framing, plugins and foreign scripts, plus the basics", async () => {
    const config = (await import("../next.config")).default;
    const rules = await config.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const h = Object.fromEntries(all.headers.map((x) => [x.key.toLowerCase(), x.value]));
    const csp = h["content-security-policy"]!;
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp.match(/script-src[^;]*/)![0], /https?:|\*/, "no third-party script origins");
    assert.equal(h["x-content-type-options"], "nosniff");
    assert.equal(h["x-frame-options"], "DENY");
    assert.equal(h["referrer-policy"], "strict-origin-when-cross-origin");
    assert.match(h["permissions-policy"]!, /camera=\(\)/);
    assert.equal(config.poweredByHeader, false);
  });
});
