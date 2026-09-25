import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { LinkStatusPage } from "@/components/marketing/link-status-page";
import { scheduleClickLogging } from "@/lib/analytics/record";
import { resolveLink } from "@/lib/links/resolve-link";

// Short links must never be indexed or cached: they can expire or change.
export const metadata: Metadata = {
  title: "Short link",
  robots: { index: false, follow: false },
};

/**
 * The redirect engine. One database round trip (`resolve_link`), no other
 * work before responding. Analytics is recorded off the critical path via
 * `after()` (see lib/analytics/record.ts) so it can never delay this
 * redirect: schedule first, then throw the redirect.
 */
export default async function ShortLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection(); // resolve at request time, never at build time
  const { slug } = await params;
  const result = await resolveLink(slug);

  switch (result.kind) {
    case "redirect": {
      // Phase 6A: one background RPC (`record_link_event`) after the
      // response is sent. Only successful redirects are logged -- expired,
      // disabled, archived, deleted and unknown slugs record nothing.
      // A logging failure can never break or slow this redirect.
      try {
        scheduleClickLogging(slug, await headers());
      } catch {
        // Headers unavailable (e.g. prerender): redirect anyway, log nothing.
      }
      redirect(result.url); // 307: temporary, so expiry and edits take effect
    }
    case "expired":
      return <LinkStatusPage kind="expired" />;
    case "disabled":
      return <LinkStatusPage kind="disabled" />;
    case "archived":
      return <LinkStatusPage kind="archived" />;
    case "unavailable":
      return <LinkStatusPage kind="unavailable" retryHref={`/${encodeURIComponent(slug)}`} />;
    default:
      notFound();
  }
}
