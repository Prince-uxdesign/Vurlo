import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError = false, className, ...props }: InputProps) {
  return (
    <input className={cn("input", hasError && "error", className)} {...props} />
  );
}
