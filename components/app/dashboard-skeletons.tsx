import { Bone, LinkRowSkeleton } from "@/components/links/skeletons";

/** Placeholders sized like the sections they stand in for, so nothing jumps when data streams in. */
export function ClicksOverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading clicks" className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="card p-5 sm:p-6">
        <Bone className="h-6 w-48" />
        <Bone className="mt-4 h-6 w-56" />
        <Bone className="mt-3 h-36 w-full sm:h-44 lg:h-52" />
        <Bone className="mt-2 h-4 w-full" />
      </div>
      <div className="card hidden p-5 sm:p-6 lg:block">
        <Bone className="h-6 w-28" />
        <Bone className="mt-2 h-4 w-44" />
        <Bone className="mt-4 h-10 w-full" />
        <Bone className="mt-2 h-10 w-full" />
        <Bone className="mt-2 h-10 w-full" />
      </div>
    </div>
  );
}

export function RecentLinksSkeleton() {
  return (
    <div role="status" aria-label="Loading recent links">
      <Bone className="mb-3 h-[44px] w-40" />
      <ul className="divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
        {Array.from({ length: 3 }, (_, i) => <LinkRowSkeleton key={i} />)}
      </ul>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <div role="status" aria-label="Loading activity" className="rounded-(--radius-lg) border border-(--color-border) bg-white p-4 sm:p-5">
      <Bone className="h-6 w-40" />
      <Bone className="mt-4 h-12 w-full" />
      <Bone className="mt-2 h-12 w-full" />
      <Bone className="mt-2 h-12 w-full" />
    </div>
  );
}
