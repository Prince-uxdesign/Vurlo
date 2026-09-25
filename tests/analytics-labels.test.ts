import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIMENSION_TITLES,
  countryLabel,
  dimensionLabel,
  formatBucketFull,
  formatBucketTick,
  formatCount,
  referrerLabel,
} from "@/lib/analytics/labels";

describe("referrer labels (honest, never claiming typed URLs)", () => {
  it("names known platforms and marks direct as unknown", () => {
    assert.equal(referrerLabel("direct"), "Direct / Unknown");
    assert.equal(referrerLabel("google"), "Google");
    assert.equal(referrerLabel("instagram"), "Instagram");
    assert.equal(referrerLabel("facebook"), "Facebook");
    assert.equal(referrerLabel("linkedin"), "LinkedIn");
    assert.equal(referrerLabel("twitter"), "X (Twitter)");
    assert.equal(referrerLabel("other"), "Other");
  });

  it("falls back to a readable stored value, never blank or invented", () => {
    assert.equal(referrerLabel("newsletter"), "Newsletter");
    assert.equal(referrerLabel(""), "Unknown");
  });
});

describe("dimension and country labels", () => {
  it("labels devices, browsers and systems in plain words", () => {
    assert.equal(dimensionLabel("device", "mobile"), "Mobile");
    assert.equal(dimensionLabel("browser", "chrome"), "Chrome");
    assert.equal(dimensionLabel("os", "macos"), "macOS");
    assert.equal(dimensionLabel("device", "unknown"), "Unknown");
    assert.equal(dimensionLabel("browser", "weird-future"), "Weird-future");
  });

  it("expands country codes, keeps unknown honest", () => {
    assert.equal(countryLabel("US"), "United States");
    assert.equal(countryLabel("DE"), "Germany");
    assert.equal(countryLabel("unknown"), "Unknown");
    assert.equal(countryLabel("XX"), "Unknown"); // unassigned code stays unclaimed
    assert.equal(dimensionLabel("country", "GB"), "United Kingdom");
  });

  it("titles every breakdown with a plain-language hint", () => {
    for (const d of ["device", "browser", "os", "country", "referrer"] as const) {
      assert.ok(DIMENSION_TITLES[d].title.length > 0);
      assert.ok(DIMENSION_TITLES[d].hint.length > 0);
    }
    assert.match(DIMENSION_TITLES.referrer.hint, /Direct \/ Unknown/);
    assert.match(DIMENSION_TITLES.country.hint, /Approximate/);
  });
});

describe("count and tick formatting", () => {
  it("keeps small counts exact, compacts large ones", () => {
    assert.equal(formatCount(0), "0");
    assert.equal(formatCount(999), "999");
    assert.ok(formatCount(1240).includes("1.2"));
  });

  it("formats ticks UTC-stable (no server/client mismatch)", () => {
    assert.equal(formatBucketTick("2026-09-25T14:00:00.000Z", "hour"), "14:00");
    assert.equal(formatBucketTick("2026-09-25T14:00:00.000Z", "day"), "25 Sep");
    assert.equal(formatBucketFull("2026-09-25T14:00:00.000Z", "hour"), "25 Sep, 14:00");
    assert.equal(formatBucketFull("2026-09-25T14:00:00.000Z", "day"), "25 Sep");
  });
});
