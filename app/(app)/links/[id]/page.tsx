import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LinkAnalytics } from "@/components/analytics/link-analytics";
import { StatusBadge } from "@/components/links/status-badge";
import { requireUser } from "@/lib/auth/session";
import { getLinkAnalyticsDetail } from "@/lib/analytics/detail";
import { describeExpiry, formatDate } from "@/lib/format";
import { logServerError } from "@/lib/links/log";
import { createClient } from "@/lib/supabase/server";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Link analytics" };

/**
 * Per-link analytics (§1): identity header (address, status, destination,
 * dates) followed by the analytics experience. All data loads server-side as
 * aggregates; a link that isn't yours renders notFound -- never another
 * user's numbers, never a hint the id exists elsewhere.
 */
export default async function LinkAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/links");
  const { id } = await params;
  const query = await searchParams;
  const range = Array.isArray(query.range) ? query.range[0] : query.range;

  const supabase = await createClient();
  if (!supabase) {
    logServerError("link_analytics_unavailable", "analytics client not configured");
    notFound();
  }

  const detail = await getLinkAnalyticsDetail(supabase, id, range).catch((error) => {
    logServerError("link_analytics_failed", error, { preset: range });
    return null;
  });
  if (!detail) notFound();

  const { link } = detail;
  const now = new Date();
  const expiry = describeExpiry(link.expiresAt, now);
  const displayUrl = `${siteConfig.shortLinkHost}/${link.slug}`;
  const origin = new URL(siteConfig.url).origin;

  return (
    <>
      <Link
        href="/links"
        className="inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold text-(--color-muted) hover:text-(--color-ink-900)"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All links
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-0 break-all font-mono text-[20px] font-semibold leading-snug sm:text-[24px]">
          {displayUrl}
        </h1>
        <StatusBadge status={link.effectiveStatus} />
      </div>
      <p className="mt-1.5 break-all text-small text-(--color-muted)">
        Redirects to {link.destinationUrl}
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-small text-(--color-muted)">
        <div className="flex gap-1.5">
          <dt>Created</dt>
          <dd>{formatDate(link.createdAt)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime() ? "Expired" : "Expiry"}</dt>
          <dd>{expiry.text}</dd>
        </div>
      </dl>

      <LinkAnalytics detail={detail} shortUrl={`${origin}/${link.slug}`} />
    </>
  );
}
