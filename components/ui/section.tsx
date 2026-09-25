import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Vertical rhythm wrapper — whitespace serves hierarchy, not decoration. */
export function Section({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={cn("py-8 md:py-12", className)} {...props} />;
}
