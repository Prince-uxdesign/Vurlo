/**
 * Loading placeholders. They use the same containers, paddings and grid
 * placement as the real rows so nothing jumps when content arrives.
 */
export function Bone({ className }: { className: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

export function LinkRowSkeleton() {
  return (
    <li className="@container">
      <div className="p-4 sm:p-5">
        <div className="grid gap-x-8 gap-y-3 @2xl:grid-cols-[minmax(0,1fr)_auto] @4xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] @4xl:gap-x-10">
          <div className="@2xl:col-start-1 @2xl:row-start-1">
            <Bone className="h-[26px] w-3/5" />
            <Bone className="mt-2 h-[38px] w-full" />
          </div>
          <div className="@2xl:col-start-1 @2xl:row-start-2 @4xl:col-start-2 @4xl:row-start-1">
            <Bone className="mb-2 hidden h-6 w-20 @4xl:block" />
            <div className="grid gap-y-1">
              <Bone className="h-[21px] w-44" />
              <Bone className="h-[21px] w-56" />
            </div>
          </div>
          <div className="@2xl:col-start-2 @2xl:row-span-2 @2xl:row-start-1 @4xl:col-start-3 @4xl:row-span-1 @4xl:self-center">
            <div className="flex items-center gap-2">
              <Bone className="h-11 flex-1 @2xl:w-28 @2xl:flex-none" />
              <Bone className="h-11 flex-1 @2xl:w-28 @2xl:flex-none" />
              <Bone className="size-11 flex-none" />
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading your links">
      <ul className="divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
        {Array.from({ length: rows }, (_, i) => (
          <LinkRowSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
