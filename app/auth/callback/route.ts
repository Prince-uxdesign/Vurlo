import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { safeNextPath } from "@/lib/auth/redirect";
import { logServerError } from "@/lib/links/log";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) return point. Exchanges the one-time code for a session
 * using the PKCE verifier cookie set when the flow started in this browser.
 * Provider error text is never echoed to the user.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origin = new URL(siteConfig.url).origin;
  const to = (reason: string) => NextResponse.redirect(`${origin}/auth/error?reason=${reason}`);

  if (params.get("error")) {
    return to(params.get("error") === "access_denied" ? "oauth_denied" : "oauth_failed");
  }
  const code = params.get("code");
  if (!code || code.length > 512) return to("oauth_failed");

  const supabase = await createClient();
  if (!supabase) return to("unavailable");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logServerError("oauth_exchange_failed", error, { code: error.code });
    return to("oauth_failed");
  }
  return NextResponse.redirect(`${origin}${safeNextPath(params.get("next"))}`);
}
