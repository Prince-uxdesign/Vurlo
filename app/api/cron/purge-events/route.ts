import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent, logServerError } from "@/lib/links/log";

export const dynamic = "force-dynamic";

/**
 * Scheduled maintenance cron for purging link events older than the 90-day retention window.
 * Authenticated via Vercel Cron header or optional CRON_SECRET Bearer token.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
