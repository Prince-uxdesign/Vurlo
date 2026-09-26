import { formatCount } from "@/lib/analytics/labels";
import type { LinkMetrics } from "@/lib/analytics/metrics";

/**
 * Metric hierarchy: one dominant number (clicks), one secondary (approx.
 * unique visitors), then the method in plain words. Bot and preview traffic
 * is counted separately, never silently mixed in or dropped. Phones stack
 * the two numbers; from 448px of card width they sit side by side.
 */
export function AnalyticsSummary({ metrics, rangeLabel }: { metrics: LinkMetrics; rangeLabel?: string }) {
  const automated = metrics.bots + metrics.scanners;
  return (
    <section aria-labelledby="summary-heading" className="card @container p-5 sm:p-6">
      <h3 id="summary-heading" className="sr-only">Summary{rangeLabel ? `, ${rangeLabel}` : ""}</h3>
      <dl className="grid gap-x-10 gap-y-4 @md:grid-cols-[auto_minmax(0,1fr)] @md:items-end">
        <div>
          <dt className="text-[14px] font-semibold">Total clicks</dt>
          <dd className="text-display-l mt-1">{formatCount(metrics.clicks)}</dd>
        </div>
        <div className="@md:pb-1.5">
          <dt className="text-[14px] font-semibold">Unique visitors <span className="font-normal text-(--color-muted)">(approx.)</span></dt>
          <dd className="mt-1 text-[26px] font-bold leading-none tracking-tight">{formatCount(metrics.approxUniques)}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-(--color-border) pt-3 text-small text-(--color-muted)">
        Clicks count people, not bots. {formatCount(metrics.totalRequests)} total requests
        {automated > 0 ? `, including ${formatCount(automated)} automated ${automated === 1 ? "visit" : "visits"} (bots and link previews)` : ""}.
        {" "}Counts update as visits arrive and can take up to a minute to catch up. Unique visitors are approximate: one person on two devices can count twice.
      </p>
    </section>
  );
}
