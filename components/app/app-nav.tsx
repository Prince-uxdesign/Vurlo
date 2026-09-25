"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/links", label: "Links" },
  { href: "/account", label: "Account" },
] as const;

/** Primary app navigation. `aria-current="page"` marks where you are. */
export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="App" className={className}>
      <ul className="flex">
        {ITEMS.map((item) => {
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1 sm:flex-none">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center justify-center border-b-2 px-4 text-[15px] font-semibold sm:min-h-16",
                  current ? "border-(--color-ink-900)" : "border-transparent text-(--color-muted) hover:text-(--color-ink-900)",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
