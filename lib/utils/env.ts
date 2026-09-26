/**
 * Environment helpers (Phase 0A).
 *
 * Supabase variables are intentionally optional at this stage so static
 * development (`next dev`, `next build`) does not break when they are absent.
 * Later phases that require auth/links should check explicitly and fail
 * with a clear message.
 */

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

/** True when both public Supabase vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * Server-only secret. Deliberately NOT prefixed with NEXT_PUBLIC_, so Next.js
 * never inlines it into browser bundles. Only import this from server code
 * (see lib/supabase/admin.ts, which enforces that with `server-only`).
 */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}
