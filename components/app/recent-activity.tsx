import { Archive, Ban, History, MousePointerClick, Pencil, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { formatRelative } from "@/lib/format";
import type { RpcClient } from "@/lib/analytics/queries";
import { getRecentActivity } from "@/lib/dashboard/queries";
import type { ActivityKind } from "@/lib/dashboard/shape";
import { activityLabel } from "@/lib/dashboard/shape";
import { SectionError } from "./section-error";

const ICONS: Record<ActivityKind, LucideIcon> = {
  created: Plus,
  updated: Pencil,
  disabled: Ban,
  archived: Archive,
  expired: History,
  clicked: MousePointerClick,
};

/**
 * A short feed derived from what is actually stored: each link's latest
 * change (created, edited, disabled, archived, expired) plus one line per
 * link that got clicks in the last 24 hours. Six rows, not an event log.
 */
export async function RecentActivity({ client }: { client: RpcClient }) {
  const items = await getRecentActivity(client, 6);
  if (!items) return <SectionError title="Recent activity" />;
  const now = new Date();

  return (
    <section aria-labelledby="activity-title" className="rounded-(--radius-lg) border border-(--color-border) bg-white">
      <div className="p-4 sm:p-5">
        <h2 id="activity-title" className="text-h3">Recent activity</h2>
      </div>
      {items.length === 0 ? (
        <p className="border-t border-(--color-border) p-4 text-(--color-muted) sm:p-5">Nothing yet. Activity appears once you create a link.</p>
      ) : (
        <ul className="divide-y divide-(--color-border) border-t border-(--color-border)">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            return (
              <li key={`${item.kind}-${item.linkId}`}>
                <Link
                  href={`/links/${item.linkId}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-(--color-mist-100) sm:px-5"
                >
                  <Icon size={18} aria-hidden="true" className="flex-none text-(--color-muted)" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">{activityLabel(item)}</span>
                    <span className="block truncate font-mono text-[13px] text-(--color-muted)">{siteConfig.shortLinkHost}/{item.slug}</span>
                  </span>
                  <time dateTime={item.occurredAt} className="text-small flex-none text-(--color-muted)">
                    {formatRelative(item.occurredAt, now)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
