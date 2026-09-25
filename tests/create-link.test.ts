import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLink } from "@/lib/links/create-link";
import type { AdminClient } from "@/lib/supabase/admin";

type InsertRow = Record<string, unknown>;
type DbError = { code: string; message: string } | null;

/** Minimal stand-in for the Supabase insert().select().single() chain. */
function fakeClient(respond: (row: InsertRow, call: number) => DbError) {
  const rows: InsertRow[] = [];
  const client = {
    from() {
      return {
        insert(row: InsertRow) {
          const error = respond(row, rows.length);
          rows.push(row);
          return {
            select: () => ({
              single: async () => ({
                data: error
                  ? null
                  : {
                      slug: row.slug,
                      destination_url: row.destination_url,
                      is_custom_alias: row.is_custom_alias,
                      expires_at: row.expires_at,
                      utm_source: row.utm_source,
                      utm_medium: row.utm_medium,
                      utm_campaign: row.utm_campaign,
                    },
                error,
              }),
            }),
          };
        },
      };
    },
  } as unknown as AdminClient;
  return { client, rows };
}

const collision = { code: "23505", message: 'duplicate key value violates unique constraint "links_slug_key"' };

describe("createLink", () => {
  it("creates an anonymous link with a generated slug", async () => {
    const { client, rows } = fakeClient(() => null);
    const result = await createLink({ destination: "example.com/a", expiration: "7d", utm: { source: "x" } }, {
      client,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    assert.equal(result.ok, true);
    assert.equal(rows[0].user_id, null);
    assert.equal(rows[0].is_custom_alias, false);
    assert.equal(rows[0].destination_url, "https://example.com/a");
    assert.equal(rows[0].expires_at, "2026-01-08T00:00:00.000Z");
    assert.equal(rows[0].utm_source, "x");
    if (result.ok) {
      assert.match(result.link.slug, /^[a-z0-9]{7}$/);
      assert.equal("userId" in result.link, false);
    }
  });

  it("defaults anonymous links to a 30 day expiry and refuses 'never'", async () => {
    const { client, rows } = fakeClient(() => null);
    const now = new Date("2026-01-01T00:00:00Z");
    await createLink({ destination: "https://example.com" }, { client, now });
    assert.equal(rows[0].expires_at, "2026-01-31T00:00:00.000Z");
    const refused = await createLink({ destination: "https://example.com", expiration: "never" }, { client, now });
    assert.equal(!refused.ok && refused.code, "invalid_expiration");
    assert.equal(rows.length, 1);
  });

  it("allows no expiry for owned links", async () => {
    const { client, rows } = fakeClient(() => null);
    await createLink({ destination: "https://example.com", expiration: "never" }, { client, userId: "u1" });
    assert.equal(rows[0].expires_at, null);
  });

  it("stores ownership when a user id is supplied", async () => {
    const { client, rows } = fakeClient(() => null);
    await createLink({ destination: "https://example.com" }, { client, userId: "11111111-1111-1111-1111-111111111111" });
    assert.equal(rows[0].user_id, "11111111-1111-1111-1111-111111111111");
  });

  it("retries a generated slug on collision, then succeeds", async () => {
    const { client, rows } = fakeClient((_row, call) => (call < 2 ? collision : null));
    const result = await createLink({ destination: "https://example.com" }, { client });
    assert.equal(result.ok, true);
    assert.equal(rows.length, 3);
    assert.equal(new Set(rows.map((r) => r.slug)).size, 3);
  });

  it("gives up after repeated collisions", async () => {
    const { client, rows } = fakeClient(() => collision);
    const result = await createLink({ destination: "https://example.com" }, { client });
    assert.equal(!result.ok && result.code, "slug_generation_failed");
    assert.equal(rows.length, 5);
  });

  it("reports a taken custom alias without retrying", async () => {
    const { client, rows } = fakeClient(() => collision);
    const result = await createLink({ destination: "https://example.com", alias: "Summer" }, { client });
    assert.equal(!result.ok && result.code, "alias_taken");
    assert.equal(!result.ok && result.field, "alias");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, "summer");
    assert.equal(rows[0].is_custom_alias, true);
  });

  it("never leaks database error text", async () => {
    const { client } = fakeClient(() => ({ code: "XX000", message: "secret internal detail" }));
    const result = await createLink({ destination: "https://example.com" }, { client });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });

  it("rejects bad input before touching the database", async () => {
    const { client, rows } = fakeClient(() => null);
    const cases: Array<[unknown, string]> = [
      [null, "invalid_destination"],
      ["https://example.com", "invalid_destination"],
      [{ destination: "javascript:alert(1)" }, "invalid_destination"],
      [{ destination: "https://example.com", alias: "api" }, "reserved_alias"],
      [{ destination: "https://example.com", alias: "a b" }, "invalid_alias"],
      [{ destination: "https://example.com", alias: 42 }, "invalid_alias"],
      [{ destination: "https://example.com", expiration: "99y" }, "invalid_expiration"],
      [{ destination: "https://example.com", utm: { source: "<x>" } }, "invalid_utm"],
    ];
    for (const [input, code] of cases) {
      const result = await createLink(input, { client });
      assert.equal(!result.ok && result.code, code, JSON.stringify(input));
    }
    assert.equal(rows.length, 0);
  });

  it("fails safe when Supabase isn't configured", async () => {
    const result = await createLink({ destination: "https://example.com" }, { client: null });
    assert.equal(!result.ok && result.code, "not_configured");
  });
});
