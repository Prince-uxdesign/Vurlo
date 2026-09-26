import type { Metadata } from "next";
import { AnalyticsSection } from "@/components/marketing/analytics-section";
import { BenefitsSection } from "@/components/marketing/benefits-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { getCurrentUserId } from "@/lib/auth/session";
import { getSettingsProfile } from "@/lib/settings/account";
import { createClient } from "@/lib/supabase/server";
import { QrSection } from "@/components/marketing/qr-section";
import { SecuritySection } from "@/components/marketing/security-section";
import { UseCasesSection } from "@/components/marketing/use-cases-section";

export const metadata: Metadata = {
  title: { absolute: "Vurlo: Short links that do more" },
  description:
    "Shorten URLs, choose custom aliases, create QR codes and see how many people click. Vurlo is a simple link shortener with lightweight link management.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const isSignedIn = Boolean(userId);
  // Signed in: start the form on their saved expiry (one small, RLS-scoped read).
  const supabase = userId ? await createClient() : null;
  const defaultExpiration = supabase && userId ? (await getSettingsProfile(supabase, userId)).defaultExpiration : undefined;
  return (
    <>
      <Hero isSignedIn={isSignedIn} defaultExpiration={defaultExpiration} />
      <BenefitsSection />
      <AnalyticsSection />
      <QrSection />
      <UseCasesSection />
      <SecuritySection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
