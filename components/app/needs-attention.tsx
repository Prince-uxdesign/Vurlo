import { Clock, History } from "lucide-react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { describeExpiry } from "@/lib/format";
import { DEFAULT_LIST_PARAMS } from "@/lib/links/list-params";
import { logServerError } from "@/lib/links/log";
import { listMyLinks } from "@/lib/links/workspace";
import type { LinkStats } from "@/lib/links/workspace-types";
import type { createClient } from "@/lib/supabase/server";

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * Links that will stop working soon, and ones that already have. Calm by
 * design: a clock and a countdown, no warning colour. Renders nothing when
 * nothing needs a look (no "all good!" filler), and only queries when the
 * counts say there is something to show.
 */
export async function NeedsAttention({ supabase, stats }: { supabase: UserClient; stats: LinkStats }) {
  if (stats.expiring === 0 && stats.expired === 0) return null;

  let expiring: Awaited<ReturnType<typeof listMyLinks>>["items"] = [];
  if (stats.expiring > 0) {
    try {
      expiring = (await listMyLinks(supabase, { ...DEFAULT_LIST_PARAMS, filter: "expiring", sort: "expiring" }, 3)).items;
    } catch (error) {
      logServerError("dashboard_expiring_failed", error);
    }
  }
  if (expiring.length === 0 && stats.expired === 0) return null;
  const now = new Date();

  return (
    <section aria-labelledby="attention-title" className="rounded-(--radius-lg) border border-(--color-border) bg-white">
      <div className="p-4 sm:p-5">
        <h2 id="attention-title" className="text-h3">Needs attention</h2>
      </div>
      <ul className="divide-y divide-(--color-border) border-t border-(--color-border)">
        {expiring.map((link) => (
          <li key={link.id}>
            <Link href={`/links/${link.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-(--color-mist-100) sm:px-5">
              <Clock size={18} aria-hidden="true" className="flex-none text-(--color-muted)" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[14px] font-semibold">{siteConfig.shortLinkHost}/{link.slug}</span>
                <span className="text-small block text-(--color-muted)">{describeExpiry(link.expiresAt, now).text}</span>
              </span>
            </Link>
          </li>
        ))}
        {stats.expiring > expiring.length && expiring.length > 0 ? (
          <li>
            <Link href="/links?status=expiring&sort=expiring" className="flex min-h-12 items-center px-4 text-[14px] font-semibold underline underline-offset-2 sm:px-5">
              {stats.expiring - expiring.length} more expiring this week
            </Link>
          </li>
        ) : null}
        {stats.expired > 0 ? (
          <li>
            <Link href="/links?status=expired" className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-(--color-mist-100) sm:px-5">
              <History size={18} aria-hidden="true" className="flex-none text-(--color-muted)" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">
                  {stats.expired} expired {stats.expired === 1 ? "link" : "links"}
                </span>
                <span className="text-small block text-(--color-muted)">Visitors see an expired page. Extend or archive them.</span>
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
