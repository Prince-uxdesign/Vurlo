import Link from "next/link";
import { ANALYTICS_PRESETS, type AnalyticsPreset } from "@/lib/analytics/presets";
import { cn } from "@/lib/utils/cn";

const LABELS: Record<AnalyticsPreset, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};

/**
 * Time-range picking without any client JavaScript: plain links, so it works
 * with keyboards, screen readers and touch alike. The active range uses a
 * filled rectangle -- never the pill shape (reserved for the primary CTA).
 */
export function PresetSwitcher({ linkId, preset }: { linkId: string; preset: AnalyticsPreset }) {
  return (
    <nav aria-label="Analytics time range">
      <ul className="flex flex-wrap gap-2">
        {ANALYTICS_PRESETS.map((p) => {
          const active = p === preset;
          return (
            <li key={p}>
              <Link
                href={`/links/${linkId}?range=${p}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-(--radius-md) border px-4 text-[14px] font-semibold",
                  active
                    ? "border-(--color-ink-900) bg-(--color-ink-900) text-white"
                    : "border-(--color-border) bg-(--color-surface) hover:bg-(--color-mist-100)",
                )}
              >
                {LABELS[p]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
