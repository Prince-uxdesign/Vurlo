import Link from "next/link";
import { LinkRow } from "@/components/links/link-row";
import { getLinksClicks } from "@/lib/dashboard/queries";
import type { RpcClient } from "@/lib/analytics/queries";
import { DEFAULT_LIST_PARAMS } from "@/lib/links/list-params";
import { logServerError } from "@/lib/links/log";
import { listMyLinks } from "@/lib/links/workspace";
import type { createClient } from "@/lib/supabase/server";
import { SectionError } from "./section-error";

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

const COUNT = 5;

/** The five newest links with their all-time clicks: two bounded queries. */
export async function RecentLinks({ supabase, rpc }: { supabase: UserClient; rpc: RpcClient }) {
  let items;
  try {
    items = (await listMyLinks(supabase, DEFAULT_LIST_PARAMS, COUNT)).items;
  } catch (error) {
    logServerError("dashboard_recent_failed", error);
    return <SectionError title="Recent links" />;
  }
  const clicks = await getLinksClicks(rpc, items.map((l) => l.id));
  const now = new Date();

  return (
    <section aria-labelledby="recent-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="recent-title" className="text-h2">Recent links</h2>
        <Link href="/links" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          View all links
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-(--radius-lg) border border-(--color-border) bg-white p-5 text-(--color-muted)">
          Your newest links show here. Everything you have is archived:{" "}
          <Link href="/links?status=archived" className="font-semibold text-(--color-ink-900) underline underline-offset-2">see archived links</Link>.
        </p>
      ) : (
        <ul className="divide-y divide-(--color-border) rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
          {items.map((link) => (
            <LinkRow key={link.id} link={link} now={now} clicks={clicks?.get(link.id) ?? null} />
          ))}
        </ul>
      )}
    </section>
  );
}
