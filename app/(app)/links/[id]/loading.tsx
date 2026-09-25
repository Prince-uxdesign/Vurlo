/** Loading skeleton for the link analytics page: same skeleton blocks, no layout shift. */
export default function LinkAnalyticsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading analytics">
      <div className="h-6 w-24 animate-pulse rounded bg-(--color-mist-100)" />
      <div className="mt-3 h-8 w-2/3 animate-pulse rounded bg-(--color-mist-100)" />
      <div className="mt-6 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-24 animate-pulse rounded-(--radius-md) bg-(--color-mist-100)" />
        ))}
      </div>
      <div className="card mt-6 animate-pulse p-5 sm:p-8">
        <div className="h-4 w-28 rounded bg-(--color-mist-100)" />
        <div className="mt-2 h-12 w-32 rounded bg-(--color-mist-100)" />
      </div>
      <div className="card mt-6 h-64 animate-pulse" />
    </div>
  );
}
