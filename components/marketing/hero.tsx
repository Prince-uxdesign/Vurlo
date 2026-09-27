import Image from "next/image";
import { Copy, QrCode } from "lucide-react";
import { Container } from "@/components/ui/container";
import type { ExpirationOption } from "@/lib/links/types";
import { ShortenerWidget } from "./shortener/shortener-widget";

interface HeroProps {
  isSignedIn?: boolean;
  defaultExpiration?: ExpirationOption;
}

export function Hero({ isSignedIn = false, defaultExpiration }: HeroProps) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-6 pb-14 md:pt-12 md:pb-20 lg:pt-16 lg:pb-24"
    >
      <Container>
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16 xl:gap-20">
          {/* Left Column: Editorial Headline + Live Shortener Interaction */}
          <div className="flex flex-col">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-(--color-mist-300) bg-white px-3 py-1 text-[13px] font-medium text-(--color-slate-700)">
              <span className="size-2 rounded-full bg-(--color-ember-700)" aria-hidden="true" />
              <span>Focused link management</span>
            </div>

            <h1
              id="hero-title"
              className="mt-5 text-[36px] font-bold leading-[1.08] tracking-tight sm:text-[46px] md:text-[54px] lg:text-[58px] xl:text-[64px]"
            >
              Make every link{" "}
              <span className="text-(--color-ember-700)">worth clicking.</span>
            </h1>

            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-(--color-slate-700) sm:text-[17px] md:text-body-l">
              Vurlo turns messy, fragile URLs into clean short links, print-ready
              QR codes, and clear analytics. Simple to create, effortless to
              share, and insightful after the click.
            </p>

            {/* URL Shortener Widget */}
            <div id="shorten" className="mt-8 scroll-mt-20">
              <ShortenerWidget
                isSignedIn={isSignedIn}
                defaultExpiration={defaultExpiration}
                title="Create a short link"
              />
            </div>

            {/* Trust and Capability Micro-Strip */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-(--color-slate-700)">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="size-1.5 rounded-full bg-(--color-success-700)" />
                Sub-10ms 307 redirects
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="size-1.5 rounded-full bg-(--color-ink-900)" />
                Zero tracking cookies
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="size-1.5 rounded-full bg-(--color-ink-900)" />
                No account required to start
              </span>
            </div>
          </div>

          {/* Right Column: Visual Art-Direction Composition */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            {/* Background container stage with subtle warm tint */}
            <div className="relative overflow-hidden rounded-[24px] border border-(--color-mist-300) bg-(--color-tint-yellow) p-3 sm:p-5 md:p-6 lg:rounded-[32px]">
              {/* Main Editorial Image */}
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[18px] border border-black/10 bg-stone-100 sm:rounded-[22px]">
                <Image
                  src="/images/marketing/hero-creator.png"
                  alt="Creator working on a laptop in a brightly lit studio"
                  fill
                  priority
                  sizes="(min-width: 1280px) 480px, (min-width: 1024px) 420px, (min-width: 640px) 500px, 100vw"
                  className="object-cover object-center"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-60"
                  aria-hidden="true"
                />
              </div>

              {/* Floating Element 1: Active Short Link Card (Top Left) */}
              <div className="absolute -left-2 top-6 z-10 sm:-left-5 sm:top-10">
                <div className="flex items-center gap-2.5 rounded-(--radius-lg) border border-(--color-ink-900) bg-white px-3.5 py-2.5 shadow-[4px_4px_0_#000]">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-(--color-success-700)" />
                  </span>
                  <div>
                    <p className="font-mono text-[13px] font-semibold text-(--color-ink-900)">
                      vurlo.link/studio-drop
                    </p>
                    <p className="text-[11px] text-(--color-stone-500)">
                      Active · 307 direct route
                    </p>
                  </div>
                  <span className="ml-1 rounded bg-(--color-mist-100) p-1 text-(--color-slate-700)">
                    <Copy size={13} aria-hidden="true" />
                  </span>
                </div>
              </div>

              {/* Floating Element 2: Clicks & Peak Stat Badge (Top Right) */}
              <div className="absolute -right-2 top-16 z-10 sm:-right-4 sm:top-20">
                <div className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-3 shadow-[4px_4px_0_#000]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-(--color-slate-700)">
                      Weekly traffic
                    </span>
                    <span className="inline-flex items-center text-[11px] font-semibold text-(--color-success-700)">
                      +19.4%
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[24px] font-extrabold leading-none text-(--color-ink-900)">
                      1,420
                    </span>
                    <span className="text-[11px] text-(--color-stone-500)">
                      human clicks
                    </span>
                  </div>
                  {/* Micro sparkline bar indicator */}
                  <div className="mt-2.5 flex h-4 items-end gap-[3px]">
                    <div className="h-2 w-1.5 rounded-xs bg-(--color-mist-300)" />
                    <div className="h-2.5 w-1.5 rounded-xs bg-(--color-mist-300)" />
                    <div className="h-3 w-1.5 rounded-xs bg-(--color-mist-300)" />
                    <div className="h-2 w-1.5 rounded-xs bg-(--color-mist-300)" />
                    <div className="h-3.5 w-1.5 rounded-xs bg-(--color-ember-700)" />
                    <div className="h-4 w-1.5 rounded-xs bg-(--color-ember-700)" />
                  </div>
                </div>
              </div>

              {/* Floating Element 3: Device Share Pill (Bottom Left) */}
              <div className="absolute -left-2 bottom-12 z-10 sm:-left-4 sm:bottom-14">
                <div className="flex items-center gap-2 rounded-full border border-(--color-ink-900) bg-white px-3.5 py-1.5 text-[12px] font-medium text-(--color-ink-900) shadow-[3px_3px_0_#000]">
                  <span className="size-1.5 rounded-full bg-(--color-ember-700)" />
                  <span>68% Mobile</span>
                  <span className="text-(--color-stone-500)">·</span>
                  <span>28% Desktop</span>
                </div>
              </div>

              {/* Floating Element 4: Print QR Preview (Bottom Right) */}
              <div className="absolute -right-2 bottom-6 z-10 sm:-right-4 sm:bottom-8">
                <div className="flex items-center gap-2.5 rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-2.5 shadow-[4px_4px_0_#000]">
                  <div className="grid size-9 place-items-center rounded bg-(--color-mist-100) text-(--color-ink-900)">
                    <QrCode size={20} aria-hidden="true" />
                  </div>
                  <div className="pr-1">
                    <p className="text-[12px] font-semibold text-(--color-ink-900)">
                      QR Ready
                    </p>
                    <p className="text-[10px] text-(--color-stone-500)">
                      SVG vector + PNG
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
