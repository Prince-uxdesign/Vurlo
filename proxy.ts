import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GUEST_ONLY_PATHS, isProtectedPath } from "@/lib/auth/redirect";
import { authCookieOptions } from "@/lib/supabase/cookies";

/**
 * Session upkeep + route guarding, on the paths that read the session.
 *
 * 1. Refreshes expiring sessions. Server Components can't write cookies, so
 *    without this a refreshed token would be lost and the session would
 *    break. Every page that reads the session must be covered by `matcher`.
 * 2. Redirects guests away from protected pages, and signed-in users away
 *    from sign-in/sign-up. This is UX, not the security boundary: pages and
 *    actions verify the user again themselves.
 *
 * Short-link redirects (`/[slug]`) are deliberately NOT matched, so the
 * redirect hot path never pays for auth.
 */
export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/links/:path*",
    "/account/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/:path*",
    "/api/:path*",
  ],
};

const AUTH_COOKIE = /^sb-.*-auth-token/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name));

  // Server Action calls are POSTs to the page's URL. A redirect answer breaks
  // the action protocol (the client throws and shows the error boundary), so
  // they pass through: every action verifies the session itself and tells
  // the client to send the user to sign in.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  const toLogin = () => {
    if (isServerAction) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  };

  // No session cookie: nothing to refresh. Fast path for anonymous visitors.
  if (!hasSessionCookie) {
    return isProtectedPath(pathname) ? toLogin() : NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return isProtectedPath(pathname) ? toLogin() : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, { ...options, ...authCookieOptions });
        }
      },
    },
  });

  // getClaims validates the token and refreshes it when it has expired.
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch {
    signedIn = false;
  }

  if (!signedIn) {
    // Stale or revoked session: drop the dead cookies so we stop retrying.
    const cleared = isProtectedPath(pathname) ? toLogin() : NextResponse.next();
    for (const cookie of request.cookies.getAll()) {
      if (AUTH_COOKIE.test(cookie.name)) cleared.cookies.set(cookie.name, "", { ...authCookieOptions, maxAge: 0 });
    }
    return cleared;
  }

  if ((GUEST_ONLY_PATHS as readonly string[]).includes(pathname)) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/dashboard";
    dest.search = "";
    const redirect = NextResponse.redirect(dest);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
