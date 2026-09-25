import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACTIVE_LINK_LIMIT, DEFAULT_LIST_PARAMS, buildLinksHref, parseLinkListParams } from "@/lib/links/list-params";
import { TRANSITIONS, UUID_PATTERN, availableActions, isStatusAction, validateLinkEdit } from "@/lib/links/manage";
import { describeExpiry, formatDate, formatRelative } from "@/lib/format";

describe("parseLinkListParams (query string is untrusted)", () => {
  it("defaults", () => {
    assert.deepEqual(parseLinkListParams({}), DEFAULT_LIST_PARAMS);
  });
  it("accepts valid values and normalizes search", () => {
    assert.deepEqual(parseLinkListParams({ q: "  summer   menu ", status: "active", sort: "oldest", page: "3" }), { q: "summer menu", filter: "active", sort: "oldest", page: 3 });
  });
  it("falls back on junk instead of failing", () => {
    for (const bad of [{ status: "hax" }, { status: "" }, { sort: "'; drop table" }, { status: ["active", "expired"] }]) {
      const p = parseLinkListParams(bad as never);
      assert.ok(["all", "active"].includes(p.filter));
      assert.equal(p.sort, "newest");
    }
    assert.equal(parseLinkListParams({ page: "-4" }).page, 1);
    assert.equal(parseLinkListParams({ page: "abc" }).page, 1);
    assert.equal(parseLinkListParams({ page: "999999" }).page, 1000);
    assert.equal(parseLinkListParams({ page: "2.7" }).page, 2);
    assert.equal(parseLinkListParams({ q: "x".repeat(500) }).q.length, 200);
    assert.equal(parseLinkListParams({ q: ["a", "b"] }).q, "a");
  });
});

describe("buildLinksHref", () => {
  it("omits defaults and resets the page on any other change", () => {
    assert.equal(buildLinksHref(DEFAULT_LIST_PARAMS), "/links");
    const p = { q: "a b", filter: "active" as const, sort: "oldest" as const, page: 4 };
    assert.equal(buildLinksHref(p, { page: 5 }), "/links?q=a+b&status=active&sort=oldest&page=5");
    assert.equal(buildLinksHref(p, { filter: "expired" }), "/links?q=a+b&status=expired&sort=oldest");
    assert.equal(buildLinksHref(p, { q: "" }), "/links?status=active&sort=oldest");
  });
  it("round-trips through the parser, including awkward characters", () => {
    const p = { q: `100% "sure" & more/#?`, filter: "disabled" as const, sort: "updated" as const, page: 2 };
    const url = new URL("http://x" + buildLinksHref(p, { page: 2 }));
    assert.deepEqual(parseLinkListParams(Object.fromEntries(url.searchParams)), p);
  });
});

describe("status transitions", () => {
  it("only offers legal actions per stored state", () => {
    assert.deepEqual(availableActions("active"), ["disable", "archive", "delete"]);
    assert.deepEqual(availableActions("disabled"), ["enable", "archive", "delete"]);
    assert.deepEqual(availableActions("archived"), ["unarchive", "delete"]);
    assert.deepEqual(availableActions("deleted"), []);
    assert.deepEqual(availableActions("expired"), []); // never stored
  });
  it("delete is soft and terminal", () => {
    assert.equal(TRANSITIONS.delete.to, "deleted");
    assert.equal(availableActions("deleted").length, 0);
  });
  it("validates action names and ids", () => {
    assert.equal(isStatusAction("archive"), true);
    for (const bad of ["ARCHIVE", "purge", "", null, 5, "__proto__"]) assert.equal(isStatusAction(bad), false);
    assert.equal(UUID_PATTERN.test("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), true);
    for (const bad of ["1", "not-a-uuid", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; --", "", "aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa"]) assert.equal(UUID_PATTERN.test(bad), false);
  });
  it("mirrors the database limit", () => assert.equal(ACTIVE_LINK_LIMIT, 50));
});

describe("validateLinkEdit", () => {
  const ok = { destination: "example.com/new", expiry: "keep" as const, utm: { source: "", medium: "", campaign: "" } };
  it("normalizes and builds a patch that never touches the slug", () => {
    const r = validateLinkEdit(ok, new Date("2026-01-01T00:00:00Z"));
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.patch.destination_url, "https://example.com/new");
      assert.equal("expires_at" in r.patch, false); // keep = don't touch
      assert.equal("slug" in r.patch, false);
      assert.equal(r.patch.utm_source, null);
    }
  });
  it("sets, extends or clears expiry from now", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const seven = validateLinkEdit({ ...ok, expiry: "7d" }, now);
    assert.equal(seven.ok && seven.patch.expires_at, "2026-01-08T00:00:00.000Z");
    const never = validateLinkEdit({ ...ok, expiry: "never" }, now);
    assert.equal(never.ok && never.patch.expires_at, null);
    const junk = validateLinkEdit({ ...ok, expiry: "5y" as never }, now);
    assert.equal(!junk.ok && Boolean(junk.fieldErrors.expiry), true);
  });
  it("rejects dangerous destinations and bad UTM with field-level messages", () => {
    const bad = validateLinkEdit({ destination: "javascript:alert(1)", expiry: "keep", utm: { source: "<b>", medium: "", campaign: "" } });
    assert.equal(!bad.ok && Boolean(bad.fieldErrors.destination) && Boolean(bad.fieldErrors.utm), true);
    assert.equal(validateLinkEdit({ ...ok, destination: "" }).ok, false);
  });
  it("changes the slug only when a different, valid address is asked for", () => {
    const same = validateLinkEdit({ ...ok, alias: " Summer ", currentSlug: "summer" });
    assert.equal(same.ok && "slug" in same.patch, false);
    const moved = validateLinkEdit({ ...ok, alias: "  Autumn-26 ", currentSlug: "summer" });
    assert.equal(moved.ok && moved.patch.slug, "autumn-26");
    const blank = validateLinkEdit({ ...ok, alias: "   ", currentSlug: "summer" });
    assert.equal(blank.ok && "slug" in blank.patch, false);
    for (const alias of ["ab", "has space", "admin", "a/b", "x".repeat(33)]) {
      const r = validateLinkEdit({ ...ok, alias, currentSlug: "summer" });
      assert.equal(!r.ok && Boolean(r.fieldErrors.alias), true, alias);
    }
  });
});

describe("date helpers", () => {
  const now = new Date("2026-09-25T12:00:00Z");
  it("formats in UTC, deterministically", () => assert.match(formatDate("2026-09-25T23:59:00Z"), /^25 Sep\w* 2026$/));
  it("describes relative time", () => {
    assert.equal(formatRelative("2026-09-25T11:59:50Z", now), "just now");
    assert.equal(formatRelative("2026-09-22T12:00:00Z", now), "3 days ago");
    assert.equal(formatRelative("2026-09-27T12:00:00Z", now), "in 2 days");
  });
  it("describes expiry", () => {
    assert.equal(describeExpiry(null, now).text, "No expiry");
    const soon = describeExpiry("2026-09-28T12:00:00Z", now);
    assert.equal(soon.soon, true);
    assert.match(soon.text, /^Expires .* \(in 3 days\)$/);
    const past = describeExpiry("2026-09-20T12:00:00Z", now);
    assert.equal(past.past, true);
    assert.match(past.text, /^Expired 5 days ago$/);
    assert.equal(describeExpiry("2027-09-25T12:00:00Z", now).soon, false);
  });
});
