import type { ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends ComponentProps<"input"> {
  hasError?: boolean;
}

export function Input({ hasError = false, className, ...props }: InputProps) {
  return (
    <input className={cn("input", hasError && "error", className)} {...props} />
  );
}
