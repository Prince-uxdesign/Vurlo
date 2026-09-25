import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface TooltipProps {
  /** Tooltip text — announced via aria-describedby on focus. */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * CSS-only tooltip — appears on hover and keyboard focus.
 * Wires `aria-describedby` to the bubble so screen readers announce it.
 */
export function Tooltip({ label, children, className }: TooltipProps) {
  const bubbleId = useId();
  return (
    <span className={cn("tooltip-root", className)} aria-describedby={bubbleId}>
      {children}
      <span role="tooltip" id={bubbleId} className="tooltip-bubble">
        {label}
      </span>
    </span>
  );
}
