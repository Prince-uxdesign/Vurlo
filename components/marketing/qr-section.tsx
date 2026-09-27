import Image from "next/image";
import { Download, FileCode, FileImage, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

const GRID = 25;

/** Deterministic pseudo-random modules so server and client markup match. */
function buildSamplePath(): string {
  const finder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= GRID - 8 && y < 8) || (x < 8 && y >= GRID - 8);
  let seed = 19;
  let d = "";
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (finder(x, y)) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if (seed % 100 < 46) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}
const samplePath = buildSamplePath();

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width="7" height="7" fill="#000" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="#000" />
    </>
  );
}

const points = [
  {
    Icon: FileCode,
    title: "SVG vector format",
    body: "Sharp at any scale. Ready for commercial printers, posters, storefronts, and signage without pixelation.",
  },
  {
    Icon: FileImage,
    title: "Crisp PNG export",
    body: "High-resolution raster download for pitch decks, presentation slides, emails, and social graphics.",
  },
  {
    Icon: Share2,
    title: "Dynamic link routing",
    body: "The QR code points directly to your Vurlo short link. Change the destination URL anytime without reprinting your codes.",
  },
];

export function QrSection() {
  return (
    <section id="qr-codes" aria-labelledby="qr-title" className="scroll-mt-16 py-16 md:py-24">
      <Container>
        {/* Pale Blue Section Container */}
        <div className="rounded-[24px] border border-(--color-tint-blue-border) bg-(--color-tint-blue) p-6 sm:p-10 md:p-14 lg:rounded-[36px]">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            {/* Left Column: Heading and Specifications */}
            <div className="flex flex-col">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-(--color-tint-blue-border) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
                <span className="size-2 rounded-full bg-(--color-ember-700)" />
                Physical & digital bridge
              </span>

              <h2
                id="qr-title"
                className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] md:text-[44px] text-(--color-ink-900)"
              >
                From short link to print-ready QR in one step.
              </h2>

              <p className="mt-4 text-[16px] leading-relaxed text-(--color-slate-700) md:text-body-l">
                Every short link created in Vurlo generates an instant,
                high-contrast QR code. Scans register directly in your analytics
                so physical marketing efforts can be measured with precision.
              </p>

              <ul className="mt-8 space-y-4">
                {points.map(({ Icon, title, body }) => (
                  <li
                    key={title}
                    className="flex gap-4 rounded-(--radius-lg) border border-(--color-tint-blue-border) bg-white/90 p-4"
                  >
                    <span className="grid size-10 flex-none place-items-center rounded-(--radius-md) border border-(--color-ink-900) bg-white text-(--color-ink-900)">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-[15px] font-bold text-(--color-ink-900)">
                        {title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-(--color-slate-700)">
                        {body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Column: Object Photography + Overlapping Vector QR Card */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {/* Visual Object Accent: Pencil on Blue */}
                <div className="relative hidden aspect-[16/9] w-full overflow-hidden rounded-[18px] border border-(--color-ink-900) bg-white shadow-[4px_4px_0_#000] sm:block lg:aspect-[21/9]">
                  <Image
                    src="/images/marketing/product-pencil.jpg"
                    alt="Sharpened pencil casting clean shadow on light blue paper"
                    fill
                    sizes="(min-width: 1024px) 460px, 100vw"
                    className="object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 text-white">
                    <p className="text-[11px] font-medium text-blue-200">
                      Print Precision
                    </p>
                    <p className="text-[13px] font-semibold">
                      Crafted for Physical Media
                    </p>
                  </div>
                </div>

                {/* Scannable High-Fidelity QR Card */}
                <figure className="m-0 overflow-hidden rounded-[18px] border border-(--color-ink-900) bg-white text-(--color-ink-900) shadow-[6px_6px_0_#000]">
                  <figcaption className="flex items-center justify-between gap-3 border-b border-(--color-mist-300) bg-(--color-mist-100) px-4 py-3">
                    <span className="font-mono text-[13px] font-bold text-(--color-ink-900)">
                      {siteConfig.shortLinkHost}/craft-studio
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-(--color-slate-700) border border-(--color-mist-300)">
                      Live vector
                    </span>
                  </figcaption>

                  <div className="p-6">
                    <div className="mx-auto w-full max-w-[200px] rounded-(--radius-md) border border-(--color-ink-900) bg-white p-3 shadow-[3px_3px_0_#000]">
                      <svg
                        viewBox={`-1 -1 ${GRID + 2} ${GRID + 2}`}
                        role="img"
                        aria-label="High-contrast vector QR code preview for craft studio short link."
                        shapeRendering="crispEdges"
                        className="block w-full"
                      >
                        <rect x="-1" y="-1" width={GRID + 2} height={GRID + 2} fill="#fff" />
                        <path d={samplePath} fill="#000" />
                        <Finder x={0} y={0} />
                        <Finder x={GRID - 7} y={0} />
                        <Finder x={0} y={GRID - 7} />
                      </svg>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Button variant="outline" disabled className="w-full">
                        <Download size={15} aria-hidden="true" />
                        PNG
                      </Button>
                      <Button variant="outline" disabled className="w-full">
                        <Download size={15} aria-hidden="true" />
                        SVG
                      </Button>
                    </div>

                    <p className="mt-3 text-center text-[12px] text-(--color-stone-500)">
                      Downloads unlock instantly when creating links.
                    </p>
                  </div>
                </figure>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
