import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-form";
import { getVerifiedUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // Only reachable with a live session, which a valid reset link creates.
  const user = await getVerifiedUser();

  if (!user) {
    return (
      <AuthShell
        title="This link has expired"
        description="Reset links work once and expire after 60 minutes for security."
        switchLink={{ href: "/login", label: "Sign in" }}
        imageSrc="/images/auth/auth-architecture.png"
        imageAlt="Architectural facade against clear blue sky"
        imageTagline="Expired security link."
        imageSubtag="For your account protection, reset links are single-use and expire within one hour."
        badge="Link expired"
      >
        <Link href="/forgot-password" className="btn-primary w-full justify-center">
          Request a new link
        </Link>
        <p className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center font-bold text-(--color-ink-900) underline underline-offset-2 hover:text-(--color-ember-700)"
          >
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Choose a strong password of at least 8 characters. You'll be signed out of other active sessions."
      switchLink={{ href: "/login", label: "Sign in" }}
      imageSrc="/images/auth/auth-architecture.png"
      imageAlt="Architectural facade against clear blue sky"
      imageTagline="Protecting your account."
      imageSubtag="Once saved, your new password takes effect immediately and updates across all devices."
      badge="Set new password"
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
