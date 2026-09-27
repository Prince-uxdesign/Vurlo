import { Clock, EyeOff, RefreshCw, Shield } from "lucide-react";
import { Container } from "@/components/ui/container";

const capabilities = [
  {
    Icon: Clock,
    title: "Sub-10ms routing",
    body: "Direct 307 status codes straight to your destination, never trapped in slow tracking redirects.",
  },
  {
    Icon: EyeOff,
    title: "Zero tracking cookies",
    body: "Aggregate counts by device, country, and referrer without storing invasive personal profiles.",
  },
  {
    Icon: RefreshCw,
    title: "Editable destinations",
    body: "Change where a short link lands without reprinting QR codes or updating bios.",
  },
  {
    Icon: Shield,
    title: "Owner-controlled lifecycle",
    body: "Set 24-hour, 7-day, 30-day, or permanent links with instant disable toggles.",
  },
];

export function TrustSection() {
  return (
    <section aria-label="Product capabilities and trust" className="border-y border-(--color-mist-300) bg-white py-12 md:py-16">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[13px] font-semibold text-(--color-ember-700)">
              Link integrity
            </p>
            <h2 className="mt-2 text-[26px] font-bold leading-tight tracking-tight sm:text-[32px] md:text-[36px]">
              Built for links that live in the real world.
            </h2>
          </div>
          <p className="max-w-md text-[15px] leading-relaxed text-(--color-slate-700)">
            Whether shared in a private message, printed on a billboard, or
            tucked into a social bio, every Vurlo link is engineered for speed,
            privacy, and reliability.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col rounded-(--radius-lg) border border-(--color-mist-300) bg-(--color-paper) p-5 transition-colors hover:border-(--color-ink-900)"
            >
              <div className="flex size-10 items-center justify-center rounded-(--radius-md) border border-(--color-ink-900) bg-white text-(--color-ink-900)">
                <Icon size={19} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-h3 text-(--color-ink-900)">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                {body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
