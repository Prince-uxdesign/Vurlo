import Image from "next/image";
import { Video } from "lucide-react";
import { Container } from "@/components/ui/container";

const creatorLinks = [
  {
    slug: "vurlo.link/presets-vol1",
    label: "35mm Film Preset Pack",
    category: "Digital Product",
    clicks: "842 clicks",
    status: "Active",
  },
  {
    slug: "vurlo.link/youtube-bts",
    label: "Berlin Street Photography Vlog",
    category: "YouTube Video",
    clicks: "1.4k clicks",
    status: "Active",
  },
  {
    slug: "vurlo.link/portfolio",
    label: "2026 Editorial Archive",
    category: "Portfolio Website",
    clicks: "490 clicks",
    status: "Active",
  },
];

export function CreatorsSection() {
  return (
    <section id="creators" aria-labelledby="creators-title" className="scroll-mt-16 py-16 md:py-24">
      <Container>
        {/* Butter Yellow Section Container */}
        <div className="rounded-[24px] border border-(--color-tint-yellow-border) bg-(--color-tint-yellow) p-6 sm:p-10 md:p-14 lg:rounded-[36px]">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
            {/* Visual Editorial Composition with Layered UI */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] border border-(--color-ink-900) bg-white p-3 shadow-[6px_6px_0_#000] sm:rounded-[28px]">
                <div className="relative size-full overflow-hidden rounded-[16px] sm:rounded-[20px]">
                  <Image
                    src="/images/marketing/creator-photographer.jpg"
                    alt="Photographer taking pictures in an urban environment"
                    fill
                    sizes="(min-width: 1024px) 460px, 100vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <p className="text-[12px] font-medium text-amber-200">
                      Creator Spotlight
                    </p>
                    <p className="text-[16px] font-bold">
                      Berlin Street & Studio
                    </p>
                  </div>
                </div>

                {/* Floating Destination Card 1 (Top Right) */}
                <div className="absolute -right-3 top-8 z-10 sm:-right-6 sm:top-12">
                  <div className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-3 shadow-[4px_4px_0_#000]">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-(--color-success-700)" />
                      <p className="font-mono text-[12px] font-bold text-(--color-ink-900)">
                        vurlo.link/presets-vol1
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-(--color-slate-700)">
                      35mm Film Presets · 842 clicks
                    </p>
                  </div>
                </div>

                {/* Floating Destination Card 2 (Bottom Left) */}
                <div className="absolute -left-3 bottom-12 z-10 sm:-left-6 sm:bottom-16">
                  <div className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-3 shadow-[4px_4px_0_#000]">
                    <div className="flex items-center gap-2">
                      <Video size={13} className="text-(--color-ember-700)" />
                      <p className="font-mono text-[12px] font-bold text-(--color-ink-900)">
                        vurlo.link/youtube-bts
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-(--color-slate-700)">
                      Behind the Scenes Vlog · 1.4k clicks
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Editorial Content */}
            <div className="flex flex-col">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-(--color-tint-yellow-border) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
                <span className="size-2 rounded-full bg-(--color-ember-700)" />
                For creators & media
              </span>

              <h2
                id="creators-title"
                className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] md:text-[44px] text-(--color-ink-900)"
              >
                One link for everything you share.
              </h2>

              <p className="mt-4 text-[16px] leading-relaxed text-(--color-slate-700) md:text-body-l">
                Keep your Instagram bio, YouTube descriptions, newsletters, and
                social cards clean. Replace messy strings with short links that
                people trust to click.
              </p>

              {/* Destination preview list */}
              <div className="mt-8 space-y-3">
                {creatorLinks.map((item) => (
                  <div
                    key={item.slug}
                    className="flex flex-col justify-between gap-2 rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-4 transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center shadow-[3px_3px_0_#000]"
                  >
                    <div>
                      <p className="font-mono text-[14px] font-bold text-(--color-ink-900)">
                        {item.slug}
                      </p>
                      <p className="text-[13px] text-(--color-slate-700)">
                        {item.label} · <span className="text-(--color-stone-500)">{item.category}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="rounded-full bg-(--color-mist-100) px-2.5 py-0.5 font-mono text-[11px] font-semibold text-(--color-ink-900)">
                        {item.clicks}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-(--radius-md) border border-(--color-tint-yellow-border) bg-white/80 p-4">
                  <h3 className="text-[15px] font-bold text-(--color-ink-900)">
                    Update on the fly
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-(--color-slate-700)">
                    Change destination URLs anytime without losing your original short link or bio placement.
                  </p>
                </div>
                <div className="rounded-(--radius-md) border border-(--color-tint-yellow-border) bg-white/80 p-4">
                  <h3 className="text-[15px] font-bold text-(--color-ink-900)">
                    Built-in UTM tagging
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-(--color-slate-700)">
                    Identify whether visitors come from your story, comments, or newsletter links.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
