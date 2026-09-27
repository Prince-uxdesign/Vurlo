import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your Vurlo account",
  description: "Create an account to manage your short links, custom aliases, QR codes, and privacy-first analytics.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create an account"
      description="Start making every link count. Free forever, no credit card required."
      imageSrc="/images/auth/auth-signup-editorial.jpg"
      imageAlt="Creative strategist in modern architecture studio"
      defaultTestimonialIndex={1}
    >
      <SignupForm />
    </AuthShell>
  );
}
