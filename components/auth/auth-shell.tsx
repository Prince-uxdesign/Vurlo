import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

interface AuthShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Right-hand header link, e.g. "Create account". */
  switchLink?: { href: string; label: string };
}

/**
 * Frame for every auth page.
 * Phones: form starts near the top (so the on-screen keyboard never hides it).
 * Tablet: a single centered column with a deliberate max-width and space.
 * Desktop: a short value statement beside the form.
 */
export function AuthShell({ title, description, children, switchLink }: AuthShellProps) {
  return (
    <div className="flat-ui flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-(--radius-md) focus:bg-black focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="border-b border-(--color-border)">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Vurlo home" className="inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-tight">
            Vurlo<span className="text-(--color-ember-700)">.</span>
          </Link>
          {switchLink ? (
            <Link href={switchLink.href} className="btn-ghost">
              {switchLink.label}
            </Link>
          ) : null}
        </Container>
      </header>

      <main id="main" className="flex-1 py-8 sm:py-12 md:py-16 lg:py-20">
        <Container className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-20">
          <aside className="hidden lg:block lg:pt-6" aria-hidden="true">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-(--color-muted)">
              Your Vurlo account
            </p>
            <p className="mt-3 max-w-md text-[36px] font-bold leading-[1.1] tracking-tight">
              Keep your links under your name.
            </p>
            <ul className="mt-8 grid max-w-md gap-4 border-t border-(--color-ink-900) pt-6 text-(--color-muted)">
              <li>Links you make while signed in belong to your account.</li>
              <li>Choose whether a link expires, or keeps working.</li>
              <li>Shortening without an account still works, always.</li>
            </ul>
          </aside>

          <div className="mx-auto w-full max-w-[440px] lg:mx-0">
            <div className="auth-panel">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
              {description ? <div className="mt-2 text-(--color-muted)">{description}</div> : null}
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
