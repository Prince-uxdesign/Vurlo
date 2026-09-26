import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProtectedPath } from "@/lib/auth/redirect";
import { signInMethods } from "@/lib/settings/account";
import { isExpirationPreference, validateEmailChange, validatePasswordChange } from "@/lib/validation/settings";

describe("password change validation", () => {
  const ok = { current: "old-password-1", next: "a much longer passphrase", confirm: "a much longer passphrase" };

  it("accepts a real change", () => {
    const r = validatePasswordChange(ok, "me@example.com");
    assert.ok(r.ok);
  });

  it("names every problem on its own field", () => {
    const r = validatePasswordChange({ current: "", next: "short", confirm: "" }, "me@example.com");
    assert.ok(!r.ok);
    assert.match(r.fieldErrors.current!, /current password/);
    assert.match(r.fieldErrors.next!, /at least 8/);
    assert.equal(r.fieldErrors.confirm, undefined, "no confirm nag while the new one is invalid");
  });

  it("catches mismatches, reuse, weak and email-as-password", () => {
    const mismatch = validatePasswordChange({ ...ok, confirm: "something else entirely" });
    assert.ok(!mismatch.ok && /don't match/.test(mismatch.fieldErrors.confirm!));
    const reuse = validatePasswordChange({ current: "same-password-9", next: "same-password-9", confirm: "same-password-9" });
    assert.ok(!reuse.ok && /haven't used/.test(reuse.fieldErrors.next!));
    const weak = validatePasswordChange({ ...ok, next: "password123", confirm: "password123" });
    assert.ok(!weak.ok && /too easy/.test(weak.fieldErrors.next!));
    const email = validatePasswordChange({ ...ok, next: "me@example.com", confirm: "me@example.com" }, "me@example.com");
    assert.ok(!email.ok && /same as your email/.test(email.fieldErrors.next!));
  });

  it("refuses absurd input without sending it anywhere", () => {
    const r = validatePasswordChange({ ...ok, current: "x".repeat(5000) });
    assert.ok(!r.ok && r.fieldErrors.current);
    const long = validatePasswordChange({ ...ok, next: "x".repeat(73), confirm: "x".repeat(73) });
    assert.ok(!long.ok && /72 characters or fewer/.test(long.fieldErrors.next!));
  });
});

describe("email change validation", () => {
  it("normalizes and rejects the current address and junk", () => {
    const r = validateEmailChange("  New@Example.com ", "old@example.com");
    assert.ok(r.ok && r.value === "new@example.com");
    const same = validateEmailChange("OLD@example.com", "old@example.com");
    assert.ok(!same.ok && /already your email/.test(same.error));
    for (const bad of ["", "nope", "a@b", `${"a".repeat(250)}@x.com`, "<script>@x.com"]) {
      assert.equal(validateEmailChange(bad, "old@example.com").ok, false, bad);
    }
  });
});

describe("sign-in method detection", () => {
  it("offers password controls only to accounts that have a password", () => {
    const identity = (provider: string) => ({ provider }) as never;
    assert.deepEqual(signInMethods({ identities: [identity("email")], app_metadata: { provider: "email" } }), { password: true, google: false });
    assert.deepEqual(signInMethods({ identities: [identity("google")], app_metadata: { provider: "google", providers: ["google"] } }), { password: false, google: true });
    assert.deepEqual(signInMethods({ identities: [identity("google"), identity("email")], app_metadata: {} }), { password: true, google: true });
    assert.deepEqual(signInMethods({ identities: undefined, app_metadata: { providers: ["google"] } }), { password: false, google: true });
  });
});

describe("preferences + routing", () => {
  it("only accepts expiries Vurlo supports", () => {
    for (const v of ["1d", "7d", "30d", "never"]) assert.ok(isExpirationPreference(v), v);
    for (const v of ["", "90d", "forever", null, 30]) assert.equal(isExpirationPreference(v), false, String(v));
  });
  it("protects every settings page", () => {
    for (const p of ["/settings", "/settings/account", "/settings/security", "/settings/preferences", "/settings/privacy"]) assert.ok(isProtectedPath(p), p);
    assert.equal(isProtectedPath("/settingsx"), false);
  });
});
