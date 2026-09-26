import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { TrendChart } from "@/components/analytics/trend-chart";
import { siteConfig } from "@/config/site";
import { formatCount } from "@/lib/analytics/labels";
import { ANALYTICS_TTL, analyticsGuard } from "@/lib/analytics/guard";
import { getAccountTrend, getTopLinks } from "@/lib/dashboard/queries";
import { TREND_DAYS } from "@/lib/dashboard/shape";
import type { RpcClient } from "@/lib/analytics/queries";
import { SectionError } from "./section-error";

/**
 * What's happening across all links: daily clicks for the last 30 days and
 * the links that drove them. Two aggregate queries, no events. Streams in
 * after the page shell (it sits below the create panel on every screen).
 */
export async function ClicksOverview({ client, userId }: { client: RpcClient; userId: string }) {
  const loaded = await analyticsGuard.load(userId, "account-trend", ANALYTICS_TTL.account, async () => {
    const [trend, top] = await Promise.all([getAccountTrend(client), getTopLinks(client)]);
    return trend ? { trend, top } : null;
  });
  if (!loaded.data) return <SectionError title="Clicks, last 30 days" busy={loaded.throttled} />;
  const { trend, top } = loaded.data;

  const total = trend.reduce((s, p) => s + p.human, 0);
  if (total === 0) {
    return (
      <section aria-labelledby="overview-empty" className="card flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <span className="grid size-11 flex-none place-items-center rounded-(--radius-md) bg-(--color-mist-100)" aria-hidden="true">
          <BarChart3 size={22} />
        </span>
        <div>
          <h2 id="overview-empty" className="text-h3">No clicks in the last {TREND_DAYS} days</h2>
          <p className="mt-0.5 text-(--color-muted)">Share a link and its visits will chart here, with your busiest links alongside.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:gap-6 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TrendChart points={trend} bucket="day" title={`Clicks, last ${TREND_DAYS} days`} />
        {top && top.length > 0 ? (
          <section aria-labelledby="top-links-title" className="card p-5 sm:p-6">
            <h2 id="top-links-title" className="text-h3">Top links</h2>
            <p className="text-small mt-0.5 text-(--color-muted)">Most clicks in the last {TREND_DAYS} days.</p>
            <ol className="mt-3 divide-y divide-(--color-border)">
              {top.map((link, i) => (
                <li key={link.linkId}>
                  <Link
                    href={`/links/${link.linkId}`}
                    className="-mx-2 flex min-h-12 items-center gap-3 rounded-(--radius-sm) px-2 hover:bg-(--color-mist-100)"
                  >
                    <span className="w-4 flex-none text-[14px] font-semibold text-(--color-muted)" aria-hidden="true">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[14px] font-semibold">
                      {siteConfig.shortLinkHost}/{link.slug}
                    </span>
                    <span className="flex-none text-[14px]">
                      <span className="font-semibold">{formatCount(link.clicks)}</span>{" "}
                      <span className="text-(--color-muted)">{link.clicks === 1 ? "click" : "clicks"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}
