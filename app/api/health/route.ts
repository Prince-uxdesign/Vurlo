import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Minimal launch health check (§27): is the app responding, and can it reach
 * the database? Unauthenticated on purpose (load balancers, uptime monitors).
 * The DB probe calls `resolve_link` with a slug that can never exist: it
 * exercises a real round trip and returns zero rows with no error when the
 * database is reachable. Nothing sensitive is returned or logged.
 */
export async function GET() {
  const client = createPublicClient();
  if (!client) {
    return NextResponse.json(
      { status: "degraded", database: "unconfigured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const { error } = await client.rpc("resolve_link", { p_slug: "health-probe-never-exists" });
    if (error) throw error;
    return NextResponse.json(
      { status: "ok", database: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
