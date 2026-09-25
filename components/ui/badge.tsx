import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeTone = "active" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClass: Record<BadgeTone, string> = {
  active: "badge-active",
  neutral: "badge-neutral",
};

/**
 * Status badge — always pair color with an icon + label (never color alone).
 * Expired / Disabled / Archived share the neutral tone by design.
 */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return <span className={cn("badge", toneClass[tone], className)} {...props} />;
}
