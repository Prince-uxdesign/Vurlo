import "server-only";
import { createClient } from "@supabase/supabase-js";
import { logServerError } from "@/lib/links/log";
import type { Database } from "@/types/database";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/utils/env";
import { SUPABASE_TIMEOUT_MS, fetchWithTimeout } from "./fetch";

/**
 * Privileged Supabase client (service role, bypasses RLS).
 *
 * Server-only: `import "server-only"` makes the build fail if a Client
 * Component ever imports this module. Use it only for operations that are
 * validated first, such as creating links. Returns `null` when unconfigured.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!url || !serviceRoleKey) return null;

  try {
    return createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout(SUPABASE_TIMEOUT_MS.admin) },
    });
  } catch (error) {
    // A malformed URL is a deployment mistake. Degrade to "not configured"
    // (a safe 503 for users) and tell the developers why.
    logServerError("supabase_admin_client_invalid", error);
    return null;
  }
}

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
