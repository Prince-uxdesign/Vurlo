import assert from "node:assert/strict";
import { describe, it } from "node:test";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { footerColumns } from "@/components/marketing/content";

/**
 * Phase 11 launch gates, as code: legal links resolve to real pages, and
 * crawlers are kept out of everything but the public marketing surface.
 */
describe("launch artifacts", () => {
  it("footer legal links point at real pages, not coming-soon text", () => {
    const legal = footerColumns.find((c) => c.heading === "Legal");
    assert.ok(legal);
    for (const link of legal.links) {
      assert.ok(link.href && link.href.startsWith("/"), link.label);
    }
    assert.deepEqual(
      legal.links.map((l) => l.href).sort(),
      ["/privacy", "/terms"],
    );
  });

  it("sitemap lists only the public marketing surface", () => {
    const urls = sitemap().map((e) => e.url);
    assert.equal(urls.length, 3);
    assert.ok(urls.every((u) => !/\/dashboard|\/links|\/account|\/settings|\/api|\/auth/.test(new URL(u).pathname)));
  });

  it("robots keeps crawlers out of app, auth, api and short links", () => {
    const r = robots();
    assert.ok(!Array.isArray(r));
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const disallow = rules.flatMap((rule) => rule?.disallow ?? []);
    for (const p of ["/dashboard", "/links", "/account", "/settings", "/api", "/auth"]) {
      assert.ok(disallow.includes(p), p);
    }
  });
});
