import { TriangleAlert } from "lucide-react";
import { ACTIVE_LINK_LIMIT } from "@/lib/links/list-params";

/**
 * Compact active-link usage for the workspace: used, remaining, and what to do
 * at the limit. Server-rendered from the same stats as the filters, so it
 * updates with every action (disable, archive, delete, enable, restore).
 * The limit itself is enforced by the database, not by this component.
 */
export function UsageMeter({ active }: { active: number }) {
  const left = Math.max(0, ACTIVE_LINK_LIMIT - active);
  const atLimit = left === 0;
  const nearLimit = !atLimit && left <= 5;
  const pct = Math.min(100, Math.round((active / ACTIVE_LINK_LIMIT) * 100));

  return (
    <section
      aria-labelledby="usage-meter-title"
      className="grid gap-x-5 gap-y-2 rounded-(--radius-lg) border border-(--color-border) bg-white px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5"
    >
      <h2 id="usage-meter-title" className="flex items-baseline gap-2 text-[15px]">
        <span className="font-semibold">Active links</span>
        <span className="font-mono font-semibold">{active}<span className="text-(--color-muted)">/{ACTIVE_LINK_LIMIT}</span></span>
      </h2>
      <div
        role="progressbar"
        aria-labelledby="usage-meter-title"
        aria-valuemin={0}
        aria-valuemax={ACTIVE_LINK_LIMIT}
        aria-valuenow={active}
        aria-valuetext={`${active} of ${ACTIVE_LINK_LIMIT} active links used, ${left} left`}
        className="h-2 overflow-hidden rounded-full bg-(--color-mist-100) sm:order-none"
      >
        <div className="h-full bg-(--color-ink-900)" style={{ width: `${pct}%` }} />
      </div>
      <p className={atLimit || nearLimit ? "flex items-start gap-1.5 text-[14px] font-semibold" : "text-small text-(--color-muted)"}>
        {atLimit || nearLimit ? <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" /> : null}
        <span>
          {atLimit
            ? "Limit reached. Disable, archive or delete a link to add another."
            : `${left} left${nearLimit ? ", almost at the limit" : ""}`}
        </span>
      </p>
    </section>
  );
}
