import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/utils/env";
import { authCookieOptions } from "./cookies";

/**
 * Server-side Supabase client for Server Components / Route Handlers.
 *
 * Returns `null` when env vars are absent so static builds do not fail.
 * Uses `next/headers` cookies for session handling per the App Router pattern.
 */
export async function createClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, { ...options, ...authCookieOptions });
          });
        } catch {
          // Called from a Server Component — cookies are read-only there.
          // Middleware / Route Handlers will persist the session instead.
        }
      },
    },
  });
}
