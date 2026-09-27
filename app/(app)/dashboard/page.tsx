import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { AccountSummary } from "@/components/app/account-summary";
import { ClicksOverview } from "@/components/app/clicks-overview";
import {
  ActivitySkeleton,
  ClicksOverviewSkeleton,
  RecentLinksSkeleton,
} from "@/components/app/dashboard-skeletons";
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

function DashboardHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-(--color-mist-300) bg-white px-3 py-1 text-[12px] font-semibold text-(--color-slate-700)">
          <span className="size-2 rounded-full bg-(--color-ember-700)" aria-hidden="true" />
          <span>Command center</span>
        </div>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-(--color-ink-900) sm:text-[34px] md:text-[38px]">
          Good to have you here.
        </h1>
        <p className="mt-1 text-[15px] text-(--color-slate-700)">
          Create, share, and understand every link.
        </p>
      </div>

      {/* Small colorful architectural visual treatment (per Prompt 5 guidelines) */}
      <div className="relative hidden size-20 flex-none overflow-hidden rounded-2xl border border-(--color-mist-300) shadow-2xs sm:flex md:size-24">
        <Image
          src="/images/app/dashboard-texture.jpg"
          alt="Architectural texture accent"
          fill
          sizes="96px"
          className="object-cover"
        />
      </div>
    </div>
  );
}

/**
 * The command center, in priority order: create a link, the account at a
 * glance, what's happening (clicks), recent links, then what needs a look
 * and recent activity.
 */
export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();

  let stats;
  let totalClicks: number | null = null;
  let defaultExpiration:
    | Awaited<ReturnType<typeof getSettingsProfile>>["defaultExpiration"]
    | undefined;

  try {
    if (!supabase) throw new Error("not configured");
    const rpcClient = asRpcClient(supabase);
    const [s, clicks, profile] = await Promise.all([
      getMyLinkStats(supabase),
      analyticsGuard.load(user.id, "account-clicks", ANALYTICS_TTL.account, () =>
        getAccountClicks(rpcClient)
      ),
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
        <DashboardHeader />
        <div className="mt-6">
          <ResultsError />
        </div>
      </>
    );
  }

  const rpc = asRpcClient(supabase);
  const isNew = stats.total === 0;

  return (
    <>
      <DashboardHeader />
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <QuickCreate
          key="create"
          limitReached={stats.active >= ACTIVE_LINK_LIMIT}
          title={isNew ? "Create your first Vurlo link" : undefined}
          defaultExpiration={defaultExpiration}
        />
        {isNew ? (
          <FirstLinkGuide key="aside" />
        ) : (
          <AccountSummary key="aside" stats={stats} totalClicks={totalClicks} />
        )}

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
