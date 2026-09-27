import Link from "next/link";
import { Container } from "@/components/ui/container";
import { CreateLinkCta } from "./create-link-cta";

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="pb-16 md:pb-24">
      <Container>
        <div className="relative overflow-hidden rounded-[24px] border border-(--color-ink-900) bg-(--color-surface-dark) p-8 text-white shadow-[8px_8px_0_#000] sm:p-12 md:p-16 lg:rounded-[36px]">
          {/* Subtle background ambient highlight */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-(--color-ember-700)/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-orange-200">
                <span className="size-2 rounded-full bg-(--color-ember-700)" />
                Get started in seconds
              </span>
              <h2
                id="final-cta-title"
                className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight text-white sm:text-[42px] md:text-[50px]"
              >
                Make your links simpler today
                <span className="text-(--color-ember-700)">.</span>
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-stone-300 md:text-body-l">
                Paste any URL, choose your custom alias, and immediately receive
                a short link and print-ready QR code. No credit card required.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <CreateLinkCta className="min-h-12 px-8 text-[16px]">
                Create a short link
              </CreateLinkCta>
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-white/20 bg-white/5 px-6 text-[14px] font-medium text-white transition-colors hover:bg-white/10"
              >
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
