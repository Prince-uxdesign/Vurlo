import { ActivitySkeleton, ClicksOverviewSkeleton, RecentLinksSkeleton } from "@/components/app/dashboard-skeletons";
import { Bone } from "@/components/links/skeletons";

/** Mirrors the populated dashboard: create panel, summary, clicks, recent links, activity. */
export default function DashboardLoading() {
  return (
    <>
      <Bone className="h-[38px] w-44 md:h-[46px]" />
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-6 sm:mt-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <div className="shortener-panel">
          <Bone className="h-[27px] w-40" />
          <Bone className="mt-6 h-[19px] w-44" />
          <Bone className="mt-3 h-12 w-full" />
          <Bone className="mt-4 h-11 w-56" />
        </div>
        <div className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
          <div className="p-4 sm:p-5">
            <Bone className="h-5 w-24" />
            <Bone className="mt-2 h-[30px] w-28" />
            <Bone className="mt-3 h-2.5 w-full" />
            <Bone className="mt-3 h-5 w-64 max-w-full" />
          </div>
          <div className="grid grid-cols-2 border-t border-(--color-border)">
            <div className="p-4 sm:px-5"><Bone className="h-4 w-20" /><Bone className="mt-2 h-[26px] w-14" /></div>
            <div className="p-4 sm:px-5"><Bone className="h-4 w-20" /><Bone className="mt-2 h-[26px] w-14" /></div>
          </div>
        </div>
        <div className="lg:col-span-2"><ClicksOverviewSkeleton /></div>
        <RecentLinksSkeleton />
        <ActivitySkeleton />
      </div>
    </>
  );
}
