import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      description="Keep your links in one place and choose whether they expire."
      switchLink={{ href: "/login", label: "Sign in" }}
    >
      <SignupForm />
    </AuthShell>
  );
}
