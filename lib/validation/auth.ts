/**
 * Shared credential rules for the auth forms. Server actions re-run these,
 * and Supabase enforces its own password minimum as a last line.
 *
 * Password policy: length, not composition. 8–72 characters (72 is bcrypt's
 * limit, so longer passwords would be silently truncated), not your email,
 * and not one of a handful of universally-guessed passwords. No symbol or
 * mixed-case rules: they push people toward predictable substitutions.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
const MAX_EMAIL_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwertyui", "qwertyuiop", "iloveyou", "letmein1", "11111111", "abcd1234",
  "admin123", "welcome1", "vurlo123",
]);

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateEmail(raw: unknown): Result<string> {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Enter your email address." };
  }
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email address, like name@example.com." };
  }
  return { ok: true, value: email };
}

/** For creating or changing a password. Never used to judge an existing one at sign-in. */
export function validateNewPassword(raw: unknown, email?: string): Result<string> {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, error: "Enter a password." };
  }
  if (raw.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (new TextEncoder().encode(raw).length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.` };
  }
  if (COMMON_PASSWORDS.has(raw.toLowerCase())) {
    return { ok: false, error: "That password is too easy to guess. Try something longer or less predictable." };
  }
  if (email && raw.toLowerCase() === email.toLowerCase()) {
    return { ok: false, error: "Your password can't be the same as your email." };
  }
  return { ok: true, value: raw };
}
