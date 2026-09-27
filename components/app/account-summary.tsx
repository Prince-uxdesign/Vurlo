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
export function AccountSummary({
  stats,
  totalClicks,
}: {
  stats: LinkStats;
  totalClicks: number | null;
}) {
  const used = stats.active;
  const left = Math.max(0, ACTIVE_LINK_LIMIT - used);
  const pct = Math.min(100, Math.round((used / ACTIVE_LINK_LIMIT) * 100));
  const atLimit = left === 0;
  const nearLimit = !atLimit && left <= NEAR_LIMIT;

  return (
    <section
      aria-labelledby="summary-title"
      className="overflow-hidden rounded-2xl border border-(--color-mist-300) bg-white shadow-2xs"
    >
      <h2 id="summary-title" className="sr-only">
        Account summary
      </h2>

      {/* Primary Usage Metric: Active Links against Limit */}
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-(--color-ink-900)" id="active-links-label">
            Active links
          </p>
          <span
            className={
              atLimit
                ? "inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                : nearLimit
                ? "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                : "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
            }
          >
            <span
              className={
                atLimit
                  ? "size-1.5 rounded-full bg-red-600"
                  : nearLimit
                  ? "size-1.5 rounded-full bg-amber-600"
                  : "size-1.5 rounded-full bg-emerald-600"
              }
              aria-hidden="true"
            />
            {atLimit ? "Capacity full" : nearLimit ? "Near limit" : "Healthy capacity"}
          </span>
        </div>

        <p className="mt-2 text-[32px] font-bold leading-none tracking-tight text-(--color-ink-900)">
          {used}{" "}
          <span className="text-[20px] font-semibold text-(--color-stone-500)">
            / {ACTIVE_LINK_LIMIT}
          </span>
        </p>

        {/* Progress Bar */}
        <div
          role="progressbar"
          aria-labelledby="active-links-label"
          aria-valuemin={0}
          aria-valuemax={ACTIVE_LINK_LIMIT}
          aria-valuenow={used}
          aria-valuetext={`${used} of ${ACTIVE_LINK_LIMIT} active links used, ${left} left`}
          className="mt-3.5 h-2 overflow-hidden rounded-full bg-(--color-mist-100)"
        >
          <div
            className={`h-full transition-all duration-300 ${
              atLimit
                ? "bg-(--color-danger-700)"
                : nearLimit
                ? "bg-(--color-ember-700)"
                : "bg-(--color-ink-900)"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Explanatory text */}
        <p
          className={
            atLimit || nearLimit
              ? "mt-3 text-[13px] font-medium text-(--color-slate-700)"
              : "mt-3 text-[13px] text-(--color-stone-500)"
          }
        >
          {atLimit ? (
            <>
              You&apos;re at the limit. To create or re-enable a link, first{" "}
              <Link
                href="/links?status=active"
                className="font-semibold text-(--color-ink-900) underline underline-offset-2 hover:text-(--color-ember-700)"
              >
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

      {/* Secondary Metrics: Total Clicks & Total Links */}
      <dl className="grid grid-cols-2 divide-x divide-(--color-mist-200) border-t border-(--color-mist-200) bg-(--color-paper)/40">
        <div className="min-w-0 p-4 sm:px-5">
          <div className="flex items-center gap-2">
            <dt className="text-[13px] font-medium text-(--color-stone-500)">
              Total clicks
            </dt>
            <span className="inline-block size-1.5 rounded-full bg-purple-500" aria-hidden="true" />
          </div>
          <dd className="mt-1">
            <span className="block text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-(--color-ink-900)">
              {totalClicks === null ? (
                <span className="text-[14px] font-medium text-(--color-stone-500)">
                  Unavailable
                </span>
              ) : (
                formatCount(totalClicks)
              )}
            </span>
            <span className="mt-1.5 block text-[12px] text-(--color-stone-500)">
              {totalClicks === null ? "Try again in a moment." : "All time, people only."}
            </span>
          </dd>
        </div>

        <div className="min-w-0 p-4 sm:px-5">
          <div className="flex items-center gap-2">
            <dt className="text-[13px] font-medium text-(--color-stone-500)">
              Total links
            </dt>
            <span className="inline-block size-1.5 rounded-full bg-blue-500" aria-hidden="true" />
          </div>
          <dd className="mt-1">
            <span className="block text-[24px] sm:text-[26px] font-bold leading-none tracking-tight text-(--color-ink-900)">
              {formatCount(stats.total)}
            </span>
            <span className="mt-1.5 block text-[12px] text-(--color-stone-500)">
              Not counting deleted.
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
