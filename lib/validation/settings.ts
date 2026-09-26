/**
 * Settings input rules, shared by the forms (instant feedback) and the
 * server actions (the authority). Nothing here judges an existing password
 * beyond "was one entered": that is checked against Supabase Auth.
 */
import type { ExpirationOption } from "@/lib/links/types";
import { validateEmail, validateNewPassword } from "./auth";

/** Longer than any real password; never sent to the auth server. */
export const MAX_CURRENT_PASSWORD = 1024;

export interface PasswordChangeInput {
  current: string;
  next: string;
  confirm: string;
}

export type PasswordChangeErrors = Partial<Record<keyof PasswordChangeInput, string>>;

export function validatePasswordChange(
  input: PasswordChangeInput,
  email?: string,
): { ok: true; value: { current: string; next: string } } | { ok: false; fieldErrors: PasswordChangeErrors } {
  const fieldErrors: PasswordChangeErrors = {};
  if (!input.current) fieldErrors.current = "Enter your current password.";
  else if (input.current.length > MAX_CURRENT_PASSWORD) fieldErrors.current = "That isn't your current password.";

  const next = validateNewPassword(input.next, email);
  if (!next.ok) fieldErrors.next = next.error;
  else if (input.current && input.next === input.current) fieldErrors.next = "Choose a password you haven't used for this account.";

  if (!fieldErrors.next) {
    if (!input.confirm) fieldErrors.confirm = "Type your new password again.";
    else if (input.confirm !== input.next) fieldErrors.confirm = "The two new passwords don't match.";
  }

  if (fieldErrors.current || fieldErrors.next || fieldErrors.confirm) return { ok: false, fieldErrors };
  return { ok: true, value: { current: input.current, next: input.next } };
}

export function validateEmailChange(raw: unknown, currentEmail: string | undefined) {
  const email = validateEmail(raw);
  if (!email.ok) return email;
  if (currentEmail && email.value === currentEmail.toLowerCase()) {
    return { ok: false as const, error: "That's already your email address." };
  }
  return email;
}

/** Choices for "new links expire", in the order the create form shows them. */
export const EXPIRATION_PREFERENCES: ReadonlyArray<{ value: ExpirationOption; label: string; hint: string }> = [
  { value: "1d", label: "In 24 hours", hint: "For one-off shares." },
  { value: "7d", label: "In 7 days", hint: "For short campaigns." },
  { value: "30d", label: "In 30 days", hint: "Vurlo's default." },
  { value: "never", label: "Never", hint: "Links stay live until you turn them off." },
];

export function isExpirationPreference(value: unknown): value is ExpirationOption {
  return EXPIRATION_PREFERENCES.some((o) => o.value === value);
}
