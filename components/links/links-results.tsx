import { redirect } from "next/navigation";
import { asRpcClient } from "@/lib/analytics/detail";
import { getLinksClicks } from "@/lib/dashboard/queries";
import { logServerError } from "@/lib/links/log";
import { buildLinksHref, DEFAULT_LIST_PARAMS } from "@/lib/links/list-params";
import type { LinkListParams } from "@/lib/links/list-params";
import { listMyLinks } from "@/lib/links/workspace";
import { createClient } from "@/lib/supabase/server";
import { EmptyWorkspace, NoResults, ResultsError } from "./states";
import { LinkRow } from "./link-row";
import { Pagination } from "./pagination";

/** Server component: one page of results, or an honest empty / no-match / error state. */
export async function LinksResults({ params, totalLinks }: { params: LinkListParams; totalLinks: number }) {
  const supabase = await createClient();
  if (!supabase) return <ResultsError />;

  let page;
  try {
    page = await listMyLinks(supabase, params);
  } catch (error) {
    logServerError("links_list_failed", error);
    return <ResultsError />;
  }

  // Asked for a page past the end (e.g. after deleting the last item on it, or
  // a hand-edited URL). An out-of-range page returns no rows, so the total is
  // unknown here: go back to page 1 and let it show the real state.
  if (page.items.length === 0 && params.page > 1) {
    redirect(buildLinksHref(params, { page: 1 }));
  }
  if (page.items.length === 0) {
    if (totalLinks === 0) return <EmptyWorkspace />;
    return <NoResults query={params.q} clearHref={buildLinksHref(DEFAULT_LIST_PARAMS)} />;
  }

  // One batched aggregate for the page's clicks. If it fails the rows still
  // render, just without a click line.
  const clicks = await getLinksClicks(asRpcClient(supabase), page.items.map((l) => l.id));
  const now = new Date();
  return (
    <section aria-label="Your links">
      <h2 className="sr-only">Your links</h2>
      <ul className="divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
        {page.items.map((link) => (
          <LinkRow key={link.id} link={link} now={now} clicks={clicks?.get(link.id) ?? null} />
        ))}
      </ul>
      <Pagination params={params} total={page.total} />
    </section>
  );
}
