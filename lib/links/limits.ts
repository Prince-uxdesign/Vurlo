/**
 * Baseline anonymous rate limits (per client IP, fixed window). Deliberately
 * simple: enough to stop casual scripts, easy to tighten later. The client
 * is never trusted to enforce these.
 */
export const CREATE_LINK_LIMIT = { limit: 20, windowSeconds: 60 * 60 } as const;
export const ALIAS_CHECK_LIMIT = { limit: 60, windowSeconds: 10 * 60 } as const;

export const MAX_REQUEST_BODY_BYTES = 4 * 1024;
