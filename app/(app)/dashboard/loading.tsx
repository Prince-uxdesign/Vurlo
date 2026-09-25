import { Bone, LinkRowSkeleton } from "@/components/links/skeletons";

/** Mirrors the dashboard grid: create panel, usage, recent links, activity. */
export default function DashboardLoading() {
  return (
    <>
      <Bone className="h-[38px] w-44 md:h-[46px]" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
        <div className="shortener-panel">
          <Bone className="h-[27px] w-40" />
          <Bone className="mt-6 h-[19px] w-44" />
          <Bone className="mt-3 h-12 w-full" />
          <Bone className="mt-4 h-11 w-56" />
        </div>
        <div className="rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-4 sm:p-5">
          <Bone className="h-5 w-24" />
          <Bone className="mt-2 h-[30px] w-28" />
          <Bone className="mt-3 h-2.5 w-full" />
          <Bone className="mt-3 h-5 w-64 max-w-full" />
        </div>
        <div>
          <Bone className="mb-3 h-[30px] w-40" />
          <ul className="divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
            {Array.from({ length: 3 }, (_, i) => <LinkRowSkeleton key={i} />)}
          </ul>
        </div>
        <div className="rounded-(--radius-lg) border border-(--color-border) bg-white p-4 sm:p-5">
          <Bone className="h-6 w-40" />
          <Bone className="mt-4 h-14 w-full" />
          <Bone className="mt-2 h-14 w-full" />
        </div>
      </div>
    </>
  );
}
