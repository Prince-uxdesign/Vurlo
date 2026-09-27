import Image from "next/image";
import { Coffee, QrCode, RefreshCw, ShoppingBag, Store } from "lucide-react";
import { Container } from "@/components/ui/container";

const businessPoints = [
  {
    icon: Coffee,
    title: "Table menus & ordering",
    slug: "vurlo.link/lunch-menu",
    description:
      "Direct guests to your seasonal menu. When prices or dishes update, change the link destination without reprinting table tents.",
  },
  {
    icon: ShoppingBag,
    title: "Packaging & product inserts",
    slug: "vurlo.link/care-guide",
    description:
      "Print a clean, memorable URL on shipping boxes, thank-you cards, and garment tags for instructions, warranties, or re-orders.",
  },
  {
    icon: Store,
    title: "Storefronts & window posters",
    slug: "vurlo.link/grand-opening",
    description:
      "Put short links and QR codes on posters and flyers. Track physical scan volume alongside your online marketing.",
  },
];

export function BusinessSection() {
  return (
    <section id="business" aria-labelledby="business-title" className="scroll-mt-16 py-16 md:py-24">
      <Container>
        {/* Warm Peach Section Container */}
        <div className="rounded-[24px] border border-(--color-tint-peach-border) bg-(--color-tint-peach) p-6 sm:p-10 md:p-14 lg:rounded-[36px]">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
            {/* Left Column: Business Copy & Use Cases */}
            <div className="flex flex-col">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-(--color-tint-peach-border) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
                <span className="size-2 rounded-full bg-(--color-ember-700)" />
                For small business & retail
              </span>

              <h2
                id="business-title"
                className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] md:text-[44px] text-(--color-ink-900)"
              >
                Put short links to work in the real world.
              </h2>

              <p className="mt-4 text-[16px] leading-relaxed text-(--color-slate-700) md:text-body-l">
                When you run a store, cafe, studio, or brand, your links live on
                paper, glass, and cardboard. Vurlo keeps your printed materials
                flexible so you never get stuck with dead links.
              </p>

              <div className="mt-8 space-y-4">
                {businessPoints.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.slug}
                      className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-5 shadow-[4px_4px_0_#000]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 place-items-center rounded bg-(--color-mist-100) text-(--color-ink-900)">
                            <Icon size={16} aria-hidden="true" />
                          </div>
                          <h3 className="text-[15px] font-bold text-(--color-ink-900)">
                            {item.title}
                          </h3>
                        </div>
                        <span className="font-mono text-[12px] font-semibold text-(--color-ember-700)">
                          {item.slug}
                        </span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-(--color-slate-700)">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Visual Business Owner Composition */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] border border-(--color-ink-900) bg-white p-3 shadow-[6px_6px_0_#000] sm:rounded-[28px]">
                <div className="relative size-full overflow-hidden rounded-[16px] sm:rounded-[20px]">
                  <Image
                    src="/images/marketing/business-owner.jpg"
                    alt="Small business owner managing daily orders on her phone"
                    fill
                    sizes="(min-width: 1024px) 460px, 100vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <p className="text-[12px] font-medium text-amber-200">
                      Storefront & Cafe
                    </p>
                    <p className="text-[16px] font-bold">
                      Just Toast Cafe & Bar
                    </p>
                  </div>
                </div>

                {/* Floating Table Tent Scan Card (Top Left) */}
                <div className="absolute -left-3 top-8 z-10 sm:-left-6 sm:top-12">
                  <div className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-3 shadow-[4px_4px_0_#000]">
                    <div className="flex items-center gap-2">
                      <QrCode size={13} className="text-(--color-ink-900)" />
                      <p className="font-mono text-[12px] font-bold text-(--color-ink-900)">
                        vurlo.link/toast-menu
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-(--color-slate-700)">
                      Table 4 QR scan · Updated today
                    </p>
                  </div>
                </div>

                {/* Floating Destination Updated Card (Bottom Right) */}
                <div className="absolute -right-3 bottom-12 z-10 sm:-right-6 sm:bottom-16">
                  <div className="flex items-center gap-2.5 rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-3 shadow-[4px_4px_0_#000]">
                    <span className="grid size-6 place-items-center rounded-full bg-(--color-mist-100) text-(--color-success-700)">
                      <RefreshCw size={13} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[12px] font-bold text-(--color-ink-900)">
                        Destination updated
                      </p>
                      <p className="text-[11px] text-(--color-stone-500)">
                        Printed codes keep working
                      </p>
                    </div>
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
