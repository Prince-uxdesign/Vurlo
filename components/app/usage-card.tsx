import { TriangleAlert } from "lucide-react";
import { ACTIVE_LINK_LIMIT } from "@/lib/links/list-params";
import type { LinkStats } from "@/lib/links/workspace-types";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 p-4">
      <dt className="text-small text-(--color-muted)">{label}</dt>
      <dd className="mt-1 text-[26px] font-bold leading-none tracking-tight">{value}</dd>
      {note ? <p className="text-small mt-1.5 text-(--color-muted)">{note}</p> : null}
    </div>
  );
}

/** Links, usage against the limit, and clicks (honestly "not tracked yet"). */
export function UsageCard({ stats }: { stats: LinkStats }) {
  const used = stats.active;
  const pct = Math.min(100, Math.round((used / ACTIVE_LINK_LIMIT) * 100));
  const atLimit = used >= ACTIVE_LINK_LIMIT;
  const nearLimit = !atLimit && used >= Math.ceil(ACTIVE_LINK_LIMIT * 0.9);

  return (
    <section aria-labelledby="usage-title" className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
      <div className="p-4 sm:p-5">
        <h2 id="usage-title" className="text-small text-(--color-muted)">Active links</h2>
        <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
          {used} <span className="text-(--color-muted)">/ {ACTIVE_LINK_LIMIT}</span>
        </p>
        <div
          role="progressbar"
          aria-label="Active links used"
          aria-valuemin={0}
          aria-valuemax={ACTIVE_LINK_LIMIT}
          aria-valuenow={used}
          aria-valuetext={`${used} of ${ACTIVE_LINK_LIMIT} active links`}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-(--color-mist-100)"
        >
          <div className="h-full bg-(--color-ink-900)" style={{ width: `${pct}%` }} />
        </div>
        {atLimit || nearLimit ? (
          <p className="mt-3 flex items-start gap-2 text-[14px] font-medium">
            <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
            <span>
              {atLimit
                ? "You've reached the limit. Disable, archive or delete a link to create or re-enable another."
                : `You're close to the limit of ${ACTIVE_LINK_LIMIT} active links.`}
            </span>
          </p>
        ) : (
          <p className="text-small mt-3 text-(--color-muted)">
            Expired, disabled, archived and deleted links don&apos;t count.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 divide-x divide-(--color-border) border-t border-(--color-border)">
        <Stat label="Total links" value={String(stats.total)} />
        <Stat label="Total clicks" value="—" note="Click tracking arrives with analytics." />
      </dl>
    </section>
  );
}
