"use client";

import { useRouter } from "next/navigation";
import { ShortenerWidget } from "@/components/marketing/shortener/shortener-widget";

/** The same shortener as the homepage, wired to refresh the dashboard after each link. */
export function QuickCreate({ limitReached }: { limitReached: boolean }) {
  const router = useRouter();
  return <ShortenerWidget isSignedIn limitReached={limitReached} onCreated={() => router.refresh()} />;
}
