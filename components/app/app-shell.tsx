import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { AppNav } from "./app-nav";

/**
 * Chrome for signed-in screens: a slim header and primary navigation. Phones
 * get the tabs on their own full-width row (three big targets, no hamburger);
 * from `sm` up they sit beside the logo.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flat-ui flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-(--radius-md) focus:bg-black focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-paper)">
        <Container className="flex h-14 items-center gap-6 sm:h-16">
          <Link href="/dashboard" aria-label="Vurlo dashboard" className="inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-tight">
            Vurlo<span className="text-(--color-ember-700)">.</span>
          </Link>
          <AppNav className="hidden sm:block" />
          <form action={signOut} className="ml-auto hidden sm:block">
            <button type="submit" className="btn-ghost">Sign out</button>
          </form>
        </Container>
        <AppNav className="border-t border-(--color-border) sm:hidden" />
      </header>
      <main id="main" className="flex-1 py-6 sm:py-8 md:py-10">
        <Container>{children}</Container>
      </main>
    </div>
  );
}
