import type { Metadata } from "next";
import Link from "next/link";
import { QuickCreate } from "@/components/app/quick-create";
import { RecentActivity } from "@/components/app/recent-activity";
import { UsageCard } from "@/components/app/usage-card";
import { LinkRow } from "@/components/links/link-row";
import { ResultsError } from "@/components/links/states";
import { requireUser } from "@/lib/auth/session";
import { ACTIVE_LINK_LIMIT, DEFAULT_LIST_PARAMS } from "@/lib/links/list-params";
import { logServerError } from "@/lib/links/log";
import { getMyLinkStats, listMyLinks } from "@/lib/links/workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireUser("/dashboard");
  const supabase = await createClient();

  // Three small, bounded queries in parallel: counts, 5 newest, 5 last changed.
  let data;
  try {
    if (!supabase) throw new Error("not configured");
    const [stats, recent, changed] = await Promise.all([
      getMyLinkStats(supabase),
      listMyLinks(supabase, DEFAULT_LIST_PARAMS, 5),
      listMyLinks(supabase, { ...DEFAULT_LIST_PARAMS, filter: "all", sort: "updated" }, 5),
    ]);
    data = { stats, recent: recent.items, changed: changed.items };
  } catch (error) {
    logServerError("dashboard_load_failed", error);
    return (
      <>
        <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">Dashboard</h1>
        <div className="mt-6"><ResultsError /></div>
      </>
    );
  }

  const now = new Date();
  const { stats, recent, changed } = data;

  return (
    <>
      <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">Dashboard</h1>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <QuickCreate limitReached={stats.active >= ACTIVE_LINK_LIMIT} />
        <UsageCard stats={stats} />

        <section aria-labelledby="recent-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recent-title" className="text-h2">Recent links</h2>
            <Link href="/links" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
              View all links
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-(--radius-lg) border border-dashed border-(--color-ink-900) bg-white p-6 text-(--color-muted)">
              You haven&apos;t created any links yet. Paste a URL above to make your first one.
            </div>
          ) : (
            <ul className="divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
              {recent.map((link) => (
                <LinkRow key={link.id} link={link} now={now} />
              ))}
            </ul>
          )}
        </section>

        <RecentActivity links={changed} now={now} />
      </div>
    </>
  );
}
