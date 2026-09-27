import type { Metadata } from "next";
import { AnalyticsSection } from "@/components/marketing/analytics-section";
import { BusinessSection } from "@/components/marketing/business-section";
import { CreatorsSection } from "@/components/marketing/creators-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { QrSection } from "@/components/marketing/qr-section";
import { SecuritySection } from "@/components/marketing/security-section";
import { TrustSection } from "@/components/marketing/trust-section";
import { UseCasesSection } from "@/components/marketing/use-cases-section";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import { getCurrentUserId } from "@/lib/auth/session";
import { getSettingsProfile } from "@/lib/settings/account";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { absolute: "Vurlo: Make every link worth clicking" },
  description:
    "Shorten URLs, customize aliases, generate instant print-ready QR codes, and understand what happens after the click. Focused link management with privacy-first analytics.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const isSignedIn = Boolean(userId);

  // Signed in: start the form on their saved expiry (one small, RLS-scoped read).
  const supabase = userId ? await createClient() : null;
  const defaultExpiration =
    supabase && userId
      ? (await getSettingsProfile(supabase, userId)).defaultExpiration
      : undefined;

  return (
    <>
      <Hero isSignedIn={isSignedIn} defaultExpiration={defaultExpiration} />
      <TrustSection />
      <WorkflowSection />
      <AnalyticsSection />
      <CreatorsSection />
      <BusinessSection />
      <QrSection />
      <SecuritySection />
      <UseCasesSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
