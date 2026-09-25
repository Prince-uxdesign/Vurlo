import { Download, Share2, FileImage, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "./section-heading";

const GRID = 25;

/** Deterministic pseudo-random modules so server and client markup match. */
function buildSamplePath(): string {
  const finder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= GRID - 8 && y < 8) || (x < 8 && y >= GRID - 8);
  let seed = 7;
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
  { Icon: FileImage, title: "PNG", body: "For social posts, slides, and documents." },
  { Icon: FileCode, title: "SVG", body: "Sharp at any size, for print and posters." },
  { Icon: Share2, title: "Easy sharing", body: "One link, one code. Change the destination and the printed code keeps working." },
];

export function QrSection() {
  return (
    <section
      id="qr-codes"
      aria-labelledby="qr-title"
      className="scroll-mt-16 py-14 md:py-20"
    >
      <Container className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            id="qr-title"
            eyebrow="QR codes"
            title="From short link to QR code in one step."
          >
            Any short link can become a QR code. Put it on a poster, a menu, or
            a business card, then track scans as clicks.
          </SectionHeading>
          <ul className="mt-8 grid gap-5">
            {points.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-10 flex-none place-items-center rounded-(--radius-md) border border-(--color-ink-900)">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-h3">{title}</h3>
                  <p className="text-(--color-muted)">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <figure className="m-0 mx-auto w-full max-w-md overflow-hidden rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
          <figcaption className="flex items-center justify-between gap-3 border-b border-(--color-border) px-4 py-3">
            <span className="font-mono text-[14px] font-semibold">vurlo.link/menu</span>
            <span className="text-small text-(--color-muted)">Preview</span>
          </figcaption>
          <div className="p-5 sm:p-6">
            <div className="mx-auto w-full max-w-[220px] rounded-(--radius-md) border border-(--color-border) bg-white p-3">
              <svg
                viewBox={`-1 -1 ${GRID + 2} ${GRID + 2}`}
                role="img"
                aria-label="Illustrative QR code. This sample cannot be scanned."
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
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button variant="outline" disabled>
                <Download size={18} aria-hidden="true" />
                PNG
              </Button>
              <Button variant="outline" disabled>
                <Download size={18} aria-hidden="true" />
                SVG
              </Button>
            </div>
            <p className="text-small mt-3 text-center text-(--color-muted)">
              Downloads unlock with your links.
            </p>
          </div>
        </figure>
      </Container>
    </section>
  );
}
