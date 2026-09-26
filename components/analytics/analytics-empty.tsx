import { BarChart3 } from "lucide-react";

/**
 * Zero state: never an empty chart pretending at data. Names what will
 * appear once the short link gets its first visit, and says whether the
 * quiet spell is just this range or the link's whole life.
 */
export function AnalyticsEmpty({ shortUrl, rangeLabel }: { shortUrl: string; rangeLabel?: string | null }) {
  return (
    <div className="card flex flex-col items-center px-5 py-10 text-center sm:py-14">
      <span className="grid size-12 place-items-center rounded-(--radius-md) bg-(--color-mist-100)" aria-hidden="true">
        <BarChart3 size={24} />
      </span>
      <h3 className="text-h2 mt-4">{rangeLabel ? `No clicks in the last ${rangeLabel}` : "No clicks yet"}</h3>
      <p className="mt-2 max-w-md text-(--color-muted)">
        {rangeLabel
          ? "Try a longer time range, or share your short link to get more visits."
          : "Share your short link and visits will show up here: total clicks, where they came from, and what they used to open it."}
      </p>
      <p className="mt-4 max-w-full break-all font-mono text-[14px] font-semibold">{shortUrl}</p>
    </div>
  );
}
