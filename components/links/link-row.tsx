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
 * One link, in one component, three compositions chosen by available width:
 *  - narrow (phones, dashboard column): a stacked card (identity, meta, then a full-width action row)
 *  - medium (tablets): identity + meta on the left, actions on the right
 *  - wide (desktop list): a structured row (identity | status + dates | actions)
 * Placement uses grid-area classes so the DOM (and reading order) never changes.
 * The short URL opens the link's page (analytics and settings). `clicks` is
 * all-time human clicks; when it couldn't be loaded the line is left out
 * rather than shown as a false zero.
 */
export function LinkRow({ link, now, clicks }: { link: LinkListItem; now: Date; clicks?: LinkClicks | null }) {
  const expiry = describeExpiry(link.expiresAt, now);
  const displayUrl = displayUrlFor(link.slug);
  // Only whether visitors arrive tagged; the values themselves live in Edit.
  const tagged = hasUtm(link.destinationUrl, {
    source: link.utmSource,
    medium: link.utmMedium,
    campaign: link.utmCampaign,
  });

  return (
    // The row picks its layout from the width it is actually given (container
    // queries), not the screen: the dashboard's narrow column and the wide
    // workspace list get the right composition on any device.
    <li className="@container">
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-3 @2xl:grid-cols-[minmax(0,1fr)_auto] @4xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] @4xl:gap-x-10">
          <div className="min-w-0 @2xl:col-start-1 @2xl:row-start-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link
                href={`/links/${link.id}`}
                className="-my-1 min-w-0 break-all py-1 font-mono text-[16px] font-semibold leading-snug underline decoration-(--color-mist-300) decoration-2 underline-offset-4 hover:decoration-(--color-ink-900)"
              >
                {displayUrl}
                <span className="sr-only">, view analytics and settings</span>
              </Link>
              {/* Visibility classes go on a wrapper: .badge sets its own display. */}
              <span className="@4xl:hidden"><StatusBadge status={link.effectiveStatus} /></span>
            </div>
            <ExpandableUrl url={link.destinationUrl} className="text-small mt-1.5 text-(--color-muted)" />
          </div>

          <div className="min-w-0 @2xl:col-start-1 @2xl:row-start-2 @4xl:col-start-2 @4xl:row-start-1">
            <span className="mb-2 hidden @4xl:inline-block"><StatusBadge status={link.effectiveStatus} /></span>
            <dl className="grid gap-y-1 text-[14px]">
              {clicks ? (
                <div className="flex items-center gap-2">
                  <MousePointerClick size={16} aria-hidden="true" className="flex-none text-(--color-muted)" />
                  <dt className="sr-only">Clicks</dt>
                  <dd>
                    <span className="font-semibold">{formatCount(clicks.clicks)}</span> {clicks.clicks === 1 ? "click" : "clicks"}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <CalendarPlus size={16} aria-hidden="true" className="flex-none text-(--color-muted)" />
                <dt className="sr-only">Created</dt>
                <dd>Created {formatDate(link.createdAt)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock size={16} aria-hidden="true" className="flex-none text-(--color-muted)" />
                <dt className="sr-only">Expiry</dt>
                <dd className={expiry.soon ? "font-semibold" : undefined} title={expiry.soon && expiry.date ? expiry.date : undefined}>{expiry.text}</dd>
              </div>
              {tagged ? (
                <div className="flex items-center gap-2">
                  <Tag size={16} aria-hidden="true" className="flex-none text-(--color-muted)" />
                  <dt className="sr-only">Tracking</dt>
                  <dd>UTM tagged</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="@2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1 @4xl:col-start-3 @4xl:row-span-1 @4xl:self-center">
            <LinkActions link={link} displayUrl={displayUrl} shortUrl={shortUrlFor(link.slug)} />
          </div>
        </div>
      </div>
    </li>
  );
}
