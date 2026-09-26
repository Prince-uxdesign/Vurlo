import type { Instrumentation } from "next";

/**
 * Last-resort visibility for server errors nothing else caught (a thrown
 * error in a page, route handler, server action or the proxy). One JSON
 * line with where it happened and the digest users see on the error page,
 * so a report can be matched to a log entry.
 *
 * Deliberately NOT logged: request headers (cookies, auth tokens), the query
 * string (email-confirmation tokens travel there), bodies. Messages are
 * redacted. To forward these to an error tracker, send the same object.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { redact } = await import("@/lib/links/log");
  const err = error as { name?: unknown; message?: unknown; digest?: unknown };
  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_server_error",
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
      digest: typeof err?.digest === "string" ? err.digest : undefined,
      error: {
        name: typeof err?.name === "string" ? err.name : "Error",
        message: redact(typeof err?.message === "string" ? err.message : String(error)),
      },
    }),
  );
};
