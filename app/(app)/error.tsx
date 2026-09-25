"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Last-resort boundary for the workspace. Retry, no details. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-(--radius-lg) border border-(--color-danger-700) bg-white p-8 text-center">
      <h1 className="text-h2">Something went wrong</h1>
      <p className="mt-2 text-(--color-muted)">The problem is on our side, and your links are safe. Try again in a moment.</p>
      <Button variant="outline" className="mt-5" onClick={reset}>
        <RefreshCw size={18} aria-hidden="true" /> Try again
      </Button>
    </div>
  );
}
