import { formatCount } from "@/lib/analytics/labels";
import type { LinkMetrics } from "@/lib/analytics/metrics";

/**
 * Metric hierarchy (§2): one dominant number (Total clicks), one secondary
 * (Approx. unique visitors), then quiet supporting facts. The filtering
 * methodology is stated in plain words -- bot visits are counted separately,
 * never silently mixed in or dropped.
 */
export function AnalyticsSummary({ metrics }: { metrics: LinkMetrics }) {
  const automated = metrics.bots + metrics.scanners;
  return (
    <div className="card p-5 sm:p-8">
      <p className="text-[14px] font-semibold">Total clicks</p>
      <p className="text-display-l mt-1" aria-label={`${metrics.clicks} total clicks`}>
        {formatCount(metrics.clicks)}
      </p>
      <p className="mt-2 text-[15px]">
        Approx. {formatCount(metrics.approxUniques)} unique{" "}
        {metrics.approxUniques === 1 ? "visitor" : "visitors"}
      </p>
      <p className="mt-1 text-small text-(--color-muted)">
        Human visits. {formatCount(metrics.totalRequests)} total requests
        {automated > 0 ? `, including ${formatCount(automated)} automated ${automated === 1 ? "visit" : "visits"} shown separately below` : ""}.
      </p>
      <p className="mt-3 border-t border-(--color-border) pt-3 text-small text-(--color-muted)">
        Counts update as visits arrive. Unique visitors are approximate: one person on two
        devices can count twice.
      </p>
    </div>
  );
}
