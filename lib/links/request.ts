import "server-only";
import { serverSalt } from "@/lib/utils/secrets";
import { MAX_REQUEST_BODY_BYTES } from "./limits";

/**
 * First hop of x-forwarded-for, then x-real-ip. Only trustworthy behind a
 * proxy that overwrites these headers (Vercel does). Requests with no IP
 * share one "unknown" bucket, which is intentionally the strictest case.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Salted SHA-256 so raw IPs are never stored. */
export async function rateLimitKey(scope: string, ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${serverSalt("RATE_LIMIT_SALT")}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${scope}:${hex}`;
}

/** Blocks cross-site browser requests. Non-browser clients send no Origin. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" | "wrong_type" };

/** Reads a small JSON body, refusing anything oversized before parsing. */
export async function readJsonBody(request: Request): Promise<BodyResult> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { ok: false, reason: "wrong_type" };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_REQUEST_BODY_BYTES) return { ok: false, reason: "too_large" };

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BODY_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
