import { Database, EyeOff, KeyRound, Shield, Sliders } from "lucide-react";
import { Container } from "@/components/ui/container";

const architecturePillars = [
  {
    icon: Database,
    title: "Row Level Security & tenant isolation",
    body: "Every link you create is strictly bound to your authenticated account. Database-level RLS policies guarantee other accounts cannot view, modify, or delete your links.",
  },
  {
    icon: KeyRound,
    title: "Destination URL validation",
    body: "Incoming destinations are parsed and checked against dangerous schemes, local loopbacks, and malformed inputs before any short link or redirect is generated.",
  },
  {
    icon: EyeOff,
    title: "Cookie-free, aggregate analytics",
    body: "We count clicks and categorize device and country origins without dropping persistent third-party cookies or building behavioral profiles on visitors.",
  },
  {
    icon: Shield,
    title: "Abuse controls & reserved paths",
    body: "Sensitive route names, system aliases, and platform endpoints are hard-reserved. Rate-limiting safeguards the API against programmatic flooding.",
  },
  {
    icon: Sliders,
    title: "Granular link lifecycle",
    body: "Choose exact expiration windows (24 hours, 7 days, 30 days, or indefinite). Links can be disabled or archived with one click to stop traffic immediately.",
  },
];

export function SecuritySection() {
  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="scroll-mt-16 border-y border-(--color-mist-300) bg-(--color-mist-100) py-16 md:py-24"
    >
      <Container>
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-mist-300) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
            <span className="size-2 rounded-full bg-(--color-ink-900)" />
            Security & trust
          </span>
          <h2
            id="trust-title"
            className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] md:text-[44px] text-(--color-ink-900)"
          >
            Trust is an architectural principle, not an afterthought.
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-(--color-slate-700) md:text-body-l">
            No hacker stock graphics or floating shields. Just rigorous database
            isolation, strict input validation, and privacy-respecting analytics
            built into the core engine.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {architecturePillars.map((item, index) => {
            const Icon = item.icon;
            const isFullWidth = index === 4;
            return (
              <div
                key={item.title}
                className={`flex flex-col rounded-(--radius-lg) border border-(--color-mist-300) bg-white p-6 shadow-sm transition-colors hover:border-(--color-ink-900) ${
                  isFullWidth ? "sm:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <div className="flex size-10 items-center justify-center rounded-(--radius-md) border border-(--color-ink-900) bg-(--color-paper) text-(--color-ink-900)">
                  <Icon size={19} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[16px] font-bold text-(--color-ink-900)">
                  {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
