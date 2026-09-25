import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Sign-in problem",
  robots: { index: false, follow: false },
};

const REASONS = {
  link_expired: {
    title: "That link has expired",
    body: "Email links work once and expire after an hour. Request a new one to continue.",
    action: { href: "/forgot-password", label: "Request a new link" },
  },
  oauth_denied: {
    title: "Google sign-in was cancelled",
    body: "You didn't finish signing in with Google. You can try again, or use your email instead.",
    action: { href: "/login", label: "Back to sign in" },
  },
  oauth_failed: {
    title: "We couldn't sign you in with Google",
    body: "Something went wrong on the way back from Google. Try again, or use your email instead.",
    action: { href: "/login", label: "Back to sign in" },
  },
  unavailable: {
    title: "Sign-in is unavailable right now",
    body: "The problem is on our side. Try again in a moment.",
    action: { href: "/login", label: "Back to sign in" },
  },
} as const;

type Reason = keyof typeof REASONS;
const isReason = (value: string | undefined): value is Reason =>
  value !== undefined && Object.hasOwn(REASONS, value);

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  // Only known reasons render. Arbitrary query text is never displayed.
  const { reason } = await searchParams;
  const content = isReason(reason)
    ? REASONS[reason]
    : {
        title: "Something went wrong",
        body: "We couldn't complete that. Try signing in again.",
        action: { href: "/login", label: "Back to sign in" },
      };

  return (
    <AuthShell title={content.title} description={content.body}>
      <Link href={content.action.href} className="btn-primary w-full">
        {content.action.label}
      </Link>
      <p className="mt-6 text-center">
        <Link href="/" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          Go to Vurlo
        </Link>
      </p>
    </AuthShell>
  );
}
