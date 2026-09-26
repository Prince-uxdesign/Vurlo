import { Archive, Ban, Clock, History } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { describeExpiry, formatDate, formatRelative } from "@/lib/format";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { UTM_KEYS, buildTrackedUrl, readUtm, utmFields } from "@/lib/validation/utm";
import { ExpandableUrl } from "./expandable-url";
import { CopyValueButton, EditLinkButton, LinkPrimaryActions, QrButton, StatusActionButton } from "./link-manager";
import { StatusBadge } from "./status-badge";

const utmOf = (link: LinkListItem) => ({ source: link.utmSource, medium: link.utmMedium, campaign: link.utmCampaign });

/** The URL visitors actually land on (destination plus any UTM values), or the destination if it can't be built. */
export function finalUrl(link: LinkListItem): string {
  try {
    return buildTrackedUrl(link.destinationUrl, utmOf(link));
  } catch {
    return link.destinationUrl;
  }
}

/**
 * Who this link is and what you can do with it: the short URL as the page
 * title, its status in words and icon, where it goes (clamped, expandable
 * and copyable, so a 2,000-character URL never breaks the layout), and the
 * primary actions.
 */
export function LinkIdentity({ link, displayUrl, now }: { link: LinkListItem; displayUrl: string; now: Date }) {
  const expiry = describeExpiry(link.expiresAt, now);
  const target = finalUrl(link);
  return (
    <header className="mt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-0 break-all font-mono text-[22px] font-semibold leading-snug sm:text-[28px]">{displayUrl}</h1>
        <StatusBadge status={link.effectiveStatus} />
      </div>

      <div className="mt-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-small text-(--color-muted)">Redirects to</p>
          <ExpandableUrl url={target} className="text-[15px]" />
        </div>
        <CopyValueButton value={target} label="Copy destination URL" />
      </div>

      <dl className="text-small mt-3 flex flex-wrap gap-x-5 gap-y-1 text-(--color-muted)">
        <div className="flex gap-1.5">
          <dt>Created</dt>
          <dd>{formatDate(link.createdAt)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="sr-only">Expiry</dt>
          <dd className={expiry.soon ? "font-semibold text-(--color-ink-900)" : undefined}>{expiry.text}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <LinkPrimaryActions />
      </div>
    </header>
  );
}

function Notice({ icon: Icon, children, action }: { icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-(--radius-lg) border border-(--color-border) bg-(--color-mist-100) px-4 py-3 sm:px-5">
      <Icon size={20} aria-hidden="true" className="flex-none" />
      <p className="min-w-0 flex-[1_1_16rem]">{children}</p>
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

/**
 * One calm line when visitors can't reach the destination (or soon won't),
 * with the one action that fixes it. Status is already in the badge; this
 * says what it means for visitors. No alarm colours: it's information.
 */
export function LinkStatusNotice({ link, now }: { link: LinkListItem; now: Date }) {
  const expiry = describeExpiry(link.expiresAt, now);
  switch (link.effectiveStatus) {
    case "expired":
      return (
        <Notice icon={History} action={<EditLinkButton className="btn-compact">Change expiry</EditLinkButton>}>
          <strong className="font-semibold">{expiry.text}.</strong> Visitors see an “expired” page instead of your destination.
        </Notice>
      );
    case "disabled":
      return (
        <Notice icon={Ban} action={<StatusActionButton action="enable" className="btn-compact">Enable link</StatusActionButton>}>
          <strong className="font-semibold">This link is turned off.</strong> Visitors see a “turned off” page.
        </Notice>
      );
    case "archived":
      return (
        <Notice icon={Archive} action={<StatusActionButton action="unarchive" className="btn-compact">Restore link</StatusActionButton>}>
          <strong className="font-semibold">This link is archived.</strong> It doesn&apos;t redirect and is hidden from your main list.
        </Notice>
      );
    default:
      if (!expiry.soon) return null;
      return (
        <Notice icon={Clock} action={<EditLinkButton className="btn-compact">Change expiry</EditLinkButton>}>
          <strong className="font-semibold">{expiry.text}</strong> ({expiry.date}). After that, visitors see an “expired” page.
        </Notice>
      );
  }
}

function Row({ term, children, wide }: { term: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "min-w-0 @xl:col-span-2" : "min-w-0"}>
      <dt className="text-small text-(--color-muted)">{term}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/**
 * The link's configuration in full: every value readable and the long ones
 * copyable. One column in the desktop side panel; two columns when it runs
 * full width on tablets, so the extra room shows more at once.
 */
export function LinkSettings({ link, displayUrl, now }: { link: LinkListItem; displayUrl: string; now: Date }) {
  const expiry = describeExpiry(link.expiresAt, now);
  const fromUrl = readUtm(link.destinationUrl);
  const utm = UTM_KEYS.map((key) => ({
    key,
    label: utmFields.find((f) => f.key === key)!.label,
    value: utmOf(link)[key] ?? fromUrl[key] ?? null,
  }));
  const tagged = utm.some((u) => u.value);
  const target = finalUrl(link);

  return (
    <section aria-labelledby="settings-title" className="@container rounded-(--radius-lg) border border-(--color-border) bg-white">
      <div className="flex items-center justify-between gap-3 p-4 sm:px-5">
        <h2 id="settings-title" className="text-h3">Link settings</h2>
        <EditLinkButton className="btn-compact">Edit</EditLinkButton>
      </div>
      <dl className="grid gap-x-8 gap-y-4 border-t border-(--color-border) p-4 sm:px-5 @xl:grid-cols-2">
        <Row term="Short link">
          <span className="break-all font-mono text-[15px] font-semibold">{displayUrl}</span>
          <span className="text-small block text-(--color-muted)">{link.isCustomAlias ? "Custom alias" : "Generated address"}</span>
        </Row>
        <Row term="Expiry">
          {expiry.text}
          {expiry.date && !expiry.past && expiry.soon ? <span className="text-small block text-(--color-muted)">{expiry.date}</span> : null}
        </Row>
        <Row term="Destination" wide>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 break-all text-[14px]">{link.destinationUrl}</p>
            <CopyValueButton value={link.destinationUrl} label="Copy destination" />
          </div>
        </Row>
        <Row term="UTM tracking" wide>
          {tagged ? (
            <>
              <ul className="grid gap-x-6 gap-y-1 text-[14px] @md:grid-cols-3">
                {utm.map((u) => (
                  <li key={u.key} className="min-w-0 break-words">
                    <span className="text-(--color-muted)">{u.label}: </span>
                    {u.value ? <span className="font-semibold">{u.value}</span> : <span className="text-(--color-muted)">not set</span>}
                  </li>
                ))}
              </ul>
              {target !== link.destinationUrl ? (
                <div className="mt-3">
                  <p className="text-small text-(--color-muted)">Visitors land on</p>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-all text-[14px]">{target}</p>
                    <CopyValueButton value={target} label="Copy tracked URL" />
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-[14px]">
              None. <span className="text-(--color-muted)">Add source, medium and campaign with Edit.</span>
            </span>
          )}
        </Row>
        <Row term="Created">{formatDate(link.createdAt)}</Row>
        <Row term="Last changed">
          <time dateTime={link.updatedAt} title={formatDate(link.updatedAt)}>{formatRelative(link.updatedAt, now)}</time>
        </Row>
      </dl>
      <div className="border-t border-(--color-border) p-4 sm:px-5">
        <QrButton className="btn-compact w-full @sm:w-auto" />
      </div>
    </section>
  );
}
