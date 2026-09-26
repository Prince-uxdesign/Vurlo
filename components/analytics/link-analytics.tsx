import { BREAKDOWN_DIMENSIONS } from "@/lib/analytics/metrics";
import type { LinkAnalyticsData } from "@/lib/analytics/detail";
import { bucketForPreset } from "@/lib/analytics/presets";
import { AnalyticsEmpty } from "./analytics-empty";
import { AnalyticsSummary } from "./analytics-summary";
import { BreakdownList } from "./breakdown-list";
import { PRESET_LABELS } from "./preset-switcher";
import { TrendChart } from "./trend-chart";

/**
 * The analytics half of the link page: summary, trend, then five ranked
 * breakdowns. Columns follow the width this column actually gets (container
 * queries), not the screen: one column on phones and narrow panes, two once
 * cards have room for readable labels, three on a wide single-column page.
 */
export function LinkAnalytics({ data, shortUrl }: { data: LinkAnalyticsData; shortUrl: string }) {
  const { preset, metrics, timeseries, breakdowns } = data;

  if (!metrics.hasData) {
    return <AnalyticsEmpty shortUrl={shortUrl} rangeLabel={preset === "all" ? null : PRESET_LABELS[preset].toLowerCase()} />;
  }

  return (
    <div className="@container space-y-4 sm:space-y-6">
      <AnalyticsSummary metrics={metrics} rangeLabel={PRESET_LABELS[preset]} />
      <TrendChart
        points={timeseries}
        bucket={bucketForPreset(preset)}
        headingLevel={3}
        windowedNote={preset === "all" ? "Chart shows the last 30 days. Totals above cover all time." : undefined}
      />
      <section aria-labelledby="breakdowns-heading">
        <h3 id="breakdowns-heading" className="text-h3">Where clicks come from</h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:gap-6 @xl:grid-cols-2 @5xl:grid-cols-3">
          {BREAKDOWN_DIMENSIONS.map((dimension) => (
            <BreakdownList key={dimension} dimension={dimension} rows={breakdowns[dimension]} />
          ))}
        </div>
      </section>
    </div>
  );
}
