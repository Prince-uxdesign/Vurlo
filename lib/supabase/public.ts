import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/utils/env";
import { SUPABASE_TIMEOUT_MS, fetchWithTimeout } from "./fetch";

/**
 * Cookie-less anon client for anonymous, read-only server work such as
 * resolving a slug for a redirect. It can only do what the `anon` role is
 * granted (execute `resolve_link`); it has no table access.
 */
export function createPublicClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;
  try {
    return createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout(SUPABASE_TIMEOUT_MS.redirect) },
    });
  } catch {
    return null; // treated as "unavailable" by the redirect engine
  }
}
