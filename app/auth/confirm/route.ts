import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { safeNextPath } from "@/lib/auth/redirect";
import { logServerError } from "@/lib/links/log";
import { createClient } from "@/lib/supabase/server";

/**
 * Email links land here (confirm signup, reset password). The template
 * points at /auth/confirm?token_hash=…&type=…, which works on any device
 * because it doesn't depend on a PKCE verifier cookie from the original tab.
 */
const TYPES: readonly EmailOtpType[] = ["signup", "recovery", "email", "email_change", "invite", "magiclink"];

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const { origin } = siteConfig;
  const fail = () => NextResponse.redirect(`${origin}/auth/error?reason=link_expired`);

  if (!tokenHash || !type || !TYPES.includes(type) || tokenHash.length > 512) return fail();

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${origin}/auth/error?reason=unavailable`);

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    logServerError("email_link_verify_failed", error, { code: error.code, type });
    return fail();
  }

  // A recovery link always leads to choosing a new password.
  const destination = type === "recovery" ? "/reset-password" : safeNextPath(params.get("next"));
  return NextResponse.redirect(`${origin}${destination}`);
}
