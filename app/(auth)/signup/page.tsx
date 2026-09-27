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
      title="Start making every link count"
      description="Create an account to keep your links forever, claim branded aliases, and download vector QR codes."
      switchLink={{ href: "/login", label: "Sign in" }}
      imageSrc="/images/auth/auth-signup.jpg"
      imageAlt="Creative entrepreneur reviewing work over coffee"
      imageTagline="Start making every link count."
      imageSubtag="Claim custom aliases, monitor honest post-click traffic, and keep all your links organized in one place."
      floatingCard={{
        slug: "vurlo.link/creator-hub",
        subtitle: "Active · Branded custom alias",
        status: "Active",
      }}
      badge="Create free account"
    >
      <SignupForm />
    </AuthShell>
  );
}
