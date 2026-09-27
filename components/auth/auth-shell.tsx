import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthTestimonial, type TestimonialItem } from "./auth-testimonial";

interface AuthShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Image asset for split-screen visual half. */
  imageSrc?: string;
  imageAlt?: string;
  /** Testimonial items or index to display. */
  testimonialItems?: TestimonialItem[];
  defaultTestimonialIndex?: number;
  /** Optional legacy/compatibility props. */
  switchLink?: { href: string; label: string };
  badge?: string;
  floatingCard?: {
    slug: string;
    subtitle: string;
    status?: string;
  };
  imageTagline?: string;
  imageSubtag?: string;
}

export function AuthShell({
  title,
  description,
  children,
  imageSrc = "/images/auth/auth-signin-editorial.jpg",
  imageAlt = "Creative founder portrait in editorial lighting",
  testimonialItems,
  defaultTestimonialIndex = 0,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-(--radius-md) focus:bg-black focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* 50 / 50 Equal Split Screen */}
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* LEFT COLUMN: Clean, High-Usability Form Canvas */}
        <main
          id="main"
          className="flex min-h-screen flex-col justify-between p-6 sm:p-10 md:p-12 lg:p-14 xl:p-16 bg-white"
        >
          {/* Top Header: Brand Logo */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              aria-label="Vurlo home"
              className="inline-flex min-h-11 items-center gap-1 text-[22px] font-extrabold tracking-tight text-(--color-ink-900) transition-opacity hover:opacity-85"
            >
              Vurlo<span className="text-(--color-ember-700)">.</span>
            </Link>
          </div>

          {/* Centered Form Wrapper - Clean, Flat, No Heavy Border Box */}
          <div className="mx-auto my-auto w-full max-w-[380px] sm:max-w-[400px] py-8 sm:py-10">
            {/* Title & Description Header */}
            <div className="mb-7">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight text-(--color-ink-900) sm:text-[32px]">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 text-[15px] leading-relaxed text-(--color-slate-700)">
                  {description}
                </p>
              ) : null}
            </div>

            {/* Direct Form Content */}
            <div>{children}</div>
          </div>

          {/* Bottom Legal / Copyright Footer */}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-(--color-mist-300)/60 pt-6 text-[12px] text-(--color-stone-500)">
            <span>© {new Date().getFullYear()} Vurlo Link Management</span>
            <div className="flex items-center gap-4">
              <Link
                href="/privacy"
                className="transition-colors hover:text-(--color-ink-900) hover:underline"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="transition-colors hover:text-(--color-ink-900) hover:underline"
              >
                Terms
              </Link>
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: 50% Editorial Visual & Customer Showcase */}
        <section
          aria-label="Visual brand showcase"
          className="relative hidden min-h-screen flex-col justify-end overflow-hidden bg-stone-900 lg:flex"
        >
          {/* Full-bleed Portrait Photography */}
          <div className="absolute inset-0 size-full">
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority
              sizes="50vw"
              className="object-cover object-center"
            />
            {/* Dark gradient overlay for typography readability */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
              aria-hidden="true"
            />
          </div>

          {/* Testimonial Quote & Navigation Overlay */}
          <AuthTestimonial
            items={testimonialItems}
            defaultIndex={defaultTestimonialIndex}
          />
        </section>
      </div>
    </div>
  );
}
