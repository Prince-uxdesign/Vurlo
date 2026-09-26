import Link from "next/link";
import { ANALYTICS_PRESETS, type AnalyticsPreset } from "@/lib/analytics/presets";
import { cn } from "@/lib/utils/cn";

export const PRESET_LABELS: Record<AnalyticsPreset, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};

/**
 * Time-range picking without client JavaScript: plain links, so keyboards,
 * screen readers and touch all work. One segmented row at every width (four
 * equal cells on a 320px phone, never wrapping), and switching keeps your
 * scroll position instead of jumping to the top. The active range is a
 * filled rectangle, never the pill shape reserved for the primary CTA.
 */
export function PresetSwitcher({ linkId, preset }: { linkId: string; preset: AnalyticsPreset }) {
  return (
    <nav aria-label="Analytics time range">
      <ul className="grid grid-cols-4 rounded-(--radius-md) border border-(--color-border) bg-(--color-surface) p-1 sm:inline-grid">
        {ANALYTICS_PRESETS.map((p) => {
          const active = p === preset;
          return (
            <li key={p} className="min-w-0">
              <Link
                href={`/links/${linkId}?range=${p}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center whitespace-nowrap rounded-(--radius-sm) px-2 text-[14px] font-semibold sm:px-4",
                  active ? "bg-(--color-ink-900) text-white" : "text-(--color-muted) hover:bg-(--color-mist-100) hover:text-(--color-ink-900)",
                )}
              >
                {PRESET_LABELS[p]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
