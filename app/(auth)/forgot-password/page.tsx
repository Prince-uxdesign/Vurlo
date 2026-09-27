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
      description="Enter your email and we'll send you a recovery link to choose a new password."
      imageSrc="/images/auth/auth-signup-editorial.jpg"
      imageAlt="Modern architecture studio portrait"
      defaultTestimonialIndex={2}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
