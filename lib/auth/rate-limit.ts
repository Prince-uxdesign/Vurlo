import "server-only";
import { headers } from "next/headers";
import { consumeRateLimit } from "@/lib/links/rate-limit";
import { logServerError } from "@/lib/links/log";
import { getClientIp, rateLimitKey } from "@/lib/links/request";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * App-level throttling for credential endpoints, on top of Supabase's own
 * limits. Keys are salted hashes (never raw IPs or emails). Unlike link
 * creation this FAILS OPEN: if the limiter is down the login page must
 * still work, and Supabase keeps enforcing its own limits. Failures are
 * logged.
 */
const LIMITS = {
  login: { limit: 20, windowSeconds: 15 * 60 },
  "login-email": { limit: 10, windowSeconds: 15 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  recover: { limit: 5, windowSeconds: 60 * 60 },
} as const;

export type AuthLimitScope = keyof typeof LIMITS;

/** `subject` defaults to the caller's IP; pass an email for per-account limits. */
export async function checkAuthRateLimit(
  scope: AuthLimitScope,
  subject?: string,
): Promise<{ allowed: boolean }> {
  const client = createAdminClient();
  if (!client) return { allowed: true };
  try {
    const who = subject ?? getClientIp(await headers());
    const key = await rateLimitKey(`auth-${scope}`, who);
    const result = await consumeRateLimit(client, key, LIMITS[scope]);
    return { allowed: result.allowed };
  } catch (error) {
    logServerError("auth_rate_limit_failed", error, { scope });
    return { allowed: true };
  }
}
