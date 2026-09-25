import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Centered content width with responsive horizontal padding. */
export function Container({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 md:px-6", className)}
      {...props}
    />
  );
}
