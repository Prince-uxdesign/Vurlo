import { DIMENSION_TITLES, dimensionLabel, formatCount } from "@/lib/analytics/labels";
import type { BreakdownDimension, BreakdownRow } from "@/lib/analytics/metrics";

const VISIBLE_ROWS = 5;

function Row({ dimension, row, max }: { dimension: BreakdownDimension; row: BreakdownRow; max: number }) {
  const name = dimensionLabel(dimension, row.key);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[14px] font-semibold" title={name}>{name}</span>
        <span className="flex-none text-small text-(--color-muted)">
          {formatCount(row.human)} <span aria-hidden="true">/</span><span className="sr-only">clicks,</span> {row.pct}%
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--color-mist-100)" aria-hidden="true">
        <div
          className="h-full rounded-full bg-(--color-ink-900)"
          style={{ width: `${Math.max(row.human > 0 ? 4 : 0, (row.human / max) * 100)}%` }}
        />
      </div>
    </li>
  );
}

/**
 * One ranked breakdown: label, count and share as real text, with a quiet
 * ink bar for proportion (decorative; the words carry the data). The top
 * five rows show; a long tail (countries, referrers) folds behind a native
 * disclosure so phones don't scroll through dozens of one-click rows.
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
  const head = rows.slice(0, VISIBLE_ROWS);
  const tail = rows.slice(VISIBLE_ROWS);
  return (
    <section aria-labelledby={`breakdown-${dimension}`} className="card flex flex-col p-5 sm:p-6">
      <h4 id={`breakdown-${dimension}`} className="text-[16px] font-semibold leading-snug">
        {meta.title}
      </h4>
      <p className="mt-1 text-small text-(--color-muted)">{meta.hint}</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-small text-(--color-muted)">Nothing here for this period yet.</p>
      ) : (
        <>
          <ol className="mt-4 space-y-3">
            {head.map((row) => <Row key={row.key} dimension={dimension} row={row} max={max} />)}
          </ol>
          {tail.length > 0 ? (
            <details className="group mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-[14px] font-semibold underline underline-offset-2">
                <span className="group-open:hidden">Show {tail.length} more</span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <ol className="mt-1 space-y-3" start={VISIBLE_ROWS + 1}>
                {tail.map((row) => <Row key={row.key} dimension={dimension} row={row} max={max} />)}
              </ol>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
