"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { AUTH_MESSAGES, classifyAuthError } from "@/lib/auth/errors";
import { peekLoginFailures, recordLoginFailure } from "@/lib/auth/rate-limit";
import { getVerifiedUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/links/rate-limit";
import { rateLimitKey } from "@/lib/links/request";
import { logSecurityEvent, logServerError } from "@/lib/links/log";
import { BURST, burst } from "@/lib/security/burst";
import { waitPhrase } from "@/lib/security/wait";
import { signInMethods } from "@/lib/settings/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  EXPIRATION_PREFERENCES,
  isExpirationPreference,
  validateEmailChange,
  validatePasswordChange,
} from "@/lib/validation/settings";

/**
 * Account settings actions. Each one re-verifies the session with the auth
 * server (the page hiding a control is never the protection), and changes
 * that could take over an account (password, email) also require the
 * current password. Next.js rejects cross-site action calls; SameSite=Lax
 * session cookies back that up.
 */
export interface SettingsFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed so a failed submit keeps what was typed (never passwords). */
  email?: string;
}

const GENERIC: SettingsFormState = { status: "error", message: AUTH_MESSAGES.unknown };
const tooMany = (seconds: number): SettingsFormState => ({
  status: "error",
  message: `Too many attempts. Try again in ${waitPhrase(seconds)}.`,
});
const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** An ended session goes to sign in and comes back here afterwards. */
async function requireSettingsUser(returnTo: string) {
  const user = await getVerifiedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * Checks the current password without touching the user's own session: a
 * throwaway client signs in, and that extra session is revoked at once.
 * Wrong answers count as failed sign-ins for the account, so settings can't
 * be used to guess a password around the login limits.
 */
async function verifyCurrentPassword(email: string, password: string): Promise<"ok" | "wrong" | { wait: number } | "unavailable"> {
  const failures = await peekLoginFailures(email);
  if (!failures.allowed) return { wait: failures.retryAfterSeconds };

  const verifier = createPublicClient();
  if (!verifier) return "unavailable";
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) {
    const kind = classifyAuthError(error);
    logSecurityEvent("auth_failed", { flow: "settings_reauth", reason: kind });
    if (kind === "invalid_credentials") {
      await recordLoginFailure(email);
      return "wrong";
    }
    if (kind === "rate_limited") return { wait: 60 };
    logServerError("settings_reauth_failed", error, { code: error.code });
    return "unavailable";
  }
  await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
  return "ok";
}

async function overLimit(scope: string, userId: string, limit: { limit: number; windowSeconds: number }): Promise<number> {
  const quick = burst.hit(`settings:${userId}`, BURST.authAttempt);
  if (!quick.allowed) return quick.retryAfterSeconds;
  const client = createAdminClient();
  if (!client) return 0;
  try {
    const result = await consumeRateLimit(client, await rateLimitKey(scope, userId), limit);
    if (!result.allowed) logSecurityEvent("rate_limited", { scope, signedIn: true });
    return result.allowed ? 0 : result.retryAfterSeconds;
  } catch (error) {
    logServerError("settings_rate_limit_failed", error, { scope });
    return 0;
  }
}

export async function changePassword(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireSettingsUser("/settings/security");
  if (!signInMethods(user).password || !user.email) {
    return { status: "error", message: "You sign in with Google, so there's no Vurlo password to change." };
  }

  const checked = validatePasswordChange(
    { current: text(formData, "current_password"), next: text(formData, "new_password"), confirm: text(formData, "confirm_password") },
    user.email,
  );
  if (!checked.ok) return { status: "error", fieldErrors: checked.fieldErrors };

  const wait = await overLimit("settings-password", user.id, { limit: 10, windowSeconds: 60 * 60 });
  if (wait > 0) return tooMany(wait);

  const verified = await verifyCurrentPassword(user.email, checked.value.current);
  if (verified === "wrong") return { status: "error", fieldErrors: { current: "That's not your current password." } };
  if (verified === "unavailable") return { status: "error", message: AUTH_MESSAGES.unavailable };
  if (typeof verified === "object") return tooMany(verified.wait);

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: AUTH_MESSAGES.unavailable };
  const { error } = await supabase.auth.updateUser({ password: checked.value.next });
  if (error) {
    const kind = classifyAuthError(error);
    if (kind === "weak_password" || kind === "same_password") return { status: "error", fieldErrors: { next: AUTH_MESSAGES[kind] } };
    if (kind === "rate_limited") return tooMany(60);
    logServerError("settings_password_failed", error, { code: error.code });
    return GENERIC;
  }

  // Anyone else holding this account's sessions is signed out; this device stays.
  await supabase.auth.signOut({ scope: "others" });
  logSecurityEvent("password_changed", { via: "settings" });
  return { status: "success", message: "Password changed. You've been signed out on every other device." };
}

