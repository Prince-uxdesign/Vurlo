import { CalendarClock, CalendarPlus, Tag } from "lucide-react";
import { siteConfig } from "@/config/site";
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
 */
export function LinkRow({ link, now }: { link: LinkListItem; now: Date }) {
  const expiry = describeExpiry(link.expiresAt, now);
  const displayUrl = `${siteConfig.shortLinkHost}/${link.slug}`;
  const origin = new URL(siteConfig.url).origin;
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
              <p className="min-w-0 break-all font-mono text-[16px] font-semibold leading-snug">{displayUrl}</p>
              {/* Visibility classes go on a wrapper: .badge sets its own display. */}
              <span className="@4xl:hidden"><StatusBadge status={link.effectiveStatus} /></span>
            </div>
            <ExpandableUrl url={link.destinationUrl} className="text-small mt-1.5 text-(--color-muted)" />
          </div>

          <div className="min-w-0 @2xl:col-start-1 @2xl:row-start-2 @4xl:col-start-2 @4xl:row-start-1">
            <span className="mb-2 hidden @4xl:inline-block"><StatusBadge status={link.effectiveStatus} /></span>
            <dl className="grid gap-y-1 text-[14px]">
              <div className="flex items-center gap-2">
                <CalendarPlus size={16} aria-hidden="true" className="flex-none text-(--color-muted)" />
                <dt className="sr-only">Created</dt>
                <dd>Created {formatDate(link.createdAt)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock size={16} aria-hidden="true" className="flex-none text-(--color-muted)" />
                <dt className="sr-only">Expiry</dt>
                <dd className={expiry.soon ? "font-semibold" : undefined}>{expiry.text}</dd>
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
            <LinkActions link={link} displayUrl={displayUrl} shortUrl={`${origin}/${link.slug}`} />
          </div>
        </div>
      </div>
    </li>
  );
}
