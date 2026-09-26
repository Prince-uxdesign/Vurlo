import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: { template: "%s settings | Vurlo", default: "Settings" } };

/**
 * Phones: one column (section list, or a section with a back link).
 * Tablets: tabs above the content. Desktops: a sidebar beside a content
 * column capped at a readable width, so wide screens get whitespace rather
 * than stretched forms. Each page verifies the user itself.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[13rem_minmax(0,42rem)] lg:gap-12">
      <div className="lg:pt-2">
        <p className="text-small mb-2 hidden px-3 font-semibold text-(--color-muted) lg:block" aria-hidden="true">Settings</p>
        <SettingsNav />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