export async function changeEmail(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireSettingsUser("/settings/account");
  const typed = text(formData, "email").trim();
  if (!signInMethods(user).password || !user.email) {
    return { status: "error", message: "Your email comes from your Google account, so it's changed there." };
  }

  const email = validateEmailChange(typed, user.email);
  const current = text(formData, "current_password");
  const fieldErrors: Record<string, string> = {};
  if (!email.ok) fieldErrors.email = email.error;
  if (!current) fieldErrors.current = "Enter your current password to confirm it's you.";
  if (!email.ok || !current) return { status: "error", fieldErrors, email: typed };

  const wait = await overLimit("settings-email", user.id, { limit: 5, windowSeconds: 60 * 60 });
  if (wait > 0) return { ...tooMany(wait), email: typed };

  const verified = await verifyCurrentPassword(user.email, current);
  if (verified === "wrong") return { status: "error", fieldErrors: { current: "That's not your current password." }, email: typed };
  if (verified === "unavailable") return { status: "error", message: AUTH_MESSAGES.unavailable, email: typed };
  if (typeof verified === "object") return { ...tooMany(verified.wait), email: typed };

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: AUTH_MESSAGES.unavailable, email: typed };
  const { error } = await supabase.auth.updateUser(
    { email: email.value },
    { emailRedirectTo: `${siteConfig.origin}/settings/account?notice=email-confirmation` },
  );
  const sent: SettingsFormState = {
    status: "success",
    message: `Check your inboxes. We sent confirmation links to your current address and to ${email.value}. Your email changes once both are confirmed.`,
  };
  if (error) {
    const kind = classifyAuthError(error);
    // An address that already has an account gets the same answer as any
    // other: this form must not reveal who is registered.
    if (kind === "already_registered") return sent;
    if (kind === "rate_limited") return { ...tooMany(60), email: typed };
    logServerError("settings_email_failed", error, { code: error.code });
    return { ...GENERIC, email: typed };
  }
  logSecurityEvent("email_change_requested", { via: "settings" });
  revalidatePath("/settings", "layout");
  return sent;
}

export async function savePreferences(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireSettingsUser("/settings/preferences");
  const value = text(formData, "default_link_expiration");
  if (!isExpirationPreference(value)) return { status: "error", fieldErrors: { default_link_expiration: "Choose one of the options." } };

  const supabase = await createClient();
  if (!supabase) return { status: "error", message: AUTH_MESSAGES.unavailable };
  const { data, error } = await supabase
    .from("profiles")
    .update({ default_link_expiration: value })
    .eq("id", user.id)
    .select("id");
  if (error || !data?.length) {
    if (error) logServerError("save_preferences_failed", error, { code: error.code });
    return { status: "error", message: "Your preference couldn't be saved. Try again." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/");
  const label = EXPIRATION_PREFERENCES.find((o) => o.value === value)!.label.toLowerCase();
  return { status: "success", message: value === "never" ? "Saved. New links won't expire unless you choose otherwise." : `Saved. New links will expire ${label} unless you choose otherwise.` };
}

/** Ends every session for this account, on every device, then leaves the app. */
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) logServerError("sign_out_everywhere_failed", error, { code: error.code });
    else logSecurityEvent("signed_out_everywhere", {});
  }
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Permanently deletes the account and all associated data (links, click events,
 * profile). Requires password confirmation if password-based, or confirmation text.
 */
export async function deleteAccountAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireSettingsUser("/settings/account");
  const methods = signInMethods(user);

  if (methods.password && user.email) {
    const password = text(formData, "confirm_password");
    if (!password) {
      return { status: "error", fieldErrors: { confirm_password: "Enter your password to confirm." } };
    }
    const check = await verifyCurrentPassword(user.email, password);
    if (check !== "ok") {
      if (typeof check === "object") return tooMany(check.wait);
      if (check === "wrong") return { status: "error", fieldErrors: { confirm_password: "That password isn't right." } };
      return { status: "error", message: AUTH_MESSAGES.unavailable };
    }
  } else {
    const confirmation = text(formData, "confirmation_text").trim();
    if (confirmation !== "DELETE" && confirmation !== user.email) {
      return { status: "error", fieldErrors: { confirmation_text: "Type DELETE to confirm." } };
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    return { status: "error", message: "Account deletion is temporarily unavailable. Please try again later." };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    logServerError("delete_account_failed", deleteError, { userId: user.id });
    return { status: "error", message: "Failed to delete account. Please try again." };
  }

  logSecurityEvent("account_deleted", { userId: user.id });

  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

