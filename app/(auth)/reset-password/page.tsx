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
      <AuthShell title="This link has expired" description="Reset links work once and expire after an hour.">
        <Link href="/forgot-password" className="btn-primary w-full">
          Request a new link
        </Link>
        <p className="mt-6 text-center">
          <Link href="/login" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="You'll be signed out of your other devices.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
