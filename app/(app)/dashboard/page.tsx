import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountSummary } from "@/components/app/account-summary";
import { ClicksOverview } from "@/components/app/clicks-overview";
import { ActivitySkeleton, ClicksOverviewSkeleton, RecentLinksSkeleton } from "@/components/app/dashboard-skeletons";
import { FirstLinkGuide } from "@/components/app/first-link-guide";
import { NeedsAttention } from "@/components/app/needs-attention";
import { QuickCreate } from "@/components/app/quick-create";
import { RecentActivity } from "@/components/app/recent-activity";
import { RecentLinks } from "@/components/app/recent-links";
import { ResultsError } from "@/components/links/states";
import { requireUser } from "@/lib/auth/session";
import { asRpcClient } from "@/lib/analytics/detail";
import { ANALYTICS_TTL, analyticsGuard } from "@/lib/analytics/guard";
import { getAccountClicks } from "@/lib/dashboard/queries";
import { getSettingsProfile } from "@/lib/settings/account";
import { ACTIVE_LINK_LIMIT } from "@/lib/links/list-params";
import { logServerError } from "@/lib/links/log";
import { getMyLinkStats } from "@/lib/links/workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

const Title = () => <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">Dashboard</h1>;

/**
 * The command center, in priority order: create a link, the account at a
 * glance, what's happening (clicks), recent links, then what needs a look
 * and recent activity. Only the counts block the first paint; every section
 * below the fold streams in from its own aggregate query, so nothing loads
 * events and a slow or failed section never holds up the rest.
 *
 * QuickCreate keeps the same place in the tree for new and populated
 * accounts, so creating a first link (which refreshes into the populated
 * layout) keeps its success panel on screen.
 */
export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();

  let stats;
  let totalClicks: number | null = null;
  let defaultExpiration: Awaited<ReturnType<typeof getSettingsProfile>>["defaultExpiration"] | undefined;
  try {
    if (!supabase) throw new Error("not configured");
    const rpcClient = asRpcClient(supabase);
    const [s, clicks, profile] = await Promise.all([
      getMyLinkStats(supabase),
      analyticsGuard.load(user.id, "account-clicks", ANALYTICS_TTL.account, () => getAccountClicks(rpcClient)),
      getSettingsProfile(supabase, user.id),
    ]);
    stats = s;
    totalClicks = clicks.data;
    defaultExpiration = profile.defaultExpiration;
  } catch (error) {
    logServerError("dashboard_load_failed", error);
  }
  if (!supabase || !stats) {
    return (
      <>
        <Title />
        <div className="mt-6"><ResultsError /></div>
      </>
    );
  }

  const rpc = asRpcClient(supabase);
  const isNew = stats.total === 0;

  return (
    <>
      <Title />
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-6 sm:mt-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <QuickCreate
          key="create"
          limitReached={stats.active >= ACTIVE_LINK_LIMIT}
          title={isNew ? "Create your first Vurlo link" : undefined}
          defaultExpiration={defaultExpiration}
        />
        {isNew ? <FirstLinkGuide key="aside" /> : <AccountSummary key="aside" stats={stats} totalClicks={totalClicks} />}

        {isNew ? null : (
          <>
            <div key="overview" className="lg:col-span-2">
              <Suspense fallback={<ClicksOverviewSkeleton />}>
                <ClicksOverview client={rpc} userId={user.id} />
              </Suspense>
            </div>
            <div key="recent" className="min-w-0">
              <Suspense fallback={<RecentLinksSkeleton />}>
                <RecentLinks supabase={supabase} rpc={rpc} />
              </Suspense>
            </div>
            <div key="rail" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
              <Suspense fallback={null}>
                <NeedsAttention supabase={supabase} stats={stats} />
              </Suspense>
              <Suspense fallback={<ActivitySkeleton />}>
                <RecentActivity client={rpc} />
              </Suspense>
            </div>
          </>
        )}
      </div>
    </>
  );
}
