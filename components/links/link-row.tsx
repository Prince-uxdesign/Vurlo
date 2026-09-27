import { CalendarClock, CalendarPlus, MousePointerClick, Tag } from "lucide-react";
import Link from "next/link";
import { displayUrlFor, shortUrlFor } from "@/config/site";
import { formatCount } from "@/lib/analytics/labels";
import type { LinkClicks } from "@/lib/dashboard/shape";
import { describeExpiry, formatDate } from "@/lib/format";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { hasUtm } from "@/lib/validation/utm";
import { ExpandableUrl } from "./expandable-url";
import { LinkActions } from "./link-actions";
import { StatusBadge } from "./status-badge";

/**
 * One link, in one component, two distinct presentations via container queries:
 *  - narrow (mobile & dashboard column): an intentionally designed card prioritizing:
 *      1. short URL & status
 *      2. destination URL
 *      3. clicks count & dates
 *      4. key action (Copy/Open) + secondary menu
 *  - wide (desktop workspace): a structured table-like list row with clean columnar alignment
 */
export function LinkRow({
  link,
  now,
  clicks,
}: {
  link: LinkListItem;
  now: Date;
  clicks?: LinkClicks | null;
}) {
  const expiry = describeExpiry(link.expiresAt, now);
  const displayUrl = displayUrlFor(link.slug);
  const tagged = hasUtm(link.destinationUrl, {
    source: link.utmSource,
    medium: link.utmMedium,
    campaign: link.utmCampaign,
  });

  return (
    <li className="@container transition-colors hover:bg-stone-50/60">
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-3 @2xl:grid-cols-[minmax(0,1fr)_auto] @4xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] @4xl:gap-x-10">
          {/* Column 1: Identity (Short URL + Status + Destination) */}
          <div className="min-w-0 @2xl:col-start-1 @2xl:row-start-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link
                href={`/links/${link.id}`}
                className="-my-1 min-w-0 break-all py-1 font-mono text-[16px] font-semibold leading-snug text-(--color-ink-900) underline decoration-(--color-mist-300) decoration-2 underline-offset-4 hover:decoration-(--color-ink-900) hover:text-(--color-ember-700)"
              >
                {displayUrl}
                <span className="sr-only">, view analytics and settings</span>
              </Link>
              {/* On mobile / tablet, badge sits directly next to short link */}
              <span className="@4xl:hidden">
                <StatusBadge status={link.effectiveStatus} />
              </span>
            </div>

            <ExpandableUrl
              url={link.destinationUrl}
              className="text-small mt-1.5 text-(--color-muted)"
            />
          </div>

          {/* Column 2: Meta (Clicks, Created, Expiry, UTM) */}
          <div className="min-w-0 @2xl:col-start-1 @2xl:row-start-2 @4xl:col-start-2 @4xl:row-start-1">
            <span className="mb-2 hidden @4xl:inline-block">
              <StatusBadge status={link.effectiveStatus} />
            </span>

            <dl className="grid gap-y-1.5 text-[13px] sm:text-[14px]">
              {clicks ? (
                <div className="flex items-center gap-2">
                  <MousePointerClick
                    size={15}
                    aria-hidden="true"
                    className="flex-none text-(--color-muted)"
                  />
                  <dt className="sr-only">Clicks</dt>
                  <dd className="font-medium text-(--color-ink-900)">
                    <span className="font-semibold text-(--color-ink-900)">
                      {formatCount(clicks.clicks)}
                    </span>{" "}
                    {clicks.clicks === 1 ? "click" : "clicks"}
                  </dd>
                </div>
              ) : null}

              <div className="flex items-center gap-2 text-(--color-slate-700)">
                <CalendarPlus
                  size={15}
                  aria-hidden="true"
                  className="flex-none text-(--color-muted)"
                />
                <dt className="sr-only">Created</dt>
                <dd>Created {formatDate(link.createdAt)}</dd>
              </div>

              <div className="flex items-center gap-2 text-(--color-slate-700)">
                <CalendarClock
                  size={15}
                  aria-hidden="true"
                  className="flex-none text-(--color-muted)"
                />
                <dt className="sr-only">Expiry</dt>
                <dd
                  className={expiry.soon ? "font-semibold text-(--color-ember-700)" : undefined}
                  title={expiry.soon && expiry.date ? expiry.date : undefined}
                >
                  {expiry.text}
                </dd>
              </div>

              {tagged ? (
                <div className="flex items-center gap-2 text-(--color-slate-700)">
                  <Tag
                    size={15}
                    aria-hidden="true"
                    className="flex-none text-(--color-muted)"
                  />
                  <dt className="sr-only">Tracking</dt>
                  <dd className="text-emerald-700 font-medium">UTM tagged</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Column 3: Actions (Copy, Open, More Menu) */}
          <div className="@2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1 @4xl:col-start-3 @4xl:row-span-1 @4xl:self-center">
            <LinkActions
              link={link}
              displayUrl={displayUrl}
              shortUrl={shortUrlFor(link.slug)}
            />
          </div>
        </div>
      </div>
    </li>
  );
}
