import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LinksResults } from "@/components/links/links-results";
import { LinksWorkspace } from "@/components/links/links-workspace";
import { ListSkeleton } from "@/components/links/skeletons";
import { ResultsError } from "@/components/links/states";
import { UsageMeter } from "@/components/links/usage-meter";
import { requireUser } from "@/lib/auth/session";
import { parseLinkListParams } from "@/lib/links/list-params";
import { logServerError } from "@/lib/links/log";
import { getMyLinkStats } from "@/lib/links/workspace";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Links" };

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser("/links");
  const params = parseLinkListParams(await searchParams);
  const supabase = await createClient();

  let stats;
  try {
    if (!supabase) throw new Error("not configured");
    stats = await getMyLinkStats(supabase);
  } catch (error) {
    logServerError("links_stats_failed", error);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">Links</h1>
        <Link href="/dashboard#shorten" className="btn-primary">
          Create link
        </Link>
      </div>

      {stats ? <div className="mt-5"><UsageMeter active={stats.active} /></div> : null}

      <div className="mt-5">
        {stats ? (
          <LinksWorkspace params={params} stats={stats}>
            {/* Keyed by the query so a change shows the skeleton in the same layout. */}
            <Suspense key={JSON.stringify(params)} fallback={<ListSkeleton />}>
              <LinksResults params={params} totalLinks={stats.total} />
            </Suspense>
          </LinksWorkspace>
        ) : (
          <ResultsError />
        )}
      </div>
    </>
  );
}
