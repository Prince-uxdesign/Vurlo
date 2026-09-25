"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface ExpandableUrlProps {
  url: string;
  className?: string;
}

/**
 * A destination URL that never overflows and is never lost. Short URLs render
 * as plain text. Long ones clamp to two lines, and the text itself is the
 * (44px+ tall) toggle that reveals the full address.
 */
export function ExpandableUrl({ url, className }: ExpandableUrlProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const isLong = url.length > 64;

  if (!isLong) return <p className={cn("break-all", className)}>{url}</p>;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={id}
      onClick={() => setExpanded((v) => !v)}
      className="block w-full min-w-0 cursor-pointer rounded-(--radius-sm) text-left"
    >
      {/* `block` would override line-clamp's display, so it is only used when expanded. */}
      <span id={id} className={cn("break-all", expanded ? "block" : "line-clamp-2", className)}>
        {url}
      </span>
      <span className="sr-only">{expanded ? "Collapse full URL" : "Show full URL"}</span>
    </button>
  );
}
