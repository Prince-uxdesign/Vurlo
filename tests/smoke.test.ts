import assert from "node:assert/strict";
import { describe, it } from "node:test";

const BASE_URL = (
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://vurlo-app.vercel.app"
).replace(/\/$/, "");

describe(`production smoke test against ${BASE_URL}`, () => {
  it("health check returns 200 with database ok", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; database: string };
    assert.equal(body.status, "ok");
    assert.equal(body.database, "ok");
  });

  it("landing page loads successfully", async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Vurlo"));
  });

  it("legal pages are live", async () => {
    const [termsRes, privacyRes] = await Promise.all([
      fetch(`${BASE_URL}/terms`),
      fetch(`${BASE_URL}/privacy`),
    ]);
    assert.equal(termsRes.status, 200);
    assert.equal(privacyRes.status, 200);
    const [termsHtml, privacyHtml] = await Promise.all([
      termsRes.text(),
      privacyRes.text(),
    ]);
    assert.ok(termsHtml.includes("Terms of Service"));
    assert.ok(privacyHtml.includes("Privacy Policy"));
  });

  it("robots and sitemap are live", async () => {
    const [robotsRes, sitemapRes] = await Promise.all([
      fetch(`${BASE_URL}/robots.txt`),
      fetch(`${BASE_URL}/sitemap.xml`),
    ]);
    assert.equal(robotsRes.status, 200);
    assert.equal(sitemapRes.status, 200);
    const [robotsText, sitemapText] = await Promise.all([
      robotsRes.text(),
      sitemapRes.text(),
    ]);
    assert.ok(robotsText.toLowerCase().includes("user-agent"));
    assert.ok(sitemapText.includes("<urlset"));
  });

  it("can shorten a link and resolve 307 redirect end-to-end", async () => {
    const target = `https://example.com/smoke-${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: BASE_URL,
      },
      body: JSON.stringify({ destination: target, expiration: "1d" }),
    });

    const text = await createRes.text();
    assert.ok([200, 201].includes(createRes.status), `create status: ${createRes.status}: ${text}`);
    const data = JSON.parse(text) as { ok: boolean; link: { slug: string; shortUrl: string; displayUrl: string } };
    assert.ok(data.link?.slug);

    // Test redirection (without automatically following redirect)
    const redirectRes = await fetch(`${BASE_URL}/${data.link.slug}`, {
      redirect: "manual",
    });
    assert.ok([307, 308, 301, 302].includes(redirectRes.status), `redirect status: ${redirectRes.status}`);
    assert.equal(redirectRes.headers.get("location"), target);
  });
});
