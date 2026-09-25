import Link from "next/link";
import { siteConfig } from "@/config/site";
import { formatRelative } from "@/lib/format";
import type { LinkListItem } from "@/lib/links/workspace-types";

function verbFor(link: LinkListItem): string {
  const edited = new Date(link.updatedAt).getTime() - new Date(link.createdAt).getTime() > 5000;
  if (!edited) return "Created";
  if (link.status === "archived") return "Archived";
  if (link.status === "disabled") return "Disabled";
  return "Updated";
}

/**
 * The latest change to each link, derived from what we really record
 * (created / last updated). It is not an event log, so it doesn't claim to be.
 */
export function RecentActivity({ links, now }: { links: LinkListItem[]; now: Date }) {
  return (
    <section aria-labelledby="activity-title" className="rounded-(--radius-lg) border border-(--color-border) bg-white">
      <div className="p-4 sm:p-5">
        <h2 id="activity-title" className="text-h3">Recent activity</h2>
        <p className="text-small mt-0.5 text-(--color-muted)">The latest change to each link.</p>
      </div>
      {links.length === 0 ? (
        <p className="border-t border-(--color-border) p-4 text-(--color-muted) sm:p-5">Nothing yet. Activity appears once you create a link.</p>
      ) : (
        <ul className="divide-y divide-(--color-border) border-t border-(--color-border)">
          {links.map((link) => (
            <li key={link.id}>
              <Link
                href={`/links?q=${encodeURIComponent(link.slug)}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-(--color-mist-100) sm:px-5"
              >
                <span className="min-w-0">
                  <span className="text-[14px] font-semibold">{verbFor(link)}</span>{" "}
                  <span className="break-all font-mono text-[13px] text-(--color-muted)">{siteConfig.shortLinkHost}/{link.slug}</span>
                </span>
                <span className="text-small flex-none text-(--color-muted)">{formatRelative(link.updatedAt, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
