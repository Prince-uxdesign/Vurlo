import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new one."
      switchLink={{ href: "/login", label: "Sign in" }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
