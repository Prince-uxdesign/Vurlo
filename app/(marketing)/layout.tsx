import type { ReactNode } from "react";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

/** Public site chrome. `flat-ui` scopes the no-gradient marketing styling. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flat-ui">
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}
