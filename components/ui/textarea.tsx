import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export function Textarea({
  hasError = false,
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn("input", hasError && "error", className)}
      {...props}
    />
  );
}
