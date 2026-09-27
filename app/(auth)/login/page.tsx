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
      description="Welcome back! Please enter your details."
      imageSrc="/images/auth/auth-signin-editorial.jpg"
      imageAlt="Creative founder portrait in editorial studio setting"
      defaultTestimonialIndex={0}
    >
      <LoginForm next={safeNextPath(next)} />
    </AuthShell>
  );
}
