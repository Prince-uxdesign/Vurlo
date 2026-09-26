import React from "react";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountSummary } from "@/components/app/account-summary";
import { FirstLinkGuide } from "@/components/app/first-link-guide";
import { activityLabel, trendWindow, TREND_DAYS } from "@/lib/dashboard/shape";
import type { LinkStats } from "@/lib/links/workspace-types";

/** Phase 7 dashboard, markup level: real counts only, honest limits, no invented comparisons. */

const stats = (active: number, total = active + 4): LinkStats => ({
  total, listed: total, active, expiring: 0, expired: 0, disabled: 0, archived: 0,
});
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("account summary", () => {
  it("shows real counts and nothing that looks like a computed trend", () => {
    const html = renderToStaticMarkup(<AccountSummary stats={stats(32, 41)} totalClicks={1240} />);
    const t = text(html);
    assert.ok(t.includes("32 / 50"), "usage reads 32 / 50");
    assert.ok(t.includes("1.2K"), "all-time clicks");
    assert.ok(t.includes("41"), "total links");
    assert.ok(!/[+−-]\s?\d+(\.\d+)?%/.test(t), "no growth percentages");
    assert.ok(!/this week|vs\.? last|compared/i.test(t), "no invented comparisons");
    assert.ok(html.includes('role="progressbar"') && html.includes('aria-valuetext="32 of 50 active links used, 18 left"'));
  });

  it("says what frees a slot near and at the limit, and never sells an upgrade", () => {
    const near = text(renderToStaticMarkup(<AccountSummary stats={stats(47)} totalClicks={0} />));
    assert.ok(near.includes("3 slots left"));
    const at = renderToStaticMarkup(<AccountSummary stats={stats(50)} totalClicks={0} />);
    assert.ok(text(at).includes("at the limit"));
    assert.ok(at.includes('href="/links?status=active"'), "points to the links that can be turned off");
    for (const html of [near, at]) assert.ok(!/upgrade|premium|pro plan|pricing/i.test(html));
  });

  it("an unavailable click count is unavailable, not zero", () => {
    const t = text(renderToStaticMarkup(<AccountSummary stats={stats(3)} totalClicks={null} />));
    assert.ok(t.includes("Unavailable"));
    assert.ok(!/Total clicks 0\b/.test(t));
  });
});

describe("new account", () => {
  it("sets expectations in three short lines", () => {
    const html = renderToStaticMarkup(<FirstLinkGuide />);
    assert.equal((html.match(/<li/g) ?? []).length, 3);
    assert.ok(text(html).includes("50 active links"));
  });
});

describe("activity + trend window", () => {
  it("labels activity in plain words with correct plurals", () => {
    const base = { linkId: "x", slug: "s", occurredAt: new Date().toISOString(), clicks: 0 };
    assert.equal(activityLabel({ ...base, kind: "updated" }), "Edited");
    assert.equal(activityLabel({ ...base, kind: "clicked", clicks: 1 }), "1 click in the last 24 hours");
    assert.equal(activityLabel({ ...base, kind: "clicked", clicks: 14 }), "14 clicks in the last 24 hours");
  });

  it("aligns the trend to UTC days: exactly 30 buckets ending today", () => {
    const { start, end } = trendWindow(new Date("2026-09-26T15:30:00Z"));
    assert.equal(start.toISOString(), "2026-08-28T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-09-26T15:30:00.000Z");
    assert.equal((Date.UTC(2026, 8, 26) - start.getTime()) / 86400_000 + 1, TREND_DAYS);
  });
});
