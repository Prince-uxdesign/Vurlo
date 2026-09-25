import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { LinkStatusPage } from "@/components/marketing/link-status-page";
import { resolveLink } from "@/lib/links/resolve-link";

// Short links must never be indexed or cached: they can expire or change.
export const metadata: Metadata = {
  title: "Short link",
  robots: { index: false, follow: false },
};

/**
 * The redirect engine. One database round trip (`resolve_link`), no other
 * work before responding. Analytics will be recorded off the critical path
 * in a later phase so it can never delay this redirect.
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
    case "redirect":
      redirect(result.url); // 307: temporary, so expiry and edits take effect
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
