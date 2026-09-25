import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/utils/env";

/**
 * Browser-side Supabase client for Client Components.
 *
 * Returns `null` when env vars are absent so the foundation renders without
 * crashing during static development. Callers in later phases must handle
 * the `null` case (e.g. show a configuration message).
 */
export function createClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return null;
  }

  return createBrowserClient<Database>(url, anonKey);
}
