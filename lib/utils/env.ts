/**
 * Environment helpers. Supabase variables are optional so `next build` works
 * without them; each client factory returns null when they are missing and
 * its callers degrade to an "unavailable" state.
 */

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

/**
 * Server-only secret. Deliberately NOT prefixed with NEXT_PUBLIC_, so Next.js
 * never inlines it into browser bundles. Only import this from server code
 * (see lib/supabase/admin.ts, which enforces that with `server-only`).
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}
