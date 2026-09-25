import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTH_MESSAGES, classifyAuthError } from "@/lib/auth/errors";
import { GUEST_ONLY_PATHS, isProtectedPath, safeNextPath } from "@/lib/auth/redirect";
import { validateEmail, validateNewPassword } from "@/lib/validation/auth";

describe("validateEmail", () => {
  it("accepts and normalizes valid addresses", () => {
    assert.deepEqual(validateEmail("  Name+tag@Example.COM "), { ok: true, value: "name+tag@example.com" });
    assert.equal(validateEmail("a@b.co").ok, true);
  });
  it("rejects empty, malformed and oversized input", () => {
    for (const bad of ["", "   ", "plain", "a@b", "@b.com", "a@.com", "a b@c.com", "a@b.c", `${"a".repeat(250)}@b.com`, null, undefined, 42, {}]) {
      assert.equal(validateEmail(bad).ok, false, String(bad));
    }
  });
});

describe("validateNewPassword", () => {
  it("enforces length, not composition", () => {
    assert.equal(validateNewPassword("abcdefgh").ok, true); // lowercase only is fine
    assert.equal(validateNewPassword("correct horse battery staple").ok, true);
    assert.equal(validateNewPassword("short7!").ok, false);
    assert.equal(validateNewPassword("x".repeat(72)).ok, true);
    assert.equal(validateNewPassword("x".repeat(73)).ok, false);
    assert.equal(validateNewPassword("é".repeat(37)).ok, false); // 74 bytes: bcrypt would truncate
  });
  it("rejects common passwords and the account email", () => {
    for (const bad of ["password", "PASSWORD123", "12345678", "qwertyuiop"]) assert.equal(validateNewPassword(bad).ok, false, bad);
    assert.equal(validateNewPassword("me@example.com", "me@example.com").ok, false);
  });
  it("explains what to do", () => {
    const r = validateNewPassword("abc");
    assert.equal(!r.ok && r.error, "Use at least 8 characters.");
    assert.equal(validateNewPassword("", undefined).ok, false);
    assert.equal(validateNewPassword(undefined).ok, false);
  });
});

describe("safeNextPath (open-redirect defence)", () => {
  it("keeps same-origin paths", () => {
    assert.equal(safeNextPath("/account"), "/account");
    assert.equal(safeNextPath("/account?notice=x#y"), "/account?notice=x#y");
    assert.equal(safeNextPath("/"), "/");
  });
  it("falls back for everything that could leave the site", () => {
    for (const evil of ["//evil.com", "///evil.com", "/\\evil.com", "\\\\evil.com", "https://evil.com", "http://evil.com/x", "javascript:alert(1)", "evil.com", "", "/%0d%0aSet-Cookie:x=1", "/a\r\nb", "/a\tb", null, undefined, 5, ["/x"], "/" + "a".repeat(600)]) {
      assert.equal(safeNextPath(evil), "/dashboard", JSON.stringify(evil));
    }
    assert.equal(safeNextPath("//evil.com", "/"), "/");
  });
});

describe("route guards", () => {
  it("protects the signed-in area and its children only", () => {
    assert.equal(isProtectedPath("/account"), true);
    assert.equal(isProtectedPath("/dashboard"), true);
    assert.equal(isProtectedPath("/links"), true);
    assert.equal(isProtectedPath("/links/abc"), true);
    assert.equal(isProtectedPath("/account/settings"), true);
    assert.equal(isProtectedPath("/linksfoo"), false);
    assert.equal(isProtectedPath("/accountant"), false);
    assert.equal(isProtectedPath("/"), false);
    assert.equal(isProtectedPath("/login"), false);
  });
  it("keeps reset-password reachable when signed in", () => {
    assert.equal((GUEST_ONLY_PATHS as readonly string[]).includes("/reset-password"), false);
    assert.equal((GUEST_ONLY_PATHS as readonly string[]).includes("/login"), true);
  });
});

describe("auth error mapping", () => {
  it("maps known codes and never returns raw text", () => {
    assert.equal(classifyAuthError({ code: "invalid_credentials" }), "invalid_credentials");
    assert.equal(classifyAuthError({ code: "user_already_exists" }), "already_registered");
    assert.equal(classifyAuthError({ code: "over_email_send_rate_limit" }), "rate_limited");
    assert.equal(classifyAuthError({ status: 429 }), "rate_limited");
    assert.equal(classifyAuthError({ status: 503 }), "unavailable");
    assert.equal(classifyAuthError({ status: 0 }), "unavailable");
    assert.equal(classifyAuthError({ code: "something_new", message: "secret internal detail" }), "unknown");
    assert.equal(classifyAuthError(null), "unknown");
    for (const message of Object.values(AUTH_MESSAGES)) assert.doesNotMatch(message, /supabase|postgres|jwt|gotrue|stack/i);
  });
  it("gives one identical message for wrong password and unknown email", () => {
    assert.equal(AUTH_MESSAGES[classifyAuthError({ code: "invalid_credentials" })], "Incorrect email or password.");
  });
});
