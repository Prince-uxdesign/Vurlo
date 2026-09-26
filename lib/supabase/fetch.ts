/**
 * fetch with a hard deadline, for Supabase clients. supabase-js has no
 * timeout of its own, so a hung connection would otherwise hold a redirect
 * (or a page) open until the platform kills the function. A timed-out call
 * surfaces as an ordinary error, and every caller already degrades on errors.
 */
export const SUPABASE_TIMEOUT_MS = {
  /** The redirect hot path: fail fast, retry once (see resolve-link.ts). */
  redirect: 2_500,
  /** Signed-in pages and actions. */
  user: 8_000,
  /** Service-role work: link creation, limiter, click recording. */
  admin: 8_000,
} as const;

export function fetchWithTimeout(ms: number): typeof fetch {
  return (input, init) => {
    const deadline = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return fetch(input, { ...init, signal });
  };
}
