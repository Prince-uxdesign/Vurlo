import { formatBucketFull, formatBucketTick, formatCount } from "@/lib/analytics/labels";
import type { TimeseriesBucket } from "@/lib/analytics/presets";
import type { TimeseriesPoint } from "@/lib/analytics/metrics";
import { cn } from "@/lib/utils/cn";

interface TrendChartProps {
  points: TimeseriesPoint[];
  bucket: TimeseriesBucket;
  /** True when the chart is windowed but the totals cover more (the "all" preset). */
  windowedNote?: string;
}

const MAX_TICKS = 5;

/**
 * Clicks over time as real HTML bars, not SVG: text never shrinks with the
 * viewport (readable at 320px), touch users get the same values as mouse
 * users (no hover-only tooltips), and the full series ships as a semantic
 * table for screen readers. The busiest period gets the one rationed-orange
 * mark on this screen, and it is also named in words -- never color alone.
 */
export function TrendChart({ points, bucket, windowedNote }: TrendChartProps) {
  const max = Math.max(1, ...points.map((p) => p.human));
  const total = points.reduce((s, p) => s + p.human, 0);
  const peakIndex = points.reduce((best, p, i) => (p.human > points[best]!.human ? i : best), 0);
  const peak = points[peakIndex]!;

  // Sparse, evenly spaced ticks: at most five, always including the last.
  const tickIndexes = points.length <= MAX_TICKS
    ? points.map((_, i) => i)
    : Array.from({ length: MAX_TICKS }, (_, k) =>
        Math.round((k * (points.length - 1)) / (MAX_TICKS - 1)),
      );

  const description =
    `${total} human clicks over ${points.length} ${bucket === "hour" ? "hours" : "days"}. ` +
    `Busiest: ${formatBucketFull(peak.bucketStart, bucket)} with ${peak.human} clicks.`;

  return (
    <section aria-labelledby="trend-heading" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="trend-heading" className="text-h3">
          Clicks over time
        </h2>
        <p className="text-small text-(--color-muted)">{formatCount(total)} clicks in view</p>
      </div>
      {windowedNote ? (
        <p className="mt-1 text-small text-(--color-muted)">{windowedNote}</p>
      ) : null}

      <div
        role="img"
        aria-label={description}
        className="mt-5"
      >
        {/* Gridlines + bars share one fixed plot height; bars flex to fill it. */}
        <div className="relative">
          <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-t border-(--color-border)" />
            ))}
          </div>
          <ol className="relative flex h-36 items-stretch gap-[3px] sm:h-44 sm:gap-1">
            {points.map((p, i) => (
              <li key={p.bucketStart} className="flex min-w-0 flex-1 flex-col justify-end" title={`${formatBucketFull(p.bucketStart, bucket)}: ${p.human} clicks`}>
                <div
                  className={cn(
                    "w-full rounded-t-[3px]",
                    i === peakIndex && p.human > 0 ? "bg-(--color-ember-700)" : "bg-(--color-ink-900)",
                  )}
                  style={{ height: p.human > 0 ? `${Math.max(6, (p.human / max) * 100)}%` : "2px" }}
                />
                <span className="sr-only">
                  {formatBucketFull(p.bucketStart, bucket)}: {p.human} clicks
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div aria-hidden="true" className="relative mt-2 flex text-[12px] text-(--color-muted)">
          {points.map((p, i) => (
            <span key={p.bucketStart} className="min-w-0 flex-1 truncate text-center">
              {tickIndexes.includes(i) ? formatBucketTick(p.bucketStart, bucket) : ""}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 text-small text-(--color-muted)">
        Busiest period: {formatBucketFull(peak.bucketStart, bucket)} ({formatCount(peak.human)}{" "}
        {peak.human === 1 ? "click" : "clicks"}).
      </p>

      {/* Accessible alternative: the complete series as a real table. */}
      <table className="sr-only">
        <caption>Clicks per {bucket === "hour" ? "hour" : "day"}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Clicks</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.bucketStart}>
              <th scope="row">{formatBucketFull(p.bucketStart, bucket)}</th>
              <td>{p.human}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
