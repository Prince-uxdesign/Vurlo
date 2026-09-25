import "server-only";

/**
 * Structured server logging. Full technical detail goes to the server log
 * (visible to developers); user-facing responses only ever get safe,
 * product-level messages. Never log destination URLs, raw IPs or secrets.
 */
export function logServerError(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, cause: error.cause }
      : typeof error === "object" && error !== null
        ? { ...(error as Record<string, unknown>) }
        : { message: String(error) };
  console.error(JSON.stringify({ level: "error", event, ...context, error: detail }));
}
