import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { LinkAnalytics } from "@/components/analytics/link-analytics";
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton";
import { PresetSwitcher } from "@/components/analytics/preset-switcher";
import { SectionError } from "@/components/app/section-error";
import { LinkIdentity, LinkSettings, LinkStatusNotice } from "@/components/links/link-detail";
import { LinkManagerProvider, ManageLinkSection } from "@/components/links/link-manager";
import { requireUser } from "@/lib/auth/session";
import { getLinkAnalytics, getOwnedLink } from "@/lib/analytics/detail";
import { ANALYTICS_TTL, analyticsGuard } from "@/lib/analytics/guard";
import { parsePreset } from "@/lib/analytics/presets";
import type { AnalyticsPreset } from "@/lib/analytics/presets";
import { logServerError } from "@/lib/links/log";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const link = supabase ? await getOwnedLink(supabase, id).catch(() => null) : null;
  return { title: link ? `${siteConfig.shortLinkHost}/${link.slug}` : "Link" };
}

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

async function AnalyticsSection({ supabase, userId, linkId, preset, shortUrl }: { supabase: UserClient; userId: string; linkId: string; preset: AnalyticsPreset; shortUrl: string }) {
  const loaded = await analyticsGuard.load(userId, `link:${linkId}:${preset}`, ANALYTICS_TTL.link, () =>
    getLinkAnalytics(supabase, linkId, preset).catch((error) => {
      logServerError("link_analytics_failed", error, { preset });
      return null;
    }),
  );
  if (!loaded.data) return <SectionError title="Clicks and traffic" busy={loaded.throttled} level={3} />;
  return <LinkAnalytics data={loaded.data} shortUrl={shortUrl} />;
}

/**
 * One page per link: management and analytics together. Order is the same
 * on every screen (identity and primary actions, status, performance, then
 * settings and status changes); from 1024px settings move into a side panel
 * beside the analytics so both are in view. A link that isn't yours is
 * notFound: never another user's numbers, never a hint the id exists.
 *
 * Deliberately no loading.tsx on this route (and the list's skeleton lives
 * in the `(list)` group so it doesn't wrap this page): a route-level
 * skeleton starts streaming with a 200 before the ownership check, and
 * notFound() could then only render the 404 UI, not send the 404 status.
 * The one blocking query is the link row; analytics stream in below.
 */
export default async function LinkDetailPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/links");
  const { id } = await params;
  const query = await searchParams;
  const preset = parsePreset(Array.isArray(query.range) ? query.range[0] : query.range);

  const supabase = await createClient();
  if (!supabase) {
    logServerError("link_detail_unavailable", "client not configured");
    notFound();
  }
  const link = await getOwnedLink(supabase, id).catch((error) => {
    logServerError("link_detail_failed", error);
    return null;
  });
  if (!link) notFound();

  const now = new Date();
  const displayUrl = `${siteConfig.shortLinkHost}/${link.slug}`;
  const shortUrl = `${new URL(siteConfig.url).origin}/${link.slug}`;

  return (
    <LinkManagerProvider link={link} displayUrl={displayUrl} shortUrl={shortUrl}>
      <Link
        href="/links"
        className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-(--radius-sm) px-1 text-[14px] font-semibold text-(--color-muted) hover:text-(--color-ink-900)"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All links
      </Link>

      <LinkIdentity link={link} displayUrl={displayUrl} now={now} />
      <LinkStatusNotice link={link} now={now} />

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
        <section aria-labelledby="performance-title" className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="performance-title" className="text-h2">Performance</h2>
            <PresetSwitcher linkId={link.id} preset={preset} />
          </div>
          <Suspense key={preset} fallback={<AnalyticsSkeleton />}>
            <AnalyticsSection supabase={supabase} userId={user.id} linkId={link.id} preset={preset} shortUrl={shortUrl} />
          </Suspense>
        </section>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <LinkSettings link={link} displayUrl={displayUrl} now={now} />
          <ManageLinkSection />
        </div>
      </div>
    </LinkManagerProvider>
  );
}
