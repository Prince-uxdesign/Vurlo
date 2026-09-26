import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
type PublicClient = NonNullable<ReturnType<typeof createPublicClient>>;
import { applyUtm, isSafeRedirectUrl, SLUG_PATTERN } from "@/lib/validation/link-input";
import { logServerError } from "./log";

export type ResolveResult =
  | { kind: "redirect"; url: string }
  | { kind: "expired" }
  | { kind: "disabled" }
  | { kind: "archived" }
  | { kind: "unavailable" }
  | { kind: "not_found" };

/**
 * Resolves a slug for a redirect using only the anon role and the
 * `resolve_link` function, in a single database round trip. Deleted links
 * and unknown slugs are both `not_found`, so a deleted link's existence
 * isn't revealed. Expiry is decided in SQL (`effective_link_status`) from
 * the database clock, never from the browser.
 */
export async function resolveLink(
  rawSlug: string,
  deps: { client?: PublicClient | null } = {},
): Promise<ResolveResult> {
  const slug = rawSlug.toLowerCase();
  // Cheap rejection of junk like /wp-login.php before any database call.
  if (!SLUG_PATTERN.test(slug)) return { kind: "not_found" };

  const client = deps.client === undefined ? createPublicClient() : deps.client;
  if (!client) return { kind: "unavailable" };

  type Rpc = Awaited<ReturnType<typeof client.rpc<"resolve_link">>>;
  const lookup = async (): Promise<Pick<Rpc, "data" | "error">> => {
    try {
      return await client.rpc("resolve_link", { p_slug: slug });
    } catch (thrown) {
      // supabase-js reports failures as values; this guards the hot path anyway.
      return { data: null, error: { message: thrown instanceof Error ? thrown.message : "lookup threw", code: "", details: "", hint: "", name: "PostgrestError" } as Rpc["error"] };
    }
  };
  let { data, error } = await lookup();
  // One retry for transport failures only (timeout, dropped connection:
  // no SQLSTATE). A database error won't fix itself in milliseconds.
  if (error && !error.code) ({ data, error } = await lookup());
  if (error) {
    logServerError("resolve_link_failed", error, { slug, transport: !error.code });
    return { kind: "unavailable" };
  }
  const row = data?.[0];
  if (!row) return { kind: "not_found" };

  switch (row.status) {
    case "active":
      if (!row.destination_url || !isSafeRedirectUrl(row.destination_url)) {
        // Should be impossible (database CHECK + create-time validation).
        // If it ever happens, refuse to redirect and tell the developers.
        logServerError("unsafe_stored_destination", "stored destination failed redirect validation", { slug });
        return { kind: "unavailable" };
      }
      const url = applyUtm(row.destination_url, {
        source: row.utm_source,
        medium: row.utm_medium,
        campaign: row.utm_campaign,
      });
      if (!isSafeRedirectUrl(url)) return { kind: "unavailable" };
      return { kind: "redirect", url };
    case "expired":
      return { kind: "expired" };
    case "disabled":
      return { kind: "disabled" };
    case "archived":
      return { kind: "archived" };
    default:
      // deleted (or anything unknown): reveal nothing, look like a missing link.
      return { kind: "not_found" };
  }
}
