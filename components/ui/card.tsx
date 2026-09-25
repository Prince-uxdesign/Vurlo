import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Bordered surface — no shadow by default. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}
