import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Sign in to Vurlo",
  description: "Sign in to your Vurlo account to manage your links, custom aliases, QR codes, and view analytics.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to manage your short links, edit destinations, and view honest analytics."
      switchLink={{ href: "/signup", label: "Create account" }}
      imageSrc="/images/auth/auth-signin.jpg"
      imageAlt="Creator using smartphone in urban environment"
      imageTagline="Short. Share. Understand."
      imageSubtag="Every link you create is kept safely under your account with instant 307 routing and zero tracking cookies."
      floatingCard={{
        slug: "vurlo.link/studio-drop",
        subtitle: "Active · 307 direct route",
        status: "Active",
      }}
      badge="Sign in"
    >
      <LoginForm next={safeNextPath(next)} />
    </AuthShell>
  );
}
