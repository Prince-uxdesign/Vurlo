import "server-only";
import { headers } from "next/headers";
import { consumeRateLimit } from "@/lib/links/rate-limit";
import { logSecurityEvent, logServerError } from "@/lib/links/log";
import { getClientIp, rateLimitKey } from "@/lib/links/request";
import { BURST, burst } from "@/lib/security/burst";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * App-level throttling for credential endpoints, on top of Supabase's own
 * limits. Progressive, so real people rarely notice it:
 *  1. an in-memory burst guard per IP (scripts firing in a loop),
 *  2. durable per-IP caps per flow,
 *  3. per-account: sign-in counts only FAILED attempts (normal sign-ins
 *     never use up the allowance), and reset emails are capped per
 *     address (silently, so it reveals nothing).
 * Keys are salted hashes (never raw IPs or emails). Unlike link creation
 * these FAIL OPEN: if the limiter is down the login page must still work,
 * and Supabase keeps enforcing its own limits. Failures are logged.
 */
const LIMITS = {
  login: { limit: 20, windowSeconds: 15 * 60 },
  "login-fail": { limit: 10, windowSeconds: 15 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  recover: { limit: 5, windowSeconds: 60 * 60 },
  // Per address, so one inbox can't be flooded with reset emails from many IPs.
  "recover-email": { limit: 3, windowSeconds: 60 * 60 },
} as const;

export type AuthLimitScope = keyof typeof LIMITS;
export interface AuthLimit {
  allowed: boolean;
  retryAfterSeconds: number;
}

const OPEN: AuthLimit = { allowed: true, retryAfterSeconds: 0 };

async function clientIp(): Promise<string> {
  return getClientIp(await headers());
}

/** In-memory guard shared by every auth form, checked before anything else. */
export async function checkAuthBurst(): Promise<AuthLimit> {
  const result = burst.hit(`auth:${await clientIp()}`, BURST.authAttempt);
  if (!result.allowed) logSecurityEvent("rate_limited", { scope: "auth-burst" });
  return result;
}

/** Counts one attempt. `subject` defaults to the caller's IP; pass an email for per-account limits. */
export async function checkAuthRateLimit(scope: AuthLimitScope, subject?: string): Promise<AuthLimit> {
  const client = createAdminClient();
  if (!client) return OPEN;
  try {
    const key = await rateLimitKey(`auth-${scope}`, subject ?? (await clientIp()));
    const result = await consumeRateLimit(client, key, LIMITS[scope]);
    if (!result.allowed) logSecurityEvent("rate_limited", { scope: `auth-${scope}` });
    return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
  } catch (error) {
    logServerError("auth_rate_limit_failed", error, { scope });
    return OPEN;
  }
}

/** Failed sign-ins for this account in the current window, without counting a new one. */
export async function peekLoginFailures(email: string): Promise<AuthLimit & { failures: number }> {
  const client = createAdminClient();
  if (!client) return { ...OPEN, failures: 0 };
  try {
    const { limit, windowSeconds } = LIMITS["login-fail"];
    const { data, error } = await client.rpc("rate_limit_peek", {
      p_key: await rateLimitKey("auth-login-fail", email),
      p_window_seconds: windowSeconds,
    });
    const row = data?.[0];
    if (error || !row) throw new Error("rate limit peek failed", { cause: error });
    return { allowed: row.count < limit, retryAfterSeconds: row.retry_after_seconds, failures: row.count };
  } catch (error) {
    logServerError("auth_rate_limit_failed", error, { scope: "login-fail" });
    return { ...OPEN, failures: 0 };
  }
}

/** Records one wrong password for this account. */
export async function recordLoginFailure(email: string): Promise<number> {
  const client = createAdminClient();
  if (!client) return 0;
  try {
    const key = await rateLimitKey("auth-login-fail", email);
    const result = await consumeRateLimit(client, key, LIMITS["login-fail"]);
    return LIMITS["login-fail"].limit - result.remaining;
  } catch (error) {
    logServerError("auth_rate_limit_failed", error, { scope: "login-fail" });
    return 0;
  }
}
