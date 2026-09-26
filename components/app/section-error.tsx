"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * One section couldn't load; the rest of the page still works. Generic
 * message, real retry. `busy`: the section was throttled (too many loads in
 * a short time), which only needs a short wait.
 */
export function SectionError({ title, busy = false, level = 2 }: { title: string; busy?: boolean; level?: 2 | 3 }) {
  const Heading = level === 3 ? "h3" : "h2";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section aria-label={title} className="card flex flex-wrap items-center justify-between gap-3">
      <div role="alert">
        <Heading className="text-h3">{title}</Heading>
        <p className="mt-0.5 text-(--color-muted)">
          {busy ? "You've refreshed this a lot in the last minute. Wait a moment, then try again." : "This couldn't load right now. Your links still work."}
        </p>
      </div>
      <Button variant="outline" loading={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? null : <RefreshCw size={18} aria-hidden="true" />}
        Try again
      </Button>
    </section>
  );
}
