import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/cn";
import { SectionHeading } from "./section-heading";

/** Illustrative numbers only. Never presented as live or real usage. */
const dailyClicks = [
  22, 30, 26, 34, 41, 38, 29, 33, 45, 52, 48, 40, 36, 44, 58, 63, 55, 49, 61,
  72, 84, 96, 88, 74, 68, 79, 91, 85, 77, 93,
];
const total = dailyClicks.reduce((sum, n) => sum + n, 0);
const peak = Math.max(...dailyClicks);

const breakdowns = [
  {
    title: "Device",
    rows: [["Mobile", 64], ["Desktop", 31], ["Tablet", 5]],
  },
  {
    title: "Country",
    rows: [["United States", 38], ["United Kingdom", 17], ["Nigeria", 14], ["Canada", 9]],
  },
  {
    title: "Browser",
    rows: [["Chrome", 52], ["Safari", 34], ["Firefox", 8], ["Edge", 6]],
  },
  {
    title: "Operating system",
    rows: [["iOS", 41], ["Android", 26], ["Windows", 19], ["macOS", 14]],
  },
  {
    title: "Referrer",
    rows: [["Direct", 45], ["Instagram", 24], ["Newsletter", 18], ["X", 13]],
  },
] as const;

export function AnalyticsSection() {
  return (
    <section
      id="analytics"
      aria-labelledby="analytics-title"
      className="scroll-mt-16 bg-(--color-ink-900) py-14 text-white md:py-20"
    >
      <Container>
        <SectionHeading
          id="analytics-title"
          invert
          eyebrow="Analytics"
          title="Know what happens after you share."
        >
          Every click is counted. See how a link performs over time and where
          the people clicking it are coming from.
        </SectionHeading>

        <figure className="mt-10 overflow-hidden rounded-(--radius-lg) bg-white text-(--color-ink-900)">
          <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-(--color-border) px-4 py-3 md:px-6">
            <span className="font-mono text-[14px] font-semibold">
              vurlo.link/launch-night
            </span>
            <span className="text-small text-(--color-muted)">
              Last 30 days · Sample data for illustration
            </span>
          </figcaption>

          <div className="p-4 md:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-small text-(--color-muted)">Total clicks</p>
                <p className="text-[36px] font-bold leading-none tracking-tight md:text-[44px]">
                  {total.toLocaleString("en-US")}
                </p>
              </div>
              <p className="text-small text-right text-(--color-muted)">
                Peak day: {peak}
              </p>
            </div>

            <div
              role="img"
              aria-label={`Bar chart of clicks per day over 30 days. Sample data rising from ${dailyClicks[0]} to ${dailyClicks[29]} clicks a day, with a peak of ${peak}.`}
              className="mt-6"
            >
              <div className="flex h-36 items-end gap-[2px] sm:gap-[3px] border-b border-(--color-ink-900) md:h-44">
                {dailyClicks.map((value, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t-[2px] bg-(--color-ember-700)"
                    style={{ height: `${(value / peak) * 100}%` }}
                  />
                ))}
              </div>
              <div className="text-small mt-1.5 flex justify-between text-(--color-muted)">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>

            <div className="mt-8 grid gap-x-8 gap-y-7 border-t border-(--color-border) pt-6 sm:grid-cols-2 lg:grid-cols-3">
              {breakdowns.map((group, index) => (
                <section
                  key={group.title}
                  aria-label={group.title}
                  className={index === 4 ? "sm:col-span-2 lg:col-span-1" : undefined}
                >
                  <h3 className="text-label">{group.title}</h3>
                  <ul className={cn("mt-3 grid gap-3", index === 4 && "sm:grid-cols-2 lg:grid-cols-1")}>
                    {group.rows.map(([label, percent]) => (
                      <li key={label}>
                        <div className="flex justify-between gap-3 text-[14px]">
                          <span>{label}</span>
                          <span className="font-mono">{percent}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-(--color-mist-100)" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-(--color-ink-900)"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </figure>
      </Container>
    </section>
  );
}
