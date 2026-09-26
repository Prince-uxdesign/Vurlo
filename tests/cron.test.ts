import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GET } from "@/app/api/cron/purge-events/route";

const call = (authorization?: string) =>
  GET(new Request("https://vurlo.test/api/cron/purge-events", authorization ? { headers: { authorization } } : {}));

describe("retention purge cron (service-role work on a public URL)", () => {
  const saved = process.env.CRON_SECRET;
  afterEach(() => {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it("refuses everyone when no secret is configured (fails closed)", async () => {
    delete process.env.CRON_SECRET;
    assert.equal((await call()).status, 503);
    assert.equal((await call("Bearer anything")).status, 503);
  });

  it("refuses a missing or wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    assert.equal((await call()).status, 401);
    assert.equal((await call("Bearer wrong")).status, 401);
    assert.equal((await call("s3cret-value")).status, 401, "the Bearer scheme is required");
  });

  it("lets the right secret through to the purge", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    // No database is configured in tests, so the authorized call reaches the
    // purge step and reports the database as unavailable.
    const res = await call("Bearer s3cret-value");
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "Database unavailable" });
  });
});
