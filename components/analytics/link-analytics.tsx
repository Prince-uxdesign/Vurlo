import { BREAKDOWN_DIMENSIONS } from "@/lib/analytics/metrics";
import type { LinkAnalyticsDetail } from "@/lib/analytics/detail";
import { AnalyticsEmpty } from "./analytics-empty";
import { AnalyticsSummary } from "./analytics-summary";
import { BreakdownList } from "./breakdown-list";
import { PresetSwitcher } from "./preset-switcher";
import { TrendChart } from "./trend-chart";

/**
 * The link analytics experience (§1-9): hero metric, trend, then five ranked
 * breakdowns. Layout is viewport-driven: stacked on phones, two columns on
 * tablets, three on desktop. Nothing here needs client JavaScript -- the
 * range switcher is plain links, the trend is HTML bars -- so touch,
 * keyboard and screen-reader users get the same numbers.
 */
export function LinkAnalytics({ detail, shortUrl }: { detail: LinkAnalyticsDetail; shortUrl: string }) {
  const { link, preset, metrics, timeseries, breakdowns } = detail;

  if (!metrics.hasData) {
    return (
      <div className="mt-6 space-y-6">
        <PresetSwitcher linkId={link.id} preset={preset} />
        <AnalyticsEmpty shortUrl={shortUrl} />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <PresetSwitcher linkId={link.id} preset={preset} />
      <AnalyticsSummary metrics={metrics} />
      <TrendChart
        points={timeseries}
        bucket={preset === "24h" ? "hour" : "day"}
        windowedNote={
          preset === "all"
            ? "Chart shows the last 30 days. Totals above cover all time."
            : undefined
        }
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {BREAKDOWN_DIMENSIONS.map((dimension) => (
          <BreakdownList key={dimension} dimension={dimension} rows={breakdowns[dimension]} />
        ))}
      </div>
    </div>
  );
}
