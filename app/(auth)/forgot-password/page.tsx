import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset link for your Vurlo account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your registered account email and we'll send you a secure link to choose a new password."
      switchLink={{ href: "/login", label: "Sign in" }}
      imageSrc="/images/auth/auth-architecture.png"
      imageAlt="Architectural facade with curved balconies against blue sky"
      imageTagline="Account security & recovery."
      imageSubtag="Password reset links expire in 60 minutes and can only be used once to keep your account protected."
      floatingCard={{
        slug: "vurlo.link/auth-recovery",
        subtitle: "Single-use · 60m expiry",
        status: "Secure",
      }}
      badge="Password recovery"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
