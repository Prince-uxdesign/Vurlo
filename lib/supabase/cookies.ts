import type { CookieOptions } from "@supabase/ssr";

/**
 * Session cookie policy. Auth runs entirely on the server (Server Actions,
 * proxy, route handlers) and no browser Supabase client is used, so the
 * session cookies can be HttpOnly: page scripts (and any XSS) can't read
 * them. SameSite=Lax blocks cross-site POSTs from carrying the session.
 */
export const authCookieOptions: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
