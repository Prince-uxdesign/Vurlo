/**
 * Baseline anonymous rate limits (per client IP, fixed window). Deliberately
 * simple: enough to stop casual scripts, easy to tighten later. The client
 * is never trusted to enforce these.
 */
export const CREATE_LINK_LIMIT = { limit: 20, windowSeconds: 60 * 60 } as const;
/**
 * Signed-in creation is metered per account instead of per IP, so people
 * sharing an office or mobile-carrier IP don't use up each other's quota.
 * The 50-active-link cap still bounds what an account can hold.
 */
export const CREATE_LINK_USER_LIMIT = { limit: 60, windowSeconds: 60 * 60 } as const;
/**
 * Edits and status changes per account. Generous (bulk-archiving 50 links
 * fits), but it stops a script hammering renames to probe which aliases
 * exist, or flooding writes.
 */
export const MANAGE_LINK_LIMIT = { limit: 120, windowSeconds: 10 * 60 } as const;
export const ALIAS_CHECK_LIMIT = { limit: 60, windowSeconds: 10 * 60 } as const;

export const MAX_REQUEST_BODY_BYTES = 4 * 1024;
