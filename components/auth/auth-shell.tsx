import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface AuthShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Top-right navigation action (e.g. "Create account" or "Sign in"). */
  switchLink?: { href: string; label: string };
  /** Image asset for split-screen layout. */
  imageSrc?: string;
  imageAlt?: string;
  /** Large editorial headline over the photo. */
  imageTagline?: string;
  /** Sub-copy beneath the tagline. */
  imageSubtag?: string;
  /** Floating short-link badge over the visual. */
  floatingCard?: {
    slug: string;
    subtitle: string;
    status?: string;
  };
  /** Eyebrow category tag above the title. */
  badge?: string;
}

export function AuthShell({
  title,
  description,
  children,
  switchLink,
  imageSrc = "/images/auth/auth-signin.jpg",
  imageAlt = "Creator using mobile phone",
  imageTagline = "Short. Share. Understand.",
  imageSubtag = "Keep your links tidy, brand your aliases, and understand what happens after the click.",
  floatingCard = {
    slug: "vurlo.link/studio-drop",
    subtitle: "Active · 307 direct route",
    status: "Active",
  },
  badge = "Account access",
}: AuthShellProps) {
  return (
    <div className="flat-ui min-h-screen bg-(--color-paper)">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-(--radius-md) focus:bg-black focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Main Split-Screen Container */}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* LEFT COLUMN: Visual Editorial Stage (Desktop Full-Height, Mobile Top Visual) */}
        <section
          aria-label="Visual art direction"
          className="relative flex flex-col justify-between overflow-hidden border-b border-(--color-mist-300) bg-(--color-surface-dark) p-6 text-white sm:p-8 md:p-10 lg:min-h-screen lg:border-b-0 lg:border-r"
        >
          {/* Background Photography with Sophisticated Overlay */}
          <div className="absolute inset-0 size-full">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover object-center opacity-75"
            />
            {/* Dark gradient to ensure high-contrast readability */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/50"
              aria-hidden="true"
            />
          </div>

          {/* Top Visual Bar: Logo + Home link */}
          <div className="relative z-10 flex items-center justify-between">
            <Link
              href="/"
              aria-label="Vurlo home"
              className="inline-flex min-h-11 items-center gap-1 text-[22px] font-extrabold tracking-tight text-white transition-opacity hover:opacity-90"
            >
              Vurlo<span className="text-(--color-ember-700)">.</span>
            </Link>

            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/90 backdrop-blur-xs transition-colors hover:bg-white/20"
            >
              <ArrowLeft size={13} aria-hidden="true" />
              <span>Back to home</span>
            </Link>
          </div>

          {/* Floating UI Card Layered over the Photography */}
          {floatingCard ? (
            <div className="relative z-10 my-8 w-fit sm:my-12">
              <div className="inline-flex items-center gap-3 rounded-(--radius-lg) border border-white/20 bg-black/60 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                </span>
                <div>
                  <p className="font-mono text-[13px] font-semibold text-white">
                    {floatingCard.slug}
                  </p>
                  <p className="text-[11px] text-white/70">
                    {floatingCard.subtitle}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Bottom Editorial Copy (Visible on Desktop & Tablet) */}
          <div className="relative z-10 mt-auto hidden pt-8 sm:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-orange-200">
              <span className="size-1.5 rounded-full bg-(--color-ember-700)" />
              <span>Link Management</span>
            </div>
            <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[34px] md:text-[38px]">
              {imageTagline}
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/80 sm:text-[15px]">
              {imageSubtag}
            </p>
          </div>
        </section>

        {/* RIGHT COLUMN: Clean, High-Usability Form Canvas */}
        <main
          id="main"
          className="flex flex-col justify-between p-6 sm:p-10 md:p-12 lg:min-h-screen lg:p-16 xl:p-20"
        >
          {/* Header Switch Navigation */}
          <div className="flex items-center justify-end">
            {switchLink ? (
              <div className="flex items-center gap-2 text-[14px] text-(--color-slate-700)">
                <span className="hidden sm:inline">
                  {switchLink.label === "Create account"
                    ? "Don't have an account?"
                    : "Already have an account?"}
                </span>
                <Link
                  href={switchLink.href}
                  className="inline-flex min-h-10 items-center justify-center rounded-(--radius-md) border border-(--color-mist-300) bg-white px-3.5 font-semibold text-(--color-ink-900) transition-colors hover:border-(--color-ink-900)"
                >
                  {switchLink.label}
                </Link>
              </div>
            ) : null}
          </div>

          {/* Centered Form Wrapper */}
          <div className="mx-auto my-auto w-full max-w-[420px] py-8 sm:py-10">
            {/* Title & Description Header */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-mist-300) bg-white px-2.5 py-0.5 text-[11px] font-semibold text-(--color-slate-700)">
                <span className="size-1.5 rounded-full bg-(--color-ember-700)" />
                {badge}
              </span>
              <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight text-(--color-ink-900) sm:text-[32px]">
                {title}
              </h1>
              {description ? (
                <div className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                  {description}
                </div>
              ) : null}
            </div>

            {/* Elevated Form Surface */}
            <div className="mt-8 rounded-[18px] border border-(--color-ink-900) bg-white p-6 shadow-[5px_5px_0_#000] sm:p-8">
              {children}
            </div>
          </div>

          {/* Footer Legal & Security Indicator */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-(--color-mist-300) pt-6 text-[12px] text-(--color-stone-500)">
            <span>© {new Date().getFullYear()} Vurlo Link Management</span>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
