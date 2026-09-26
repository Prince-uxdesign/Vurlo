import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent, logServerError } from "@/lib/links/log";

export const dynamic = "force-dynamic";

/** Constant-time comparison, so response timing can't be used to guess the secret. */
function matches(header: string | null, secret: string): boolean {
  const given = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily purge of click events older than the 90-day retention window
 * (scheduled in vercel.json). Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET`. Fails closed: without a configured secret nobody can run
 * it, because this is service-role work on a public URL.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logServerError("cron_secret_not_configured", "CRON_SECRET is not set; purge refused");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!matches(request.headers.get("authorization"), cronSecret)) {
    logSecurityEvent("unauthorized_cron_attempt", { path: "/api/cron/purge-events" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const { data, error } = await admin.rpc("purge_expired_link_events", { p_days: 90 });
    if (error) {
      logServerError("purge_link_events_failed", error);
      return NextResponse.json({ error: "Purge failed" }, { status: 500 });
    }

    return NextResponse.json({ status: "ok", purgedCount: data ?? 0 });
  } catch (error) {
    logServerError("purge_link_events_error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
