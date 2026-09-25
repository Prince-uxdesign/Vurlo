import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Vurlo account."
      switchLink={{ href: "/signup", label: "Create account" }}
    >
      <LoginForm next={safeNextPath(next)} />
    </AuthShell>
  );
}
