import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { getCurrentUserId } from "@/lib/auth/session";

/** Public site chrome. `flat-ui` scopes the no-gradient marketing styling. */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  // Decided on the server so the header is correct on first paint (no
  // "Sign in" flash for signed-in users). Marks these pages as dynamic.
  const isSignedIn = Boolean(await getCurrentUserId());
  return (
    <div className="flat-ui">
      <MarketingHeader isSignedIn={isSignedIn} />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}
