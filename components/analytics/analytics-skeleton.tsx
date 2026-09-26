import { Bone } from "@/components/links/skeletons";

/** Same cards and heights as the loaded analytics, so switching range doesn't shift the page. */
export function AnalyticsSkeleton() {
  return (
    <div role="status" aria-label="Loading analytics" className="space-y-4 sm:space-y-6">
      <div className="card p-5 sm:p-6">
        <Bone className="h-5 w-24" />
        <Bone className="mt-2 h-12 w-28" />
        <Bone className="mt-5 h-10 w-full" />
      </div>
      <div className="card p-5 sm:p-6">
        <Bone className="h-6 w-40" />
        <Bone className="mt-4 h-6 w-56" />
        <Bone className="mt-3 h-36 w-full sm:h-44 lg:h-52" />
        <Bone className="mt-2 h-4 w-full" />
      </div>
    </div>
  );
}
