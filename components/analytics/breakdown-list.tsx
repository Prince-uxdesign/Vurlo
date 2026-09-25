import { DIMENSION_TITLES, dimensionLabel, formatCount } from "@/lib/analytics/labels";
import type { BreakdownDimension, BreakdownRow } from "@/lib/analytics/metrics";

/**
 * One ranked breakdown (§5-9): label, count and share as real text, with a
 * quiet ink bar for proportion. Lists, never tables that would force
 * horizontal scrolling on phones; never a chart where rows read better
 * (countries, referrers); color never the only signal (every row is words
 * and numbers first).
 */
export function BreakdownList({
  dimension,
  rows,
}: {
  dimension: BreakdownDimension;
  rows: BreakdownRow[];
}) {
  const meta = DIMENSION_TITLES[dimension];
  const max = Math.max(1, ...rows.map((r) => r.human));
  return (
    <section aria-labelledby={`breakdown-${dimension}`} className="card flex flex-col p-5 sm:p-6">
      <h2 id={`breakdown-${dimension}`} className="text-h3">
        {meta.title}
      </h2>
      <p className="mt-1 text-small text-(--color-muted)">{meta.hint}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-small text-(--color-muted)">Nothing here for this period yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[14px] font-semibold">
                  {dimensionLabel(dimension, row.key)}
                </span>
                <span className="flex-none text-small text-(--color-muted)">
                  {formatCount(row.human)} · {row.pct}%
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--color-mist-100)"
                role="img"
                aria-label={`${dimensionLabel(dimension, row.key)}: ${row.human} clicks, ${row.pct} percent of human clicks`}
              >
                <div
                  className="h-full rounded-full bg-(--color-ink-900)"
                  style={{ width: `${Math.max(row.human > 0 ? 4 : 0, (row.human / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
