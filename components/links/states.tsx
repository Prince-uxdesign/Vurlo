"use client";

import { RefreshCw, SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Nothing created yet. One clear next step, no decoration. */
export function EmptyWorkspace() {
  return (
    <div className="rounded-(--radius-lg) border border-dashed border-(--color-ink-900) bg-white p-8 text-center sm:p-12">
      <h2 className="text-h2">You haven&apos;t created any links yet.</h2>
      <p className="mx-auto mt-2 max-w-md text-(--color-muted)">
        Paste a long URL and get a short link you can copy, share and manage from here.
      </p>
      <Link href="/dashboard#shorten" className="btn-primary mt-6">
        Create your first link
      </Link>
    </div>
  );
}

/** A search or filter matched nothing. Say so, and offer the way back. */
export function NoResults({ query, clearHref }: { query: string; clearHref: string }) {
  return (
    <div className="rounded-(--radius-lg) border border-(--color-border) bg-white p-8 text-center sm:p-10">
      <SearchX size={28} aria-hidden="true" className="mx-auto" />
      <h2 className="text-h3 mt-3">No links match{query ? ` “${query.length > 40 ? `${query.slice(0, 40)}…` : query}”` : " these filters"}</h2>
      <p className="mt-1 text-(--color-muted)">Try a different word, or clear your search and filters.</p>
      <Link href={clearHref} className="btn-outline mt-5">
        Clear search and filters
      </Link>
    </div>
  );
}

/** A query failed. Generic message, a real retry, no internals. */
export function ResultsError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="alert" className="rounded-(--radius-lg) border border-(--color-danger-700) bg-white p-8 text-center">
      <TriangleAlert size={28} aria-hidden="true" className="mx-auto text-(--color-danger-700)" />
      <h2 className="text-h3 mt-3">We couldn&apos;t load your links</h2>
      <p className="mt-1 text-(--color-muted)">The problem is on our side, and your links are safe. Try again in a moment.</p>
      <Button variant="outline" className="mt-5" loading={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? null : <RefreshCw size={18} aria-hidden="true" />}
        Try again
      </Button>
    </div>
  );
}
