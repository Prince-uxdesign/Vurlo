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
        imageSrc="/images/auth/auth-signin-editorial.jpg"
        imageAlt="Editorial studio lighting portrait"
        defaultTestimonialIndex={0}
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
      imageSrc="/images/auth/auth-signin-editorial.jpg"
      imageAlt="Editorial studio lighting portrait"
      defaultTestimonialIndex={1}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
