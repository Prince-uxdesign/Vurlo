import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/cn";
import { BarChart3, Globe2, Laptop, ShieldCheck, Smartphone } from "lucide-react";

/** Illustrative numbers only. Never presented as live or real customer data. */
const dailyClicks = [
  22, 30, 26, 34, 41, 38, 29, 33, 45, 52, 48, 40, 36, 44, 58, 63, 55, 49, 61,
  72, 84, 96, 88, 74, 68, 79, 91, 85, 77, 93,
];
const totalClicks = dailyClicks.reduce((sum, n) => sum + n, 0);
const peakDay = Math.max(...dailyClicks);
const approximateUniques = 1640;

const breakdowns = [
  {
    title: "Device breakdown",
    icon: Smartphone,
    rows: [
      ["Mobile", 64],
      ["Desktop", 31],
      ["Tablet", 5],
    ],
  },
  {
    title: "Geographic origin",
    icon: Globe2,
    rows: [
      ["United States", 38],
      ["United Kingdom", 17],
      ["Nigeria", 14],
      ["Canada", 9],
    ],
  },
  {
    title: "Top referrers",
    icon: BarChart3,
    rows: [
      ["Direct / Bio", 45],
      ["Instagram", 24],
      ["Newsletter", 18],
      ["X (Twitter)", 13],
    ],
  },
  {
    title: "Top browsers",
    icon: Laptop,
    rows: [
      ["Chrome", 52],
      ["Safari", 34],
      ["Firefox", 8],
      ["Edge", 6],
    ],
  },
] as const;

export function AnalyticsSection() {
  return (
    <section
      id="analytics"
      aria-labelledby="analytics-title"
      className="scroll-mt-16 py-16 md:py-24"
    >
      <Container>
        {/* Soft Lilac Section Container */}
        <div className="rounded-[24px] border border-(--color-tint-lilac-border) bg-(--color-tint-lilac) p-6 sm:p-10 md:p-14 lg:rounded-[36px]">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-tint-lilac-border) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
              <span className="size-2 rounded-full bg-(--color-ember-700)" />
              Honest analytics
            </span>
            <h2
              id="analytics-title"
              className="mt-4 text-[30px] font-bold leading-tight tracking-tight sm:text-[38px] md:text-[44px] text-(--color-ink-900)"
            >
              Know what happens after the click.
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-(--color-slate-700) md:text-body-l">
              Every click is counted with precision. Spot trends over 30 days and
              discover where your audience lives — without invasive surveillance
              or creepy tracking cookies.
            </p>
          </div>

          {/* Deconstructed Interface Canvas */}
          <figure className="mt-10 overflow-hidden rounded-[18px] border border-(--color-ink-900) bg-white text-(--color-ink-900) shadow-[6px_6px_0_#000]">
            {/* Header bar */}
            <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-(--color-border) bg-(--color-mist-100) px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-(--color-success-700)" />
                <span className="font-mono text-[14px] font-bold text-(--color-ink-900)">
                  {siteConfig.shortLinkHost}/launch-night
                </span>
              </div>
              <span className="rounded bg-white px-2.5 py-1 text-[12px] font-medium text-(--color-slate-700) border border-(--color-mist-300)">
                Sample data for illustration · 30-day window
              </span>
            </figcaption>

            <div className="p-5 sm:p-7 md:p-8">
              {/* Primary Key Metric Tiles */}
              <div className="grid grid-cols-2 gap-4 border-b border-(--color-border) pb-7 sm:grid-cols-4">
                <div>
                  <p className="text-[12px] font-medium text-(--color-slate-700)">
                    Total human clicks
                  </p>
                  <p className="mt-1 text-[30px] font-extrabold tracking-tight sm:text-[38px]">
                    {totalClicks.toLocaleString("en-US")}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-(--color-slate-700)">
                    Approx. unique visitors
                  </p>
                  <p className="mt-1 text-[30px] font-extrabold tracking-tight sm:text-[38px]">
                    {approximateUniques.toLocaleString("en-US")}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-(--color-slate-700)">
                    Peak day traffic
                  </p>
                  <p className="mt-1 text-[30px] font-extrabold tracking-tight sm:text-[38px]">
                    {peakDay}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-medium text-(--color-slate-700)">
                    Bot queries filtered
                  </p>
                  <p className="mt-1 text-[30px] font-extrabold tracking-tight sm:text-[38px] text-(--color-stone-500)">
                    342
                  </p>
                </div>
              </div>

              {/* 30-Day Click Trend Bar Chart */}
              <div
                role="img"
                aria-label={`Bar chart of clicks per day over 30 days. Sample data rising from ${dailyClicks[0]} to ${dailyClicks[29]} clicks a day, with a peak of ${peakDay}.`}
                className="pt-7"
              >
                <div className="flex items-center justify-between text-[13px] font-medium text-(--color-slate-700)">
                  <span>Daily click volume</span>
                  <span>Peak: {peakDay} clicks</span>
                </div>

                <div className="mt-4 flex h-36 items-end gap-[2px] border-b border-(--color-ink-900) pb-0.5 sm:h-44 sm:gap-[3px]">
                  {dailyClicks.map((value, index) => {
                    const isHigh = value > 75;
                    return (
                      <div
                        key={index}
                        title={`Day ${index + 1}: ${value} clicks`}
                        className={cn(
                          "flex-1 rounded-t-[2px] transition-all hover:opacity-80",
                          isHigh ? "bg-(--color-ember-700)" : "bg-(--color-ink-900)"
                        )}
                        style={{ height: `${(value / peakDay) * 100}%` }}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between font-mono text-[12px] text-(--color-stone-500)">
                  <span>30 days ago</span>
                  <span>15 days ago</span>
                  <span>Today</span>
                </div>
              </div>

              {/* Real Metric Breakdowns */}
              <div className="mt-10 grid gap-6 border-t border-(--color-border) pt-8 sm:grid-cols-2 lg:grid-cols-4">
                {breakdowns.map((group) => {
                  const Icon = group.icon;
                  return (
                    <div
                      key={group.title}
                      className="rounded-(--radius-md) border border-(--color-mist-300) bg-(--color-paper) p-4"
                    >
                      <div className="flex items-center gap-2 text-[13px] font-bold text-(--color-ink-900)">
                        <Icon size={16} aria-hidden="true" />
                        <span>{group.title}</span>
                      </div>

                      <ul className="mt-4 space-y-2.5">
                        {group.rows.map(([label, percent]) => (
                          <li key={label}>
                            <div className="flex justify-between text-[13px]">
                              <span className="font-medium text-(--color-slate-700)">
                                {label}
                              </span>
                              <span className="font-mono font-semibold text-(--color-ink-900)">
                                {percent}%
                              </span>
                            </div>
                            <div
                              className="mt-1 h-1.5 w-full rounded-full bg-(--color-mist-300)"
                              aria-hidden="true"
                            >
                              <div
                                className="h-full rounded-full bg-(--color-ink-900)"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              {/* Privacy statement footer */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-(--color-border) pt-4 text-[12px] text-(--color-slate-700)">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-(--color-success-700)" />
                  <span>
                    Aggregate counts only. No IP addresses stored. No visitor tracking cookies.
                  </span>
                </div>
                <span className="font-mono text-(--color-stone-500)">
                  Real-time sync · UTC aligned
                </span>
              </div>
            </div>
          </figure>
        </div>
      </Container>
    </section>
  );
}
