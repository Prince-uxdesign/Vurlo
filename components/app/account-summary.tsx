import Link from "next/link";
import { formatCount } from "@/lib/analytics/labels";
import { ACTIVE_LINK_LIMIT } from "@/lib/links/list-params";
import type { LinkStats } from "@/lib/links/workspace-types";

/** Within this many of the limit, the card says how many are left and what happens at the limit. */
const NEAR_LIMIT = 5;

/**
 * Account at a glance: active links against the limit (the one number that
 * can block you), then total links and all-time clicks. Real counts only:
 * no growth percentages, no comparisons that aren't computed, and when
 * clicks couldn't be loaded the card says so instead of showing a zero.
 * There's no billing, so the limit copy explains what frees a slot rather
 * than selling an upgrade.
 */
export function AccountSummary({ stats, totalClicks }: { stats: LinkStats; totalClicks: number | null }) {
  const used = stats.active;
  const left = Math.max(0, ACTIVE_LINK_LIMIT - used);
  const pct = Math.min(100, Math.round((used / ACTIVE_LINK_LIMIT) * 100));
  const atLimit = left === 0;
  const nearLimit = !atLimit && left <= NEAR_LIMIT;

  return (
    <section aria-labelledby="summary-title" className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
      <h2 id="summary-title" className="sr-only">Account summary</h2>
      <div className="p-4 sm:p-5">
        <p className="text-[14px] font-semibold" id="active-links-label">Active links</p>
        <p className="mt-1 text-[30px] font-bold leading-none tracking-tight">
          {used} <span className="text-[20px] font-semibold text-(--color-muted)">/ {ACTIVE_LINK_LIMIT}</span>
        </p>
        <div
          role="progressbar"
          aria-labelledby="active-links-label"
          aria-valuemin={0}
          aria-valuemax={ACTIVE_LINK_LIMIT}
          aria-valuenow={used}
          aria-valuetext={`${used} of ${ACTIVE_LINK_LIMIT} active links used, ${left} left`}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-(--color-mist-100)"
        >
          <div className="h-full bg-(--color-ink-900)" style={{ width: `${pct}%` }} />
        </div>
        <p className={atLimit || nearLimit ? "mt-3 text-[14px] font-medium" : "text-small mt-3 text-(--color-muted)"}>
          {atLimit ? (
            <>
              You&apos;re at the limit. To create or re-enable a link, first{" "}
              <Link href="/links?status=active" className="font-semibold underline underline-offset-2">
                disable, archive or delete an active one
              </Link>
              .
            </>
          ) : nearLimit ? (
            `${left} ${left === 1 ? "slot" : "slots"} left. Expired, disabled and archived links don't count toward the ${ACTIVE_LINK_LIMIT}.`
          ) : (
            `${left} left. Expired, disabled and archived links don't count.`
          )}
        </p>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-(--color-border) border-t border-(--color-border)">
        <div className="min-w-0 p-4 sm:px-5">
          <dt className="text-small text-(--color-muted)">Total clicks</dt>
          <dd className="mt-1">
            <span className="block text-[26px] font-bold leading-none tracking-tight">
              {totalClicks === null ? <span className="text-[15px] font-medium text-(--color-muted)">Unavailable</span> : formatCount(totalClicks)}
            </span>
            <span className="text-small mt-1.5 block text-(--color-muted)">{totalClicks === null ? "Try again in a moment." : "All time, people only."}</span>
          </dd>
        </div>
        <div className="min-w-0 p-4 sm:px-5">
          <dt className="text-small text-(--color-muted)">Total links</dt>
          <dd className="mt-1">
            <span className="block text-[26px] font-bold leading-none tracking-tight">{formatCount(stats.total)}</span>
            <span className="text-small mt-1.5 block text-(--color-muted)">Not counting deleted.</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
