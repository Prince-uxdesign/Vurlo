"use client";

import { useRouter } from "next/navigation";
import { ShortenerWidget } from "@/components/marketing/shortener/shortener-widget";
import type { ExpirationOption } from "@/lib/links/types";

/** The same shortener as the homepage, wired to refresh the dashboard after each link. */
export function QuickCreate({ limitReached, title, defaultExpiration }: { limitReached: boolean; title?: string; defaultExpiration?: ExpirationOption }) {
  const router = useRouter();
  return <ShortenerWidget isSignedIn limitReached={limitReached} title={title} defaultExpiration={defaultExpiration} onCreated={() => router.refresh()} />;
}
