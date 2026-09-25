/**
 * Maps Supabase auth errors to product-level messages. The raw error text
 * and codes are never shown: they can name internals or confirm whether an
 * account exists. Unknown errors collapse to one generic message.
 */
export interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "weak_password"
  | "same_password"
  | "already_registered"
  | "unavailable"
  | "unknown";

export function classifyAuthError(error: AuthErrorLike | null | undefined): AuthErrorKind {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "rate_limited";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "user_already_exists":
    case "email_exists":
      return "already_registered";
  }
  if (error?.status === 429) return "rate_limited";
  if (error?.status === 0 || (error?.status ?? 0) >= 500) return "unavailable";
  return "unknown";
}

export const AUTH_MESSAGES: Record<AuthErrorKind, string> = {
  invalid_credentials: "Incorrect email or password.",
  email_not_confirmed: "Confirm your email address first. We sent you a link when you signed up.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  weak_password: "Choose a stronger password: at least 8 characters that aren't easy to guess.",
  same_password: "Choose a password you haven't used for this account.",
  already_registered: "Something went wrong. Try again.", // never shown: signup treats this as success
  unavailable: "Sign-in is temporarily unavailable. Try again in a moment.",
  unknown: "Something went wrong. Try again.",
};
