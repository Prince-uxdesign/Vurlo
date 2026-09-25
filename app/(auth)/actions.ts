"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { AUTH_MESSAGES, classifyAuthError } from "@/lib/auth/errors";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { safeNextPath } from "@/lib/auth/redirect";
import { getVerifiedUser } from "@/lib/auth/session";
import { logServerError } from "@/lib/links/log";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validateNewPassword } from "@/lib/validation/auth";

/**
 * Server Actions for every auth flow. Credentials only ever travel to our
 * server; Next.js rejects cross-origin action calls (CSRF). Messages are
 * product-level: no raw Supabase text, and no signal about whether an email
 * has an account (signup and reset respond identically either way).
 */
export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: { email?: string; password?: string };
  /** Echoed back so a failed submit never wipes the email field. */
  email?: string;
  /** Distinguishes success screens. */
  outcome?: "check-email" | "reset-sent";
}

/**
 * Layouts (the site header) are shared between pages, so Next keeps their
 * cached render across client navigations. Anything that changes who is
 * signed in must drop that cache, or the header shows the wrong state.
 */
const refreshAuthState = () => revalidatePath("/", "layout");

const UNAVAILABLE: AuthFormState = { status: "error", message: AUTH_MESSAGES.unavailable };
const origin = () => new URL(siteConfig.url).origin;
const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const emailCheck = validateEmail(text(formData, "email"));
  const password = text(formData, "password");
  const next = safeNextPath(text(formData, "next"));
  const email = text(formData, "email").trim();

  const fieldErrors: NonNullable<AuthFormState["fieldErrors"]> = {};
  if (!emailCheck.ok) fieldErrors.email = emailCheck.error;
  // Sign-in never judges password strength: existing passwords may predate the policy.
  if (!password) fieldErrors.password = "Enter your password.";
  if (fieldErrors.email || fieldErrors.password) return { status: "error", fieldErrors, email };
  if (!emailCheck.ok) return { status: "error", email };

  const [byIp, byEmail] = await Promise.all([
    checkAuthRateLimit("login"),
    checkAuthRateLimit("login-email", emailCheck.value),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    return { status: "error", message: AUTH_MESSAGES.rate_limited, email };
  }

  const supabase = await createClient();
  if (!supabase) return { ...UNAVAILABLE, email };

  const { error } = await supabase.auth.signInWithPassword({ email: emailCheck.value, password });
  if (error) {
    const kind = classifyAuthError(error);
    if (kind === "unknown" || kind === "unavailable") logServerError("sign_in_failed", error, { code: error.code });
    return { status: "error", message: AUTH_MESSAGES[kind], email };
  }
  refreshAuthState();
  redirect(next);
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = text(formData, "email").trim();
  const emailCheck = validateEmail(rawEmail);
  const password = text(formData, "password");
  const passwordCheck = validateNewPassword(password, emailCheck.ok ? emailCheck.value : undefined);

  const fieldErrors: NonNullable<AuthFormState["fieldErrors"]> = {};
  if (!emailCheck.ok) fieldErrors.email = emailCheck.error;
  if (!passwordCheck.ok) fieldErrors.password = passwordCheck.error;
  if (!emailCheck.ok || !passwordCheck.ok) return { status: "error", fieldErrors, email: rawEmail };

  if (!(await checkAuthRateLimit("signup")).allowed) {
    return { status: "error", message: AUTH_MESSAGES.rate_limited, email: rawEmail };
  }

  const supabase = await createClient();
  if (!supabase) return { ...UNAVAILABLE, email: rawEmail };

  const { data, error } = await supabase.auth.signUp({
    email: emailCheck.value,
    password: passwordCheck.value,
  });

  if (error) {
    const kind = classifyAuthError(error);
    // An existing account must look identical to a new one (no enumeration).
    if (kind === "already_registered") {
      return { status: "success", outcome: "check-email", email: emailCheck.value };
    }
    if (kind === "weak_password") {
      return { status: "error", fieldErrors: { password: AUTH_MESSAGES.weak_password }, email: rawEmail };
    }
    if (kind === "unknown" || kind === "unavailable") logServerError("sign_up_failed", error, { code: error.code });
    return { status: "error", message: AUTH_MESSAGES[kind], email: rawEmail };
  }

  // Projects with email confirmation off return a session straight away.
  if (data.session) {
    refreshAuthState();
    redirect("/dashboard");
  }
  return { status: "success", outcome: "check-email", email: emailCheck.value };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const rawEmail = text(formData, "email").trim();
  const emailCheck = validateEmail(rawEmail);
  if (!emailCheck.ok) return { status: "error", fieldErrors: { email: emailCheck.error }, email: rawEmail };

  if (!(await checkAuthRateLimit("recover")).allowed) {
    return { status: "error", message: AUTH_MESSAGES.rate_limited, email: rawEmail };
  }

  const supabase = await createClient();
  if (!supabase) return { ...UNAVAILABLE, email: rawEmail };

  const { error } = await supabase.auth.resetPasswordForEmail(emailCheck.value);
  if (error && classifyAuthError(error) === "rate_limited") {
    return { status: "error", message: AUTH_MESSAGES.rate_limited, email: rawEmail };
  }
  if (error) logServerError("password_reset_failed", error, { code: error.code });

  // Same answer whether or not the account exists (or the send failed).
  return { status: "success", outcome: "reset-sent", email: emailCheck.value };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  // Authoritative check: this must be a live, verified session (a recovery
  // link or a normal sign-in), not just a cookie the proxy let through.
  const user = await getVerifiedUser();
  if (!user) redirect("/auth/error?reason=link_expired");

  const passwordCheck = validateNewPassword(text(formData, "password"), user.email ?? undefined);
  if (!passwordCheck.ok) return { status: "error", fieldErrors: { password: passwordCheck.error } };

  const supabase = await createClient();
  if (!supabase) return UNAVAILABLE;

  const { error } = await supabase.auth.updateUser({ password: passwordCheck.value });
  if (error) {
    const kind = classifyAuthError(error);
    if (kind === "weak_password" || kind === "same_password") {
      return { status: "error", fieldErrors: { password: AUTH_MESSAGES[kind] } };
    }
    logServerError("update_password_failed", error, { code: error.code });
    return { status: "error", message: AUTH_MESSAGES[kind] };
  }

  // A password change (especially after a reset) should end every other session.
  await supabase.auth.signOut({ scope: "others" });
  refreshAuthState();
  redirect("/account?notice=password-updated");
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNextPath(text(formData, "next"));
  const supabase = await createClient();
  if (!supabase) redirect("/auth/error?reason=unavailable");

  // redirectTo is built from our configured origin, never from request headers.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    if (error) logServerError("oauth_start_failed", error, { code: error.code });
    redirect("/auth/error?reason=oauth_failed");
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // "local": ends this browser's session. Other devices stay signed in.
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  refreshAuthState();
  redirect("/");
}
