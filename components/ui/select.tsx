import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

/** Styled native select — full keyboard and screen-reader support built in. */
export function Select({ hasError = false, className, ...props }: SelectProps) {
  return (
    <select
      className={cn("select", hasError && "error", className)}
      {...props}
    />
  );
}
