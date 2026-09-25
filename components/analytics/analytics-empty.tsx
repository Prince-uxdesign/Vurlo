import { BarChart3 } from "lucide-react";

/**
 * Zero state (§4): never an empty chart pretending at data. Names what will
 * appear here once the short link gets its first visit.
 */
export function AnalyticsEmpty({ shortUrl }: { shortUrl: string }) {
  return (
    <div className="card flex flex-col items-center px-5 py-12 text-center sm:py-16">
      <span className="grid size-12 place-items-center rounded-(--radius-md) bg-(--color-mist-100)" aria-hidden="true">
        <BarChart3 size={24} />
      </span>
      <h2 className="text-h2 mt-4">No clicks yet</h2>
      <p className="mt-2 max-w-md text-(--color-muted)">
        Share your short link and visits will show up here: total clicks, where they came
        from, and what they used to open it.
      </p>
      <p className="mt-4 max-w-full break-all font-mono text-[14px] font-semibold">{shortUrl}</p>
    </div>
  );
}
