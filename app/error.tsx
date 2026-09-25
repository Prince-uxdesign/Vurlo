"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { StatusShell } from "@/components/marketing/link-status-page";

/** Last-resort boundary: product-level message only, never error details. */
export default function GlobalRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatusShell
      Icon={TriangleAlert}
      label="Something went wrong"
      title="That didn't work"
      actions={
        <>
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            Go to Vurlo
          </Link>
        </>
      }
    >
      <p>Something went wrong on our side. Your link and data are fine. Try again in a moment.</p>
    </StatusShell>
  );
}
