import "server-only";

/**
 * Structured server logging: one JSON line per event, so logs can be
 * searched and alerted on (see docs/operations.md). Technical detail goes
 * to the server log; users only ever get product-level messages. Never log
 * passwords, tokens, keys, raw IPs, emails or full destination URLs; errors
 * pass through sanitizeError() to enforce that.
 */
const MAX_MESSAGE = 300;

/**
 * Removes values that must never reach logs from free text: email
 * addresses, JWTs / bearer tokens, and query strings (which can carry
 * tokens, e.g. email-confirmation links). Also caps the length.
 */
export function redact(text: string): string {
  return text
    .replace(/[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}/gi, "[email]")
    .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g, "[jwt]")
    .replace(/\b(bearer|apikey|token)(\s*[:=]?\s*)\S+/gi, "$1$2[redacted]")
    .replace(/(https?:\/\/[^\s?#"']+)\?[^\s"']*/g, "$1?[query]")
    .slice(0, MAX_MESSAGE);
}

/**
 * Keeps only the diagnostic fields of an error. Postgres/PostgREST errors
 * carry `details` (for a CHECK violation: the whole failing row, including
 * a destination URL and owner id), so it is dropped on purpose.
 */
export function sanitizeError(error: unknown, depth = 0): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message),
      ...(error.cause !== undefined && depth < 2 ? { cause: sanitizeError(error.cause, depth + 1) } : {}),
    };
  }
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of ["name", "code", "status", "hint"] as const) {
      if (typeof e[key] === "string" || typeof e[key] === "number") out[key] = typeof e[key] === "string" ? redact(e[key] as string) : e[key];
    }
    if (typeof e.message === "string") out.message = redact(e.message);
    return out;
  }
  return { message: redact(String(error)) };
}

function notifyAlertWebhook(payload: Record<string, unknown>) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `🚨 **[Vurlo Server Error]** \`${String(payload.event)}\`: ${JSON.stringify(payload.error)}`,
        text: `[Vurlo Server Error] ${String(payload.event)}: ${JSON.stringify(payload.error)}`,
        ...payload,
      }),
    }).catch(() => undefined);
  } catch {
    // Ignore webhook network failures so logging never throws
  }
}

export function logServerError(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const payload = { level: "error", event, ...context, error: sanitizeError(error) };
  console.error(JSON.stringify(payload));
  notifyAlertWebhook(payload);
}

/**
 * Abuse/security signal for operators: rate-limit hits, refused requests,
 * blocked destinations, link creation. One JSON line at `warn`, so it can be
 * filtered and alerted on. Same privacy rules: hashed or coarse values only
 * (a destination's hostname at most, never the full URL, raw IP or email).
 */
export function logSecurityEvent(event: string, context: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ level: "warn", kind: "security", event, ...context }));
}

