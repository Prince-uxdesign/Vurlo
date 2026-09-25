/**
 * `next` parameters come from URLs anyone can craft, so they are treated as
 * hostile. Only same-origin absolute paths are followed; anything else falls
 * back to a safe default. This blocks open redirects such as
 * `?next=//evil.com`, `?next=/\evil.com`, `?next=https://evil.com`.
 */
export function safeNextPath(raw: unknown, fallback = "/dashboard"): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  try {
    // Percent-encoded control characters (e.g. %0d%0a) are refused too.
    if (/[\u0000-\u001f\u007f\\]/.test(decodeURIComponent(raw))) return fallback;
  } catch {
    return fallback; // malformed escape sequence
  }
  try {
    const url = new URL(raw, "http://vurlo.invalid");
    if (url.origin !== "http://vurlo.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Paths that require a signed-in user. Checked in proxy AND in each page/action. */
export const PROTECTED_PATHS = ["/dashboard", "/links", "/account"] as const;
/** Pages a signed-in user has no reason to see. */
export const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
