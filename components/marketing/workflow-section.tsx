import Image from "next/image";
import { Container } from "@/components/ui/container";
import { LinkRowsPanel } from "./link-rows-panel";
import { SectionHeading } from "./section-heading";

const workflowSteps = [
  {
    step: "01",
    tag: "CREATE",
    title: "Paste, customize, configure",
    description:
      "Transform unwieldy URLs into clean, memorable links. Choose a branded custom alias, attach UTM campaign parameters, and set optional auto-expiry.",
    badge: "Custom slugs & UTMs",
  },
  {
    step: "02",
    tag: "SHARE",
    title: "One link for digital and physical media",
    description:
      "Drop your link in bios, newsletters, and chat channels, or generate an instant vector QR code ready for merchandise, packaging, and posters.",
    badge: "Vector QR ready",
  },
  {
    step: "03",
    tag: "CLICK",
    title: "Instant 307 redirection",
    description:
      "Visitors are routed straight to your destination in sub-10ms edge redirects. No interstitial ad pages, no affiliate lag, no tracking cookies.",
    badge: "Sub-10ms edge",
  },
  {
    step: "04",
    tag: "UNDERSTAND",
    title: "Clear post-click intelligence",
    description:
      "Track aggregate human clicks, discover whether traffic comes from mobile or desktop, and identify top countries and referrers.",
    badge: "Privacy-first metrics",
  },
];

export function WorkflowSection() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-16 py-16 md:py-24"
    >
      <Container>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="features-title"
            eyebrow="Workflow"
            title="From long URL to lasting insight."
          >
            Four disciplined steps that take you from a raw link to complete
            lifecycle control and honest post-click clarity.
          </SectionHeading>
        </div>

        {/* Asymmetric Editorial Grid */}
        <div className="mt-14 grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          {/* Left Column: 4 Editorial Steps with Visual Accents */}
          <div className="space-y-6">
            {workflowSteps.map((item) => (
              <div
                key={item.tag}
                className="group relative rounded-(--radius-lg) border border-(--color-mist-300) bg-white p-6 transition-all hover:border-(--color-ink-900) hover:shadow-[4px_4px_0_#000]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[13px] font-bold text-(--color-ember-700)">
                      {item.step}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-(--color-slate-700)">
                      / {item.tag}
                    </span>
                  </div>
                  <span className="rounded-full bg-(--color-mist-100) px-2.5 py-0.5 text-[11px] font-medium text-(--color-slate-700)">
                    {item.badge}
                  </span>
                </div>

                <h3 className="mt-3 text-[19px] font-bold tracking-tight text-(--color-ink-900)">
                  {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Right Column: Architectural Photography + Floating UI Management Preview */}
          <div className="relative sticky top-24 mx-auto w-full max-w-lg lg:max-w-none">
            <div className="relative overflow-hidden rounded-[24px] border border-(--color-mist-300) bg-(--color-paper) p-4 sm:p-5">
              {/* Graphic Architectural Detail */}
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[16px] border border-black/10">
                <Image
                  src="/images/marketing/abstract-architecture.png"
                  alt="Architectural geometric facade against a bold orange sky"
                  fill
                  sizes="(min-width: 1024px) 480px, 100vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                  <p className="text-[12px] font-medium tracking-wide">
                    System Architecture
                  </p>
                  <span className="font-mono text-[11px] text-orange-200">
                    99.9% Uptime
                  </span>
                </div>
              </div>

              {/* Overlapping Link Management Table */}
              <div className="mt-4">
                <LinkRowsPanel />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
