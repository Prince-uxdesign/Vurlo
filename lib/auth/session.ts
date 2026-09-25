import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-request session reads. `cache` dedupes them across the layout, page
 * and route handlers within one request.
 *
 * - getCurrentUserId: fast. Reads the session cookie and verifies the token
 *   (locally for asymmetric keys). Use for UI state and link ownership.
 * - getVerifiedUser: authoritative. Asks the auth server, so it also fails
 *   for revoked sessions. Use before showing account data or changing
 *   anything sensitive. Never trust the proxy alone: it is a UX layer.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
});

export const getVerifiedUser = cache(async () => {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
});

/**
 * For protected pages. The proxy already redirects guests, but it is only a
 * UX layer: every protected page calls this itself.
 */
export async function requireUser(nextPath: string) {
  const user = await getVerifiedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}
