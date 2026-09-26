"use client";

import { ChevronRight, KeyRound, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export const SETTINGS_SECTIONS: ReadonlyArray<{ href: string; label: string; description: string; Icon: LucideIcon }> = [
  { href: "/settings/account", label: "Account", description: "Email, sign-in method and link usage", Icon: UserRound },
  { href: "/settings/security", label: "Security", description: "Password and signed-in devices", Icon: KeyRound },
  { href: "/settings/preferences", label: "Preferences", description: "Default expiry for new links", Icon: SlidersHorizontal },
  { href: "/settings/privacy", label: "Data & privacy", description: "What Vurlo stores and why", Icon: ShieldCheck },
];

/** `/settings` shows Account on tablets and desktops, so Account is "current" there. */
function useCurrent() {
  const pathname = usePathname();
  return (href: string) => pathname === href || (pathname === "/settings" && href === "/settings/account");
}

/**
 * Tablet: one row of tabs above the content (600-1023px). Desktop: a
 * sidebar (1024px+). Phones don't get either: they get the section list
 * (below) and a back link, so no sidebar is ever squeezed into a phone.
 */
export function SettingsNav() {
  const isCurrent = useCurrent();
  return (
    <nav aria-label="Settings" className="hidden min-[600px]:block">
      <ul className="flex gap-1 border-b border-(--color-border) lg:flex-col lg:gap-0.5 lg:border-b-0">
        {SETTINGS_SECTIONS.map(({ href, label, Icon }) => {
          const current = isCurrent(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-center gap-2.5 whitespace-nowrap border-b-2 px-3 text-[15px] font-semibold",
                  "lg:mb-0 lg:rounded-(--radius-md) lg:border-b-0 lg:px-3",
                  current
                    ? "border-(--color-ink-900) lg:bg-(--color-mist-100)"
                    : "border-transparent text-(--color-muted) hover:text-(--color-ink-900) lg:hover:bg-(--color-mist-100)",
                )}
              >
                <Icon size={18} aria-hidden="true" className="hidden flex-none lg:block" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phones: the settings home is a list of sections, each opening full width. */
export function SettingsSectionList() {
  return (
    <nav aria-label="Settings sections">
      <ul className="divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-border) bg-white">
        {SETTINGS_SECTIONS.map(({ href, label, description, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-(--color-mist-100)">
              <Icon size={20} aria-hidden="true" className="flex-none text-(--color-muted)" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="text-small block text-(--color-muted)">{description}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" className="flex-none text-(--color-muted)" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
